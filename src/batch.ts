/**
 * OData `$batch` multipart encoding and decoding, independent of transport.
 * SharePoint 2016+ and Subscription Edition support `/_api/$batch`;
 * SharePoint 2013 does not.
 */
import { randomUUID } from 'node:crypto'
import type { BatchRequest, BatchResponse } from './types'

const CRLF = '\r\n'
const WRITE_METHODS = new Set(['POST', 'PATCH', 'MERGE', 'DELETE'])

export interface ResolvedBatchRequest extends BatchRequest {
  /** Absolute URL of the sub-request. */
  url: string
}

export function newBoundary(prefix: string): string {
  return `${prefix}_${randomUUID()}`
}

function serialiseBody(body: BatchRequest['body']): string | undefined {
  if (body === undefined) return undefined
  return typeof body === 'string' ? body : JSON.stringify(body)
}

function headerBlock(headers: Record<string, string>): string {
  return Object.entries(headers)
    .map(([k, v]) => `${k}: ${v}`)
    .join(CRLF)
}

/** One `application/http` part containing a single sub-request. */
function httpPart(req: ResolvedBatchRequest): string {
  const method = req.method.toUpperCase()
  const body = serialiseBody(req.body)
  const headers: Record<string, string> = {
    Accept: 'application/json;odata=nometadata',
  }
  if (body !== undefined)
    headers['Content-Type'] = 'application/json;odata=verbose'
  if (method === 'PATCH' || method === 'MERGE' || method === 'DELETE') {
    headers['If-Match'] = '*'
  }
  for (const [k, v] of Object.entries(req.headers ?? {})) headers[k] = v

  const lines = [
    'Content-Type: application/http',
    'Content-Transfer-Encoding: binary',
    '',
    `${method} ${req.url} HTTP/1.1`,
    headerBlock(headers),
    '',
  ]
  if (body !== undefined) lines.push(body)
  lines.push('')
  return lines.join(CRLF)
}

/**
 * Builds the multipart body for `/_api/$batch`. Reads are individual parts;
 * each run of consecutive writes is wrapped in one changeset, as OData
 * requires. Order is preserved so responses can be matched to requests.
 */
export function buildBatchBody(
  requests: ResolvedBatchRequest[],
  boundary: string
): string {
  const parts: string[] = []
  let i = 0
  while (i < requests.length) {
    const req = requests[i]
    if (!WRITE_METHODS.has(req.method.toUpperCase())) {
      parts.push(`--${boundary}${CRLF}${httpPart(req)}`)
      i++
      continue
    }
    const changeset = newBoundary('changeset')
    const inner: string[] = []
    while (
      i < requests.length &&
      WRITE_METHODS.has(requests[i].method.toUpperCase())
    ) {
      inner.push(`--${changeset}${CRLF}${httpPart(requests[i])}`)
      i++
    }
    parts.push(
      `--${boundary}${CRLF}Content-Type: multipart/mixed; boundary=${changeset}${CRLF}${CRLF}` +
        inner.join('') +
        `--${changeset}--${CRLF}`
    )
  }
  return parts.join('') + `--${boundary}--${CRLF}`
}

/** Extracts `boundary=...` from a multipart Content-Type header. */
export function multipartBoundary(
  contentType: string | undefined
): string | undefined {
  if (!contentType) return undefined
  const match = /boundary="?([^";]+)"?/i.exec(contentType)
  return match ? match[1] : undefined
}

function splitHeadBody(text: string): [string, string] {
  const idx = text.indexOf('\n\n')
  if (idx === -1) return [text, '']
  return [text.slice(0, idx), text.slice(idx + 2)]
}

function parseHeaders(block: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of block.split('\n')) {
    const i = line.indexOf(':')
    if (i > 0)
      out[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim()
  }
  return out
}

function parseHttpPart(text: string): BatchResponse {
  const [head, rawBody] = splitHeadBody(text)
  const [statusLine, ...headerLines] = head.split('\n')
  const status = Number(
    /^HTTP\/\d(?:\.\d)?\s+(\d{3})/.exec(statusLine)?.[1] ?? 0
  )
  const headers = parseHeaders(headerLines.join('\n'))
  const body = rawBody.replace(/\n+$/, '')
  const response: BatchResponse = {
    status,
    ok: status >= 200 && status <= 299,
    headers,
    body,
  }
  if (body.length > 0 && /json/i.test(headers['content-type'] ?? '')) {
    try {
      response.json = JSON.parse(body)
    } catch {
      /* leave json undefined; body is still available */
    }
  }
  return response
}

function parseMultipart(text: string, boundary: string): BatchResponse[] {
  const results: BatchResponse[] = []
  const delimiter = `--${boundary}`
  const segments = text.split(delimiter)
  // segments[0] is the preamble; the last is the epilogue after `--`.
  for (const segment of segments.slice(1)) {
    if (segment.startsWith('--')) break
    const part = segment.replace(/^\n/, '')
    const [head, body] = splitHeadBody(part)
    const headers = parseHeaders(head)
    const type = headers['content-type'] ?? ''
    if (/multipart\/mixed/i.test(type)) {
      const inner = multipartBoundary(type)
      if (inner) results.push(...parseMultipart(body, inner))
    } else if (/application\/http/i.test(type)) {
      results.push(parseHttpPart(body))
    }
  }
  return results
}

/**
 * Parses a `$batch` response body into one {@link BatchResponse} per
 * sub-request, flattening changeset responses, in order.
 */
export function parseBatchResponse(
  body: string,
  contentType: string | undefined
): BatchResponse[] {
  const boundary = multipartBoundary(contentType)
  if (!boundary) throw new Error('Batch response is not multipart/mixed')
  return parseMultipart(body.replace(/\r\n/g, '\n'), boundary)
}
