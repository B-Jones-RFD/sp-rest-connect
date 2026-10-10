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
import type {
  IncomingHttpHeaders,
  IncomingMessage,
  OutgoingHttpHeaders,
} from 'node:http'
import { Readable } from 'node:stream'
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
  /** Request body. A `Readable` is piped (chunked unless a Content-Length header is supplied) and can only be sent once. */
  body?: string | Buffer | Readable
  /** Return the response body as a Buffer instead of a UTF-8 string. */
  binary?: boolean
  /**
   * Return a 2xx response body as a `Readable` instead of buffering it. Non-2xx
   * bodies are still buffered so errors can be reported. The socket is released
   * when the stream closes.
   */
  stream?: boolean
  /** Socket inactivity timeout in milliseconds. */
  timeout?: number
  /** Cancels the request; rejects with an `AbortError`. */
  signal?: AbortSignal
  /** Extra agent options (TLS, DNS, local address). `keepAlive`/`maxSockets` are fixed. */
  agentOptions?: https.AgentOptions
}

/** Raised when the socket is idle for longer than `timeout`. */
export class TimeoutError extends Error {
  readonly name = 'TimeoutError'
  readonly code = 'ETIMEDOUT'
}

export interface NtlmResponse {
  statusCode: number
  headers: IncomingHttpHeaders
  body: string | Buffer | Readable
}

interface RawResponse {
  statusCode: number
  headers: IncomingHttpHeaders
  body: Buffer
  /** Set instead of `body` when streaming a 2xx response. */
  stream?: IncomingMessage
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
  body: string | Buffer | Readable | undefined,
  timeout: number | undefined,
  signal: AbortSignal | undefined,
  streamResponse = false
): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const payload =
      body === undefined || body instanceof Readable
        ? body
        : Buffer.isBuffer(body)
          ? body
          : Buffer.from(body, 'utf8')

    // A Readable without a known length goes out chunked.
    if (
      !(payload instanceof Readable) &&
      !hasHeader(headers, 'content-length')
    ) {
      headers['Content-Length'] = payload ? payload.length : 0
    }

    const req = client.request(
      url,
      { method, headers, agent, signal },
      (res) => {
        const statusCode = res.statusCode ?? 0
        if (streamResponse && statusCode >= 200 && statusCode <= 299) {
          resolve({
            statusCode,
            headers: res.headers,
            body: Buffer.alloc(0),
            stream: res,
          })
          return
        }
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('error', reject)
        res.on('end', () =>
          resolve({
            statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks),
          })
        )
      }
    )

    if (timeout !== undefined) {
      req.setTimeout(timeout, () => {
        req.destroy(
          new TimeoutError(`Request timed out after ${timeout}ms: ${url}`)
        )
      })
    }

    req.on('error', reject)
    if (payload instanceof Readable) {
      payload.once('error', (err) => req.destroy(err))
      payload.pipe(req)
    } else {
      req.end(payload)
    }
  })
}

interface Session {
  client: typeof http | typeof https
  url: URL
  agent: http.Agent
  credentials: NtlmCredentials
}

function openSession(options: NtlmRequestOptions): Session {
  const url = new URL(options.url)
  const client = url.protocol === 'http:' ? http : https
  const agent = new client.Agent({
    ...options.agentOptions,
    keepAlive: true,
    maxSockets: 1,
  })
  const credentials: NtlmCredentials = {
    username: options.username,
    password: options.password,
    domain: options.domain,
    workstation: options.workstation,
  }
  return { client, url, agent, credentials }
}

/**
 * Leg 1 of the handshake: send a Type 1 message and return the server's
 * response. When the server answers 401 with an NTLM challenge, `type3` holds
 * the `Authorization` value for leg 2; otherwise it is `undefined` and the
 * response is final (anonymous access, or a non-NTLM auth scheme).
 */
async function negotiate(
  session: Session,
  method: string,
  timeout: number | undefined,
  signal: AbortSignal | undefined
): Promise<{ challenge: RawResponse; type3?: string }> {
  const challenge = await send(
    session.client,
    session.url,
    session.agent,
    method,
    {
      Connection: 'keep-alive',
      Authorization: createType1Message(session.credentials),
    },
    undefined,
    timeout,
    signal
  )

  if (challenge.statusCode !== 401) return { challenge }

  const wwwAuthenticate = challenge.headers['www-authenticate']
  if (!wwwAuthenticate) {
    throw new Error('www-authenticate not found on NTLM challenge response')
  }
  // Throws if the header carries no NTLM token (e.g. Basic/Negotiate only).
  extractNtlmToken(wwwAuthenticate)
  const type2 = parseType2Message(wwwAuthenticate)
  return {
    challenge,
    type3: createType3Message(type2, session.credentials),
  }
}

export async function request(
  method: 'GET' | 'POST',
  options: NtlmRequestOptions
): Promise<NtlmResponse> {
  const session = openSession(options)
  let streaming = false

  try {
    // Leg 1: negotiate. No body; the real payload only goes with Type 3.
    const { challenge, type3 } = await negotiate(
      session,
      method,
      options.timeout,
      options.signal
    )

    let final: RawResponse = challenge

    if (type3 !== undefined) {
      // Leg 2: authenticate + perform the actual request on the same socket.
      final = await send(
        session.client,
        session.url,
        session.agent,
        method,
        {
          ...sanitizeHeaders(options.headers),
          Connection: 'close',
          Authorization: type3,
        },
        options.body,
        options.timeout,
        options.signal,
        options.stream
      )
    }

    if (final.stream) {
      // Hand the socket's lifetime to the consumer; release it when done.
      streaming = true
      const agent = session.agent
      final.stream.once('close', () => agent.destroy())
      return {
        statusCode: final.statusCode,
        headers: final.headers,
        body: final.stream,
      }
    }

    return {
      statusCode: final.statusCode,
      headers: final.headers,
      body: options.binary ? final.body : final.body.toString('utf8'),
    }
  } finally {
    if (!streaming) session.agent.destroy()
  }
}

/**
 * Performs only the negotiate leg against `url` and returns the Type 3
 * `Authorization` header value that would be sent in leg 2. Diagnostic use:
 * verifies credentials and server challenge without issuing a real request.
 */
export async function authenticate(
  options: NtlmRequestOptions
): Promise<string> {
  const session = openSession(options)
  try {
    const { challenge, type3 } = await negotiate(
      session,
      'GET',
      options.timeout,
      options.signal
    )
    if (type3 === undefined) {
      throw new Error(
        `Server did not issue an NTLM challenge (HTTP ${challenge.statusCode})`
      )
    }
    return type3
  } finally {
    session.agent.destroy()
  }
}
