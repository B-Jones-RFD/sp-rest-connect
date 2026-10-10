import { describe, it, expect } from 'vitest'
import {
  NTLM_FLAGS,
  createType1Message,
  createType3Message,
  extractNtlmToken,
  fileTimeNow,
  ntHash,
  ntowfV2,
  parseType2Message,
} from '../src/ntlm/messages'

// MS-NLMP section 4.2 test values
const USER = 'User'
const DOMAIN = 'Domain'
const PASSWORD = 'Password'
const WORKSTATION = 'COMPUTER'
const SERVER_CHALLENGE = Buffer.from('0123456789abcdef', 'hex')
const CLIENT_CHALLENGE = Buffer.from('aaaaaaaaaaaaaaaa', 'hex')
const ZERO_TIME = Buffer.alloc(8)
// MsvAvNbDomainName "Domain", MsvAvNbComputerName "Server", MsvAvEOL
const TARGET_INFO = Buffer.from(
  '02000c0044006f006d00610069006e0001000c00530065007200760065007200' +
    '00000000',
  'hex'
)

function decode(header: string): Buffer {
  expect(header.startsWith('NTLM ')).toBe(true)
  return Buffer.from(header.slice(5), 'base64')
}

function readSecBuf(buf: Buffer, pos: number): Buffer {
  const len = buf.readUInt16LE(pos)
  const off = buf.readUInt32LE(pos + 4)
  return buf.subarray(off, off + len)
}

/** Build a Type 2 message the way a server would. */
function buildType2(opts: { flags: number; targetInfo?: Buffer }): string {
  const unicode = (opts.flags & NTLM_FLAGS.NegotiateUnicode) !== 0
  const targetName = Buffer.from('Server', unicode ? 'utf16le' : 'ascii')
  const targetInfo = opts.targetInfo ?? Buffer.alloc(0)
  const buf = Buffer.alloc(56 + targetName.length + targetInfo.length)
  Buffer.from('NTLMSSP\0', 'ascii').copy(buf, 0)
  buf.writeUInt32LE(2, 8)
  buf.writeUInt16LE(targetName.length, 12)
  buf.writeUInt16LE(targetName.length, 14)
  buf.writeUInt32LE(56, 16)
  buf.writeUInt32LE(opts.flags >>> 0, 20)
  SERVER_CHALLENGE.copy(buf, 24)
  buf.writeUInt16LE(targetInfo.length, 40)
  buf.writeUInt16LE(targetInfo.length, 42)
  buf.writeUInt32LE(56 + targetName.length, 44)
  Buffer.from([6, 0, 0x70, 0x17, 0, 0, 0, 0x0f]).copy(buf, 48)
  targetName.copy(buf, 56)
  targetInfo.copy(buf, 56 + targetName.length)
  return 'NTLM ' + buf.toString('base64')
}

const V2_FLAGS =
  NTLM_FLAGS.NegotiateUnicode |
  NTLM_FLAGS.RequestTarget |
  NTLM_FLAGS.NegotiateNTLM |
  NTLM_FLAGS.NegotiateAlwaysSign |
  NTLM_FLAGS.TargetTypeServer |
  NTLM_FLAGS.NegotiateExtendedSecurity |
  NTLM_FLAGS.NegotiateTargetInfo |
  NTLM_FLAGS.NegotiateVersion |
  NTLM_FLAGS.Negotiate128 |
  NTLM_FLAGS.Negotiate56

describe('key derivation', () => {
  it('ntHash matches MS-NLMP 4.2.1', () => {
    expect(ntHash(PASSWORD).toString('hex')).toBe(
      'a4f49c406510bdcab6824ee7c30fd852'
    )
  })

  it('ntowfV2 matches MS-NLMP 4.2.4.1.1', () => {
    expect(ntowfV2(USER, PASSWORD, DOMAIN).toString('hex')).toBe(
      '0c868a403bfd7a93a3001ef22ef02e3f'
    )
  })
})

describe('fileTimeNow', () => {
  it('encodes the Unix epoch as the correct FILETIME', () => {
    // 1970-01-01 = 116444736000000000 (0x019DB1DED53E8000)
    expect(fileTimeNow(0).toString('hex')).toBe('00803ed5deb19d01')
  })
})

describe('extractNtlmToken', () => {
  it('reads a plain NTLM header', () => {
    expect(extractNtlmToken('NTLM abc+/=')).toBe('abc+/=')
  })
  it('reads NTLM from a multi-scheme header', () => {
    expect(extractNtlmToken('Negotiate, NTLM abc=')).toBe('abc=')
    expect(extractNtlmToken(['Negotiate', 'NTLM abc='])).toBe('abc=')
  })
  it('rejects a challenge-less header', () => {
    expect(() => extractNtlmToken('NTLM')).toThrow(/does not contain/)
    expect(() => extractNtlmToken('Negotiate, NTLM')).toThrow(/does not contain/)
    expect(() => extractNtlmToken('Basic realm="x"')).toThrow(/does not contain/)
  })
})

describe('createType1Message', () => {
  it('encodes signature, type, flags, and OEM domain/workstation', () => {
    const buf = decode(createType1Message({ domain: 'dom', workstation: 'ws' }))
    expect(buf.subarray(0, 8).toString('ascii')).toBe('NTLMSSP\0')
    expect(buf.readUInt32LE(8)).toBe(1)
    const flags = buf.readUInt32LE(12)
    expect(flags & NTLM_FLAGS.NegotiateUnicode).toBeTruthy()
    expect(flags & NTLM_FLAGS.NegotiateExtendedSecurity).toBeTruthy()
    expect(flags & NTLM_FLAGS.NegotiateOemDomainSupplied).toBeTruthy()
    expect(flags & NTLM_FLAGS.NegotiateOemWorkstationSupplied).toBeTruthy()
    expect(readSecBuf(buf, 16).toString('ascii')).toBe('DOM')
    expect(readSecBuf(buf, 24).toString('ascii')).toBe('WS')
    expect(buf.length).toBe(40 + 3 + 2)
  })

  it('clears the supplied flags when domain/workstation are empty', () => {
    const buf = decode(createType1Message({ domain: '', workstation: '' }))
    const flags = buf.readUInt32LE(12)
    expect(flags & NTLM_FLAGS.NegotiateOemDomainSupplied).toBe(0)
    expect(flags & NTLM_FLAGS.NegotiateOemWorkstationSupplied).toBe(0)
    expect(buf.length).toBe(40)
  })
})

describe('parseType2Message', () => {
  it('parses flags, challenge, target name and target info', () => {
    const msg = parseType2Message(
      buildType2({ flags: V2_FLAGS, targetInfo: TARGET_INFO })
    )
    expect(msg.negotiateFlags).toBe(V2_FLAGS >>> 0)
    expect(msg.serverChallenge.equals(SERVER_CHALLENGE)).toBe(true)
    expect(msg.targetName).toBe('Server')
    expect(msg.targetInfo.equals(TARGET_INFO)).toBe(true)
  })

  it('returns empty target info when the flag is absent', () => {
    const flags = V2_FLAGS & ~NTLM_FLAGS.NegotiateTargetInfo
    const msg = parseType2Message(buildType2({ flags }))
    expect(msg.targetInfo.length).toBe(0)
  })

  it('rejects non-Type-2 messages', () => {
    const type1 = createType1Message({ domain: 'd', workstation: 'w' })
    expect(() => parseType2Message(type1)).toThrow(/Expected NTLM Type 2/)
    expect(() => parseType2Message('NTLM AAAA')).toThrow(/signature/)
  })
})

describe('createType3Message', () => {
  const type2 = parseType2Message(
    buildType2({ flags: V2_FLAGS, targetInfo: TARGET_INFO })
  )
  const creds = {
    username: USER,
    password: PASSWORD,
    domain: DOMAIN,
    workstation: WORKSTATION,
  }

  it('produces the MS-NLMP 4.2.4 NTLMv2 and LMv2 responses', () => {
    const buf = decode(
      createType3Message(type2, creds, {
        clientChallenge: CLIENT_CHALLENGE,
        timestamp: ZERO_TIME,
      })
    )
    expect(buf.subarray(0, 8).toString('ascii')).toBe('NTLMSSP\0')
    expect(buf.readUInt32LE(8)).toBe(3)

    const lm = readSecBuf(buf, 12)
    expect(lm.toString('hex')).toBe(
      '86c35097ac9cec102554764a57cccc19aaaaaaaaaaaaaaaa'
    )

    const nt = readSecBuf(buf, 20)
    // NTProofStr
    expect(nt.subarray(0, 16).toString('hex')).toBe(
      '68cd0ab851e51c96aabc927bebef6a1c'
    )
    // temp / NTLMv2_CLIENT_CHALLENGE
    expect(nt.subarray(16).toString('hex')).toBe(
      '0101000000000000' +
        '0000000000000000' +
        'aaaaaaaaaaaaaaaa' +
        '00000000' +
        TARGET_INFO.toString('hex') +
        '00000000'
    )

    expect(readSecBuf(buf, 28).toString('utf16le')).toBe(DOMAIN)
    expect(readSecBuf(buf, 36).toString('utf16le')).toBe(USER)
    expect(readSecBuf(buf, 44).toString('utf16le')).toBe(WORKSTATION)
    expect(readSecBuf(buf, 52).length).toBe(0)
    expect(buf.readUInt32LE(60) & NTLM_FLAGS.NegotiateUnicode).toBeTruthy()
  })

  it('uses a fresh random client challenge by default', () => {
    const a = createType3Message(type2, creds)
    const b = createType3Message(type2, creds)
    expect(a).not.toBe(b)
  })

  it('refuses to downgrade when target info is missing', () => {
    const noInfo = parseType2Message(
      buildType2({ flags: V2_FLAGS & ~NTLM_FLAGS.NegotiateTargetInfo })
    )
    expect(() => createType3Message(noInfo, creds)).toThrow(/NTLMv1 is not supported/)
  })
})
