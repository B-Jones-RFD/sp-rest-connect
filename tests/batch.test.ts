import { describe, it, expect } from 'vitest'
import {
  buildBatchBody,
  multipartBoundary,
  parseBatchResponse,
} from '../src/batch'

const CRLF = '\r\n'

describe('buildBatchBody', () => {
  it('puts reads in their own parts and groups consecutive writes in one changeset', () => {
    const body = buildBatchBody(
      [
        { method: 'GET', path: 'x', url: 'https://sp/_api/a' },
        { method: 'POST', path: 'x', url: 'https://sp/_api/b', body: { T: 1 } },
        {
          method: 'MERGE',
          path: 'x',
          url: 'https://sp/_api/c',
          body: '{"T":2}',
          headers: { 'If-Match': '"3"' },
        },
        { method: 'GET', path: 'x', url: 'https://sp/_api/d' },
        { method: 'DELETE', path: 'x', url: 'https://sp/_api/e' },
      ],
      'batch_1'
    )

    const top = body.split('--batch_1')
    // preamble, GET, changeset(POST+MERGE), GET, changeset(DELETE), closing "--"
    expect(top).toHaveLength(6)
    expect(top[5]).toBe(`--${CRLF}`)

    expect(top[1]).toContain('Content-Type: application/http')
    expect(top[1]).toContain(`GET https://sp/_api/a HTTP/1.1${CRLF}`)
    expect(top[1]).toContain('Accept: application/json;odata=nometadata')
    expect(top[1]).not.toContain('If-Match')

    const changeset = /boundary=(changeset_[\w-]+)/.exec(top[2])?.[1]
    expect(changeset).toBeDefined()
    const inner = top[2].split(`--${changeset}`)
    expect(inner).toHaveLength(4) // header, POST, MERGE, closing
    expect(inner[1]).toContain(`POST https://sp/_api/b HTTP/1.1`)
    expect(inner[1]).toContain('Content-Type: application/json;odata=verbose')
    expect(inner[1]).toContain(`${CRLF}${CRLF}{"T":1}${CRLF}`)
    expect(inner[2]).toContain(`MERGE https://sp/_api/c HTTP/1.1`)
    expect(inner[2]).toContain('If-Match: "3"') // caller override wins
    expect(inner[2]).not.toContain('If-Match: *')

    expect(top[4]).toContain('DELETE https://sp/_api/e HTTP/1.1')
    expect(top[4]).toContain('If-Match: *')
    // Every line break is CRLF, as the multipart spec requires.
    expect(body.replace(/\r\n/g, '')).not.toContain('\n')
  })
})

describe('multipartBoundary', () => {
  it('extracts quoted and unquoted boundaries', () => {
    expect(
      multipartBoundary('multipart/mixed; boundary=batchresponse_abc')
    ).toBe('batchresponse_abc')
    expect(
      multipartBoundary('multipart/mixed; boundary="b 1"; charset=utf-8')
    ).toBe('b 1')
    expect(multipartBoundary('application/json')).toBeUndefined()
    expect(multipartBoundary(undefined)).toBeUndefined()
  })
})

describe('parseBatchResponse', () => {
  const part = (status: string, headers: string, body: string) =>
    [
      'Content-Type: application/http',
      'Content-Transfer-Encoding: binary',
      '',
      `HTTP/1.1 ${status}`,
      headers,
      '',
      body,
      '',
    ].join(CRLF)

  it('parses flat parts in order, decoding JSON when possible', () => {
    const b = 'batchresponse_1'
    const text =
      `--${b}${CRLF}` +
      part(
        '200 OK',
        'CONTENT-TYPE: application/json;odata=nometadata;streaming=true;charset=utf-8',
        '{"value":[1,2]}'
      ) +
      `--${b}${CRLF}` +
      part(
        '404 Not Found',
        'CONTENT-TYPE: application/json;odata=nometadata',
        '{"odata.error":{"message":{"value":"nope"}}}'
      ) +
      `--${b}${CRLF}` +
      part('204 No Content', 'X-Foo: bar', '') +
      `--${b}--${CRLF}`
    const out = parseBatchResponse(text, `multipart/mixed; boundary=${b}`)
    expect(out).toHaveLength(3)
    expect(out[0]).toMatchObject({
      status: 200,
      ok: true,
      json: { value: [1, 2] },
    })
    expect(out[0].headers['content-type']).toContain('application/json')
    expect(out[1]).toMatchObject({
      status: 404,
      ok: false,
      json: { 'odata.error': { message: { value: 'nope' } } },
    })
    expect(out[2]).toMatchObject({ status: 204, ok: true, body: '' })
    expect(out[2].json).toBeUndefined()
    expect(out[2].headers['x-foo']).toBe('bar')
  })

  it('flattens nested changeset responses and tolerates LF-only bodies', () => {
    const b = 'batchresponse_outer'
    const c = 'changesetresponse_inner'
    const text = [
      `--${b}`,
      `Content-Type: multipart/mixed; boundary=${c}`,
      '',
      `--${c}`,
      part(
        '201 Created',
        'Content-Type: application/json;odata=nometadata',
        '{"Id":9}'
      ).replace(/\r\n/g, '\n'),
      `--${c}`,
      part('204 No Content', '', '').replace(/\r\n/g, '\n'),
      `--${c}--`,
      `--${b}`,
      part('200 OK', 'Content-Type: application/json', '{"value":[]}').replace(
        /\r\n/g,
        '\n'
      ),
      `--${b}--`,
      '',
    ].join('\n')
    const out = parseBatchResponse(text, `multipart/mixed; boundary=${b}`)
    expect(out.map((r) => r.status)).toEqual([201, 204, 200])
    expect(out[0].json).toEqual({ Id: 9 })
    expect(out[2].json).toEqual({ value: [] })
  })

  it('leaves json undefined for unparsable JSON bodies', () => {
    const b = 'x'
    const text =
      `--${b}${CRLF}` +
      part('500 Error', 'Content-Type: application/json', 'not json') +
      `--${b}--${CRLF}`
    const [r] = parseBatchResponse(text, `multipart/mixed; boundary=${b}`)
    expect(r).toMatchObject({ status: 500, ok: false, body: 'not json' })
    expect(r.json).toBeUndefined()
  })

  it('throws when the response is not multipart', () => {
    expect(() => parseBatchResponse('{}', 'application/json')).toThrow(
      /not multipart/
    )
  })
})
