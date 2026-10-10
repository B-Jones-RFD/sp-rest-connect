/**
 * Minimal in-process NTLM server for integration tests. Replies 401 + Type 2
 * to any request that does not carry a Type 3 token, then serves the handler
 * once a well-formed Type 3 arrives on the same socket.
 */
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { NTLM_FLAGS } from '../src/ntlm/messages'

export const SERVER_CHALLENGE = Buffer.from('0123456789abcdef', 'hex')
export const TARGET_INFO = Buffer.from(
  '02000c0044006f006d00610069006e0001000c00530065007200760065007200' +
    '00000000',
  'hex'
)

export const V2_FLAGS =
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

export function buildType2(opts: {
  flags: number
  targetInfo?: Buffer
}): string {
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

export interface SeenRequest {
  method: string
  url: string
  headers: http.IncomingHttpHeaders
  body: Buffer
  /** Identity of the TCP socket this request arrived on. */
  socketId: number
  ntlmType: number | null
}

export interface NtlmTestServer {
  url: string
  requests: SeenRequest[]
  close(): Promise<void>
}

export type AuthenticatedHandler = (
  req: SeenRequest,
  res: http.ServerResponse
) => void

function ntlmMessageType(authorization?: string): number | null {
  if (!authorization?.startsWith('NTLM ')) return null
  const buf = Buffer.from(authorization.slice(5), 'base64')
  if (buf.length < 12 || buf.subarray(0, 8).toString('ascii') !== 'NTLMSSP\0')
    return null
  return buf.readUInt32LE(8)
}

export async function startNtlmServer(
  handler: AuthenticatedHandler,
  opts: { type2?: string; challengeHeader?: string } = {}
): Promise<NtlmTestServer> {
  const type2 =
    opts.type2 ?? buildType2({ flags: V2_FLAGS, targetInfo: TARGET_INFO })
  const requests: SeenRequest[] = []
  const sockets = new WeakMap<object, number>()
  let nextSocketId = 1

  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => {
      let socketId = sockets.get(req.socket)
      if (socketId === undefined) {
        socketId = nextSocketId++
        sockets.set(req.socket, socketId)
      }
      const seen: SeenRequest = {
        method: req.method ?? '',
        url: req.url ?? '',
        headers: req.headers,
        body: Buffer.concat(chunks),
        socketId,
        ntlmType: ntlmMessageType(req.headers.authorization),
      }
      requests.push(seen)

      if (seen.ntlmType === 3) {
        handler(seen, res)
      } else {
        res.statusCode = 401
        res.setHeader('WWW-Authenticate', opts.challengeHeader ?? type2)
        res.end()
      }
    })
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo

  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections()
        server.close((err) => (err ? reject(err) : resolve()))
      }),
  }
}
