import { describe, it, expect, afterEach } from 'vitest'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { request } from '../src/ntlm/request'
import { get, post, auth } from '../src/ntlm'
import {
  startNtlmServer,
  buildType2,
  V2_FLAGS,
  type NtlmTestServer,
} from './ntlm-server'
import { NTLM_FLAGS } from '../src/ntlm/messages'

const creds = {
  username: 'User',
  password: 'Password',
  domain: 'Domain',
  workstation: 'COMPUTER',
}

let server: NtlmTestServer | undefined
afterEach(async () => {
  await server?.close()
  server = undefined
})

describe('request handshake', () => {
  it('completes the three-leg handshake on a single socket', async () => {
    server = await startNtlmServer((req, res) => {
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ value: [1, 2, 3] }))
    })

    const res = await request('GET', {
      ...creds,
      url: `${server.url}/_api/web/lists`,
      headers: { Accept: 'application/json; odata=nometadata' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.body).toBe('{"value":[1,2,3]}')

    expect(server.requests.map((r) => r.ntlmType)).toEqual([1, 3])
    const [leg1, leg2] = server.requests
    expect(leg1.socketId).toBe(leg2.socketId)
    expect(leg1.headers.connection?.toLowerCase()).toBe('keep-alive')
    expect(leg2.headers.connection?.toLowerCase()).toBe('close')
    // Caller headers only ride on the Type 3 leg
    expect(leg1.headers.accept).toBeUndefined()
    expect(leg2.headers.accept).toBe('application/json; odata=nometadata')
  })

  it('sends the body only with the Type 3 request and preserves method', async () => {
    server = await startNtlmServer((req, res) => {
      res.end(`echo:${req.body.toString('utf8')}`)
    })

    const res = await request('POST', {
      ...creds,
      url: `${server.url}/_api/web/lists/add`,
      headers: { 'Content-Type': 'application/json', 'X-RequestDigest': 'abc' },
      body: '{"Title":"x"}',
    })

    expect(res.body).toBe('echo:{"Title":"x"}')
    const [leg1, leg2] = server.requests
    expect(leg1.method).toBe('POST')
    expect(leg1.body.length).toBe(0)
    expect(leg1.headers['content-length']).toBe('0')
    expect(leg2.body.toString()).toBe('{"Title":"x"}')
    expect(leg2.headers['content-length']).toBe('13')
    expect(leg2.headers['x-requestdigest']).toBe('abc')
  })

  it('returns a Buffer when binary is set', async () => {
    const payload = Buffer.from([0x00, 0xff, 0x10, 0x80])
    server = await startNtlmServer((_req, res) => {
      res.setHeader('Content-Type', 'application/octet-stream')
      res.end(payload)
    })

    const res = await request('GET', {
      ...creds,
      url: `${server.url}/file`,
      binary: true,
    })
    expect(Buffer.isBuffer(res.body)).toBe(true)
    expect((res.body as Buffer).equals(payload)).toBe(true)
  })

  it('drops caller-supplied Authorization and Connection headers', async () => {
    server = await startNtlmServer((_req, res) => res.end('ok'))
    await request('GET', {
      ...creds,
      url: `${server.url}/x`,
      headers: { authorization: 'Basic nope', connection: 'upgrade' },
    })
    const leg2 = server.requests[1]
    expect(leg2.ntlmType).toBe(3)
    expect(leg2.headers.connection?.toLowerCase()).toBe('close')
  })

  it('passes through a non-401 first response without authenticating', async () => {
    const http = await import('node:http')
    const plain = http.createServer((_req, res) => res.end('anonymous'))
    await new Promise<void>((r) => plain.listen(0, '127.0.0.1', r))
    const { port } = plain.address() as import('node:net').AddressInfo
    try {
      const res = await request('GET', {
        ...creds,
        url: `http://127.0.0.1:${port}/`,
      })
      expect(res.statusCode).toBe(200)
      expect(res.body).toBe('anonymous')
    } finally {
      plain.closeAllConnections()
      await new Promise<void>((r) => plain.close(() => r()))
    }
  })

  it('rejects when the 401 carries no NTLM challenge', async () => {
    server = await startNtlmServer((_req, res) => res.end('never'), {
      challengeHeader: 'Basic realm="sp"',
    })
    await expect(
      request('GET', { ...creds, url: `${server.url}/` })
    ).rejects.toThrow(/does not contain an NTLM challenge/)
  })

  it('rejects instead of downgrading when target info is absent', async () => {
    server = await startNtlmServer((_req, res) => res.end('never'), {
      type2: buildType2({ flags: V2_FLAGS & ~NTLM_FLAGS.NegotiateTargetInfo }),
    })
    await expect(
      request('GET', { ...creds, url: `${server.url}/` })
    ).rejects.toThrow(/NTLMv1 is not supported/)
  })

  it('times out when the server stalls', async () => {
    server = await startNtlmServer(() => {
      /* never respond */
    })
    await expect(
      request('GET', { ...creds, url: `${server.url}/slow`, timeout: 200 })
    ).rejects.toThrow(/timed out after 200ms/)
  })
})

describe('get / post / auth wrappers', () => {
  it('get resolves the body on 2xx', async () => {
    server = await startNtlmServer((_req, res) => res.end('{"value":[]}'))
    await expect(get({ ...creds, url: `${server.url}/` })).resolves.toBe(
      '{"value":[]}'
    )
  })

  it('post rejects with the body text on non-2xx', async () => {
    server = await startNtlmServer((_req, res) => {
      res.statusCode = 500
      res.end('boom')
    })
    await expect(
      post({ ...creds, url: `${server.url}/`, body: '' })
    ).rejects.toThrow('boom')
  })

  it('auth returns a Type 3 header string', async () => {
    server = await startNtlmServer((_req, res) => res.end('unused'))
    const token = await auth({ ...creds, url: `${server.url}/` })
    expect(token.startsWith('NTLM ')).toBe(true)
    const buf = Buffer.from(token.slice(5), 'base64')
    expect(buf.readUInt32LE(8)).toBe(3)
    expect(server.requests).toHaveLength(1)
    expect(server.requests[0].ntlmType).toBe(1)
  })

  it('auth rejects when the server does not issue an NTLM challenge', async () => {
    server = await startNtlmServer((_req, res) => res.end('ok'), {
      anonymous: true,
    })
    await expect(auth({ ...creds, url: `${server.url}/` })).rejects.toThrow(
      /did not issue an NTLM challenge \(HTTP 200\)/
    )
  })

  it('auth honours timeout', async () => {
    // auth() only sends leg 1, so the server must stall before challenging.
    const silent = http.createServer(() => {
      /* never respond */
    })
    await new Promise<void>((r) => silent.listen(0, '127.0.0.1', r))
    const { port } = silent.address() as AddressInfo
    try {
      await expect(
        auth({ ...creds, url: `http://127.0.0.1:${port}/slow`, timeout: 200 })
      ).rejects.toThrow(/timed out after 200ms/)
    } finally {
      silent.closeAllConnections()
      await new Promise<void>((r) => silent.close(() => r()))
    }
  })
})
