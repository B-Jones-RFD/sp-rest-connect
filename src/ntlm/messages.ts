/**
 * NTLM message construction and parsing (MS-NLMP), NTLMv2 only.
 *
 * NTLMv1/LM responses are intentionally not implemented: they require
 * single-DES, which Node's OpenSSL 3 build no longer exposes, and modern
 * SharePoint servers negotiate extended security (and therefore NTLMv2).
 * A Type 2 message without target info is rejected rather than downgraded.
 */
import { createHmac, randomBytes } from 'node:crypto'
import { md4 } from './md4'

export const NTLM_FLAGS = {
  NegotiateUnicode: 0x00000001,
  NegotiateOEM: 0x00000002,
  RequestTarget: 0x00000004,
  NegotiateSign: 0x00000010,
  NegotiateSeal: 0x00000020,
  NegotiateNTLM: 0x00000200,
  NegotiateOemDomainSupplied: 0x00001000,
  NegotiateOemWorkstationSupplied: 0x00002000,
  NegotiateAlwaysSign: 0x00008000,
  TargetTypeDomain: 0x00010000,
  TargetTypeServer: 0x00020000,
  NegotiateExtendedSecurity: 0x00080000,
  NegotiateTargetInfo: 0x00800000,
  NegotiateVersion: 0x02000000,
  Negotiate128: 0x20000000,
  NegotiateKeyExchange: 0x40000000,
  Negotiate56: 0x80000000,
} as const

const TYPE1_FLAGS =
  NTLM_FLAGS.NegotiateUnicode |
  NTLM_FLAGS.NegotiateOEM |
  NTLM_FLAGS.RequestTarget |
  NTLM_FLAGS.NegotiateNTLM |
  NTLM_FLAGS.NegotiateOemDomainSupplied |
  NTLM_FLAGS.NegotiateOemWorkstationSupplied |
  NTLM_FLAGS.NegotiateAlwaysSign |
  NTLM_FLAGS.NegotiateExtendedSecurity |
  NTLM_FLAGS.NegotiateVersion |
  NTLM_FLAGS.Negotiate128 |
  NTLM_FLAGS.Negotiate56

const TYPE3_FLAGS =
  NTLM_FLAGS.NegotiateUnicode |
  NTLM_FLAGS.RequestTarget |
  NTLM_FLAGS.NegotiateNTLM |
  NTLM_FLAGS.NegotiateAlwaysSign |
  NTLM_FLAGS.NegotiateExtendedSecurity |
  NTLM_FLAGS.NegotiateTargetInfo |
  NTLM_FLAGS.NegotiateVersion |
  NTLM_FLAGS.Negotiate128 |
  NTLM_FLAGS.Negotiate56

const SIGNATURE = Buffer.from('NTLMSSP\0', 'ascii')

/** Mirrors the OS version block httpntlm sends (Windows 5.1 build 2600, NTLMSSP revision 15). */
const VERSION = Buffer.from([5, 1, 0x28, 0x0a, 0, 0, 0, 0x0f])

export interface NtlmCredentials {
  username: string
  password: string
  domain: string
  workstation: string
}

export interface Type2Message {
  negotiateFlags: number
  serverChallenge: Buffer
  targetName: string
  targetInfo: Buffer
}

/** Test seam: inject a fixed client nonce / timestamp for deterministic output. */
export interface Type3Options {
  clientChallenge?: Buffer
  timestamp?: Buffer
}

function writeSecurityBuffer(
  buf: Buffer,
  pos: number,
  length: number,
  offset: number
) {
  buf.writeUInt16LE(length, pos)
  buf.writeUInt16LE(length, pos + 2)
  buf.writeUInt32LE(offset, pos + 4)
}

function readSecurityBuffer(buf: Buffer, pos: number): Buffer {
  const length = buf.readUInt16LE(pos)
  const offset = buf.readUInt32LE(pos + 4)
  if (length === 0) return Buffer.alloc(0)
  if (offset + length > buf.length) {
    throw new Error('NTLM Type 2 security buffer exceeds message length')
  }
  return buf.subarray(offset, offset + length)
}

/** Current time as a Windows FILETIME (100ns intervals since 1601-01-01), 8 bytes LE. */
export function fileTimeNow(now: number = Date.now()): Buffer {
  const buf = Buffer.alloc(8)
  const ft = (BigInt(now) + 11644473600000n) * 10000n
  buf.writeBigUInt64LE(ft, 0)
  return buf
}

export function createType1Message({
  domain,
  workstation,
}: Pick<NtlmCredentials, 'domain' | 'workstation'>): string {
  const domainBuf = Buffer.from(domain.toUpperCase(), 'ascii')
  const wsBuf = Buffer.from(workstation.toUpperCase(), 'ascii')

  let flags = TYPE1_FLAGS
  if (domainBuf.length === 0) flags &= ~NTLM_FLAGS.NegotiateOemDomainSupplied
  if (wsBuf.length === 0) flags &= ~NTLM_FLAGS.NegotiateOemWorkstationSupplied

  const headerLen = 32 + VERSION.length // 40
  const buf = Buffer.alloc(headerLen + domainBuf.length + wsBuf.length)

  SIGNATURE.copy(buf, 0)
  buf.writeUInt32LE(1, 8)
  buf.writeUInt32LE(flags >>> 0, 12)
  writeSecurityBuffer(buf, 16, domainBuf.length, headerLen)
  writeSecurityBuffer(buf, 24, wsBuf.length, headerLen + domainBuf.length)
  VERSION.copy(buf, 32)
  domainBuf.copy(buf, headerLen)
  wsBuf.copy(buf, headerLen + domainBuf.length)

  return 'NTLM ' + buf.toString('base64')
}

/**
 * Extract the NTLM token from a WWW-Authenticate header. The header may list
 * several schemes (`Negotiate, NTLM TlRMTVNT...`) or be a bare `NTLM`
 * (a challenge-less prompt, which is an error at this stage).
 */
export function extractNtlmToken(header: string | string[]): string {
  const value = Array.isArray(header) ? header.join(', ') : header
  const match = /(?:^|[,\s])NTLM\s+([A-Za-z0-9+/=]+)/.exec(value)
  if (!match) {
    throw new Error(
      `WWW-Authenticate header does not contain an NTLM challenge: ${value}`
    )
  }
  return match[1]
}

export function parseType2Message(header: string | string[]): Type2Message {
  const buf = Buffer.from(extractNtlmToken(header), 'base64')

  if (buf.length < 32 || !buf.subarray(0, 8).equals(SIGNATURE)) {
    throw new Error('Invalid NTLM Type 2 message signature')
  }
  if (buf.readUInt32LE(8) !== 2) {
    throw new Error(
      `Expected NTLM Type 2 message, received type ${buf.readUInt32LE(8)}`
    )
  }

  const negotiateFlags = buf.readUInt32LE(20)
  const serverChallenge = Buffer.from(buf.subarray(24, 32))
  const unicode = (negotiateFlags & NTLM_FLAGS.NegotiateUnicode) !== 0

  const targetNameBuf = readSecurityBuffer(buf, 12)
  const targetName = targetNameBuf.toString(unicode ? 'utf16le' : 'ascii')

  let targetInfo = Buffer.alloc(0)
  if (negotiateFlags & NTLM_FLAGS.NegotiateTargetInfo && buf.length >= 48) {
    targetInfo = Buffer.from(readSecurityBuffer(buf, 40))
  }

  return { negotiateFlags, serverChallenge, targetName, targetInfo }
}

/** NTOWFv1: MD4 of the UTF-16LE password. */
export function ntHash(password: string): Buffer {
  return md4(Buffer.from(password, 'utf16le'))
}

/** NTOWFv2: HMAC-MD5(NTOWFv1(password), UTF-16LE(UPPER(user) + domain)). */
export function ntowfV2(
  username: string,
  password: string,
  domain: string
): Buffer {
  return createHmac('md5', ntHash(password))
    .update(Buffer.from(username.toUpperCase() + domain, 'utf16le'))
    .digest()
}

function hmacMd5(key: Buffer, ...data: Buffer[]): Buffer {
  const h = createHmac('md5', key)
  for (const d of data) h.update(d)
  return h.digest()
}

export function createType3Message(
  type2: Type2Message,
  credentials: NtlmCredentials,
  options: Type3Options = {}
): string {
  if (type2.targetInfo.length === 0) {
    throw new Error(
      'NTLM server did not send target info; NTLMv2 is required and NTLMv1 is not supported'
    )
  }

  const { username, password, domain, workstation } = credentials
  const clientChallenge = options.clientChallenge ?? randomBytes(8)
  const timestamp = options.timestamp ?? fileTimeNow()
  if (clientChallenge.length !== 8 || timestamp.length !== 8) {
    throw new Error('clientChallenge and timestamp must each be 8 bytes')
  }

  const responseKeyNT = ntowfV2(username, password, domain)

  // NTLMv2_CLIENT_CHALLENGE ("temp" / blob)
  const temp = Buffer.concat([
    Buffer.from([0x01, 0x01, 0, 0, 0, 0, 0, 0]), // RespType, HiRespType, Reserved1/2
    timestamp,
    clientChallenge,
    Buffer.alloc(4), // Reserved3
    type2.targetInfo,
    Buffer.alloc(4), // trailing zeros
  ])

  const ntProofStr = hmacMd5(responseKeyNT, type2.serverChallenge, temp)
  const ntResponse = Buffer.concat([ntProofStr, temp])

  const lmResponse = Buffer.concat([
    hmacMd5(responseKeyNT, type2.serverChallenge, clientChallenge),
    clientChallenge,
  ])

  const domainBuf = Buffer.from(domain, 'utf16le')
  const userBuf = Buffer.from(username, 'utf16le')
  const wsBuf = Buffer.from(workstation, 'utf16le')
  const sessionKey = Buffer.alloc(0)

  const headerLen = 64 + VERSION.length // 72
  const buf = Buffer.alloc(
    headerLen +
      domainBuf.length +
      userBuf.length +
      wsBuf.length +
      lmResponse.length +
      ntResponse.length
  )

  SIGNATURE.copy(buf, 0)
  buf.writeUInt32LE(3, 8)

  let offset = headerLen
  const place = (pos: number, data: Buffer) => {
    writeSecurityBuffer(buf, pos, data.length, offset)
    data.copy(buf, offset)
    offset += data.length
  }

  // Payload order: domain, user, workstation, LM, NT, session key
  place(28, domainBuf)
  place(36, userBuf)
  place(44, wsBuf)
  place(12, lmResponse)
  place(20, ntResponse)
  place(52, sessionKey)

  buf.writeUInt32LE(TYPE3_FLAGS >>> 0, 60)
  VERSION.copy(buf, 64)

  return 'NTLM ' + buf.toString('base64')
}
