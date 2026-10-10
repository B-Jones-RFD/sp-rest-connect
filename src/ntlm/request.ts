/**
 * HTTP transport for NTLM-authenticated requests using only node:http/https.
 *
 * NTLM authenticates the TCP connection, not the request, so the three-leg
 * handshake (Type 1 -> 401 + Type 2 -> Type 3 + real request) must travel over
 * a single keep-alive socket. Each call gets its own Agent limited to one
 * socket, which is destroyed when the call completes.
 */
import http from 'node:http'
import https from 'node:https'
import type { IncomingHttpHeaders, OutgoingHttpHeaders } from 'node:http'
import {
  createType1Message,
  createType3Message,
  extractNtlmToken,
  parseType2Message,
  type NtlmCredentials,
} from './messages'

export interface NtlmRequestOptions extends NtlmCredentials {
  url: string
  headers?: Record<string, string | number>
  body?: string | Buffer
  /** Return the response body as a Buffer instead of a UTF-8 string. */
  binary?: boolean
  /** Socket inactivity timeout in milliseconds. */
  timeout?: number
}

export interface NtlmResponse {
  statusCode: number
  headers: IncomingHttpHeaders
  body: string | Buffer
}

interface RawResponse {
  statusCode: number
  headers: IncomingHttpHeaders
  body: Buffer
}

/** Headers managed by the handshake; caller-supplied copies are dropped. */
const RESERVED_HEADERS = new Set(['authorization', 'connection'])

function sanitizeHeaders(
  headers: Record<string, string | number> = {}
): OutgoingHttpHeaders {
  const out: OutgoingHttpHeaders = {}
  for (const [key, value] of Object.entries(headers)) {
    if (!RESERVED_HEADERS.has(key.toLowerCase())) out[key] = value
  }
  return out
}

function hasHeader(headers: OutgoingHttpHeaders, name: string): boolean {
  const lower = name.toLowerCase()
  return Object.keys(headers).some((k) => k.toLowerCase() === lower)
}

function send(
  client: typeof http | typeof https,
  url: URL,
  agent: http.Agent,
  method: string,
  headers: OutgoingHttpHeaders,
  body: string | Buffer | undefined,
  timeout: number | undefined
): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const payload =
      body === undefined
        ? undefined
        : Buffer.isBuffer(body)
        ? body
        : Buffer.from(body, 'utf8')

    if (!hasHeader(headers, 'content-length')) {
      headers['Content-Length'] = payload ? payload.length : 0
    }

    const req = client.request(url, { method, headers, agent }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('error', reject)
      res.on('end', () =>
        resolve({
          statusCode: res.statusCode ?? 0,
          headers: res.headers,
          body: Buffer.concat(chunks),
        })
      )
    })

    if (timeout !== undefined) {
      req.setTimeout(timeout, () => {
        req.destroy(new Error(`Request timed out after ${timeout}ms: ${url}`))
      })
    }

    req.on('error', reject)
    req.end(payload)
  })
}

export async function request(
  method: 'GET' | 'POST',
  options: NtlmRequestOptions
): Promise<NtlmResponse> {
  const url = new URL(options.url)
  const client = url.protocol === 'http:' ? http : https
  const agent = new client.Agent({ keepAlive: true, maxSockets: 1 })

  const credentials: NtlmCredentials = {
    username: options.username,
    password: options.password,
    domain: options.domain,
    workstation: options.workstation,
  }

  try {
    // Leg 1: negotiate. No body; the real payload only goes with Type 3.
    const challenge = await send(
      client,
      url,
      agent,
      method,
      {
        Connection: 'keep-alive',
        Authorization: createType1Message(credentials),
      },
      undefined,
      options.timeout
    )

    let final: RawResponse = challenge

    if (challenge.statusCode === 401) {
      const wwwAuthenticate = challenge.headers['www-authenticate']
      if (!wwwAuthenticate) {
        throw new Error(
          'www-authenticate not found on NTLM challenge response'
        )
      }
      // Throws if the header carries no NTLM token (e.g. Basic/Negotiate only).
      extractNtlmToken(wwwAuthenticate)
      const type2 = parseType2Message(wwwAuthenticate)

      // Leg 2: authenticate + perform the actual request on the same socket.
      final = await send(
        client,
        url,
        agent,
        method,
        {
          ...sanitizeHeaders(options.headers),
          Connection: 'close',
          Authorization: createType3Message(type2, credentials),
        },
        options.body,
        options.timeout
      )
    }

    return {
      statusCode: final.statusCode,
      headers: final.headers,
      body: options.binary ? final.body : final.body.toString('utf8'),
    }
  } finally {
    agent.destroy()
  }
}
