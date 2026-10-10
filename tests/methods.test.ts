import { describe, it, expect, afterEach } from 'vitest'
import http from 'node:http'
import os from 'node:os'
import type { AddressInfo } from 'node:net'
import { createSiteConnection } from '../src'
import type { PageResult, SiteConnection, SiteConnectionOptions } from '../src'
import { failure, success } from '../src/utils'
import { formatError } from './test-utils'
import {
  startNtlmServer,
  type NtlmTestServer,
  type SeenRequest,
} from './ntlm-server'

const CREDS = {
  username: 'User',
  password: 'Password',
  domain: 'Domain',
  hostname: 'COMPUTER',
}
const SITE_PATH = '/sites/test'
const DIGEST = 'digest-123'

let server: NtlmTestServer | undefined
afterEach(async () => {
  await server?.close()
  server = undefined
})

/** Start the NTLM test server and build a connection pointed at it. */
async function connect(
  handler: Parameters<typeof startNtlmServer>[0],
  overrides: Partial<SiteConnectionOptions> = {}
): Promise<{ sp: SiteConnection; server: NtlmTestServer }> {
  server = await startNtlmServer(handler)
  const sp = createSiteConnection({
    ...CREDS,
    protocol: 'http',
    site: server.url.replace(/^http:\/\//, ''),
    serverRelativeUrl: SITE_PATH,
    ...overrides,
  })
  return { sp, server }
}

const json =
  (body: unknown, status = 200) =>
  (_req: SeenRequest, res: http.ServerResponse) => {
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json')
    res.end(typeof body === 'string' ? body : JSON.stringify(body))
  }

/** The authenticated (Type 3) leg is the request SharePoint actually serves. */
function authenticatedLeg(s: NtlmTestServer): SeenRequest {
  const leg = s.requests.find((r) => r.ntlmType === 3)
  if (!leg) throw new Error('No Type 3 request reached the server')
  return leg
}

function path(req: SeenRequest): string {
  return decodeURIComponent(req.url)
}

/** Read a UTF-16 security buffer field out of a Type 3 Authorization header. */
function type3Field(req: SeenRequest, pos: number): string {
  const header = req.headers.authorization ?? ''
  const buf = Buffer.from(header.slice('NTLM '.length), 'base64')
  const len = buf.readUInt16LE(pos)
  const off = buf.readUInt32LE(pos + 4)
  return buf.subarray(off, off + len).toString('utf16le')
}
const T3_DOMAIN = 28
const T3_USER = 36
const T3_WORKSTATION = 44

describe('createSiteConnection', () => {
  it('exposes every method as a function', () => {
    const sp = createSiteConnection({
      ...CREDS,
      site: 'sp.example.com',
      serverRelativeUrl: SITE_PATH,
    })
    expect(Object.keys(sp).sort()).toEqual([
      'addAttachmentToListItem',
      'addDocumentToLibrary',
      'addListItem',
      'checkFolderExistsInLibrary',
      'createFolderInLibrary',
      'deleteDocumentFromLibrary',
      'deleteListItem',
      'getAllFolderContents',
      'getAllListContents',
      'getAuthToken',
      'getDocumentFromLibrary',
      'getFolderContents',
      'getFormDigestValue',
      'getListContents',
      'getListItem',
      'getListItemType',
      'getNextPage',
      'iterateFolderContents',
      'iterateListContents',
      'updateListItem',
    ])
    for (const fn of Object.values(sp)) expect(typeof fn).toBe('function')
  })

  it('sends the configured credentials in the Type 3 message', async () => {
    const { sp, server } = await connect(json({ Id: 1 }))
    await sp.getListItem({ listName: 'Tasks', spId: 1 })
    const leg = authenticatedLeg(server)
    expect(type3Field(leg, T3_USER)).toBe('User')
    expect(type3Field(leg, T3_DOMAIN)).toBe('Domain')
    expect(type3Field(leg, T3_WORKSTATION)).toBe('COMPUTER')
  })

  it('defaults domain to empty and hostname to os.hostname()', async () => {
    const { sp, server } = await connect(json({ Id: 1 }), {
      domain: undefined,
      hostname: undefined,
    })
    await sp.getListItem({ listName: 'Tasks', spId: 1 })
    const leg = authenticatedLeg(server)
    expect(type3Field(leg, T3_DOMAIN)).toBe('')
    expect(type3Field(leg, T3_WORKSTATION)).toBe(os.hostname())
  })

  it('defaults protocol to https', async () => {
    // A plain HTTP server rejects a TLS handshake, so an https default
    // surfaces as a transport error rather than a successful round trip.
    const plain = http.createServer((_req, res) => res.end('plain'))
    await new Promise<void>((r) => plain.listen(0, '127.0.0.1', r))
    const { port } = plain.address() as AddressInfo
    try {
      const sp = createSiteConnection({
        ...CREDS,
        site: `127.0.0.1:${port}`,
        serverRelativeUrl: SITE_PATH,
      })
      const result = await sp.getListItem({ listName: 'Tasks', spId: 1 })
      expect(result.success).toBe(false)
      expect((result as { error: string }).error).toMatch(
        /^Error in getListItem: /
      )
    } finally {
      plain.closeAllConnections()
      await new Promise<void>((r) => plain.close(() => r()))
    }
  })
})

describe('shared behaviour', () => {
  it('passes timeout through to the transport', async () => {
    const { sp } = await connect(() => {
      /* stall */
    })
    const result = await sp.getListItem({
      listName: 'Tasks',
      spId: 1,
      timeout: 100,
    })
    expect(result).toStrictEqual({
      success: false,
      code: 'TIMEOUT',
      error: expect.stringMatching(
        /^Error in getListItem: .*timed out after 100ms/
      ),
    })
  })

  it('wraps non-2xx responses as an HTTP failure carrying status and body', async () => {
    const { sp } = await connect(json('{"not":"an odata error"}', 500))
    const result = await sp.getListItem({ listName: 'Tasks', spId: 1 })
    expect(result).toStrictEqual({
      success: false,
      code: 'HTTP',
      status: 500,
      error: 'Error in getListItem: HTTP 500: {"not":"an odata error"}',
    })
  })

  it('parses the SharePoint error body into details', async () => {
    const { sp } = await connect(
      json(
        {
          'odata.error': {
            code: '-2147024809, System.ArgumentException',
            message: { lang: 'en-US', value: "List 'Tasks' does not exist" },
          },
        },
        404
      )
    )
    const result = await sp.getListItem({ listName: 'Tasks', spId: 1 })
    expect(result).toStrictEqual({
      success: false,
      code: 'HTTP',
      status: 404,
      error: "Error in getListItem: HTTP 404: List 'Tasks' does not exist",
      details: {
        code: '-2147024809, System.ArgumentException',
        message: "List 'Tasks' does not exist",
      },
    })
  })

  it('classifies 401 and 403 as AUTH', async () => {
    const { sp } = await connect(json('', 403))
    const result = await sp.getListItem({ listName: 'Tasks', spId: 1 })
    expect(result).toMatchObject({ success: false, code: 'AUTH', status: 403 })
  })

  it('classifies a refused connection as NETWORK', async () => {
    const probe = http.createServer()
    await new Promise<void>((r) => probe.listen(0, '127.0.0.1', r))
    const { port } = probe.address() as AddressInfo
    await new Promise<void>((r) => probe.close(() => r()))
    const sp = createSiteConnection({
      ...CREDS,
      protocol: 'http',
      site: `127.0.0.1:${port}`,
      serverRelativeUrl: SITE_PATH,
    })
    const result = await sp.getListItem({ listName: 'Tasks', spId: 1 })
    expect(result).toMatchObject({ success: false, code: 'NETWORK' })
    expect((result as { error: string }).error).toMatch(/ECONNREFUSED/)
  })

  it('honours an AbortSignal and classifies it as ABORTED', async () => {
    const { sp } = await connect(() => {
      /* stall */
    })
    const controller = new AbortController()
    const pending = sp.getListItem({
      listName: 'Tasks',
      spId: 1,
      signal: controller.signal,
    })
    setTimeout(() => controller.abort(), 20)
    const result = await pending
    expect(result).toMatchObject({ success: false, code: 'ABORTED' })
  })

  it('fails immediately when given an already-aborted signal', async () => {
    const { sp } = await connect(json({ Id: 1 }))
    const result = await sp.getListItem({
      listName: 'Tasks',
      spId: 1,
      signal: AbortSignal.abort(),
    })
    expect(result).toMatchObject({ success: false, code: 'ABORTED' })
  })

  it('passes agentOptions through to the socket layer', async () => {
    const seen: string[] = []
    const lookup: import('node:net').LookupFunction = (hostname, _o, cb) => {
      seen.push(hostname)
      cb(null, [{ address: '127.0.0.1', family: 4 }])
    }
    // A host *name* (not an IP) forces the agent through `lookup`.
    const { server } = await connect(json({ Id: 1 }))
    const named = createSiteConnection({
      ...CREDS,
      protocol: 'http',
      site: `sharepoint.test:${new URL(server.url).port}`,
      serverRelativeUrl: SITE_PATH,
      agentOptions: { lookup },
    })
    const result = await named.getListItem({ listName: 'Tasks', spId: 1 })
    expect(result.success).toBe(true)
    expect(seen).toContain('sharepoint.test')
  })

  it('never throws on malformed response bodies', async () => {
    const { sp } = await connect(json('not json'))
    await expect(
      sp.getListContents({ listName: 'Tasks' })
    ).resolves.toStrictEqual(failure('Unable to parse not json', 'PARSE'))
  })
})

describe('option validation', () => {
  const base = { ...CREDS, site: 'sp.test', serverRelativeUrl: '/sites/x' }
  const bad: Array<[string, Partial<SiteConnectionOptions>]> = [
    ['empty username', { username: '' }],
    ['protocol inside site', { site: 'https://sp.test' }],
    ['path inside site', { site: 'sp.test/sites/x' }],
    [
      'serverRelativeUrl without leading slash',
      { serverRelativeUrl: 'sites/x' },
    ],
    [
      'serverRelativeUrl with trailing slash',
      { serverRelativeUrl: '/sites/x/' },
    ],
    [
      'full URL as serverRelativeUrl',
      { serverRelativeUrl: 'https://sp.test/sites/x' },
    ],
    ['unknown protocol', { protocol: 'ftp' as unknown as 'http' }],
  ]
  for (const [label, override] of bad) {
    it(`rejects ${label}`, () => {
      expect(() => createSiteConnection({ ...base, ...override })).toThrow(
        TypeError
      )
    })
  }

  it('accepts a root web ("" or "/") and a host with a port', () => {
    expect(() =>
      createSiteConnection({ ...base, serverRelativeUrl: '' })
    ).not.toThrow()
    expect(() =>
      createSiteConnection({ ...base, serverRelativeUrl: '/' })
    ).not.toThrow()
    expect(() =>
      createSiteConnection({ ...base, site: 'sp.test:8443' })
    ).not.toThrow()
  })
})

describe('getAuthToken', () => {
  it('returns the Type 3 header without completing a request', async () => {
    const { sp, server } = await connect(json('unused'))
    const result = await sp.getAuthToken({})
    expect(result.success).toBe(true)
    const token = (result as { data: string }).data
    expect(token.startsWith('NTLM ')).toBe(true)
    expect(Buffer.from(token.slice(5), 'base64').readUInt32LE(8)).toBe(3)
    expect(server.requests.map((r) => r.ntlmType)).toEqual([1])
    expect(server.requests[0].url).toBe(`${SITE_PATH}`)
  })

  it('fails when the server does not challenge', async () => {
    const plain = http.createServer((_req, res) => res.end('anonymous'))
    await new Promise<void>((r) => plain.listen(0, '127.0.0.1', r))
    const { port } = plain.address() as AddressInfo
    try {
      const sp = createSiteConnection({
        ...CREDS,
        protocol: 'http',
        site: `127.0.0.1:${port}`,
        serverRelativeUrl: SITE_PATH,
      })
      await expect(sp.getAuthToken({})).resolves.toStrictEqual(
        failure(
          'Error in getAuthToken: Server did not issue an NTLM challenge (HTTP 200)',
          'UNKNOWN'
        )
      )
    } finally {
      plain.closeAllConnections()
      await new Promise<void>((r) => plain.close(() => r()))
    }
  })
})

describe('getFormDigestValue', () => {
  it('POSTs to contextinfo and extracts the digest', async () => {
    const { sp, server } = await connect(
      json({ d: { GetContextWebInformation: { FormDigestValue: 'fd' } } })
    )
    await expect(sp.getFormDigestValue({})).resolves.toStrictEqual(
      success('fd')
    )
    const leg = authenticatedLeg(server)
    expect(leg.method).toBe('POST')
    expect(path(leg)).toBe(`${SITE_PATH}/_api/contextinfo`)
    expect(leg.headers.accept).toBe('application/json;odata=verbose')
    expect(leg.headers['content-type']).toBe('application/json;odata=verbose')
    expect(leg.headers['content-length']).toBe('0')
  })
})

describe('getListContents', () => {
  it('GETs list items with nometadata and no query by default', async () => {
    const { sp, server } = await connect(json({ value: [{ Id: 1 }] }))
    await expect(
      sp.getListContents({ listName: 'My Tasks' })
    ).resolves.toStrictEqual(success([{ Id: 1 }]))
    const leg = authenticatedLeg(server)
    expect(leg.method).toBe('GET')
    expect(path(leg)).toBe(
      `${SITE_PATH}/_api/web/lists/GetByTitle('My Tasks')/items`
    )
    expect(leg.headers.accept).toBe('application/json; odata=nometadata')
    expect(leg.headers['x-requestdigest']).toBeUndefined()
  })

  it('appends OData params as a query string', async () => {
    const { sp, server } = await connect(json({ value: [] }))
    const params = new URLSearchParams({ $select: 'Id,Title', $top: '5' })
    await sp.getListContents({ listName: 'Tasks', params })
    const [, query] = authenticatedLeg(server).url.split('?')
    expect(new URLSearchParams(query).get('$select')).toBe('Id,Title')
    expect(new URLSearchParams(query).get('$top')).toBe('5')
  })

  it('omits the "?" when params are empty', async () => {
    const { sp, server } = await connect(json({ value: [] }))
    await sp.getListContents({
      listName: 'Tasks',
      params: new URLSearchParams(),
    })
    expect(authenticatedLeg(server).url).not.toContain('?')
  })
})

describe('getListItem', () => {
  it('GETs a single item by id', async () => {
    const { sp, server } = await connect(json({ Id: 7, Title: 'x' }))
    await expect(
      sp.getListItem({ listName: 'Tasks', spId: 7 })
    ).resolves.toStrictEqual(success({ Id: 7, Title: 'x' }))
    const leg = authenticatedLeg(server)
    expect(leg.method).toBe('GET')
    expect(path(leg)).toBe(
      `${SITE_PATH}/_api/web/lists/GetByTitle('Tasks')/items('7')`
    )
    expect(leg.headers.accept).toBe('application/json; odata=nometadata')
  })
})

describe('getListItemType', () => {
  it('GETs the list with a $select for the entity type', async () => {
    const { sp, server } = await connect(
      json({ ListItemEntityTypeFullName: 'SP.Data.TasksListItem' })
    )
    await expect(
      sp.getListItemType({ listName: 'Tasks' })
    ).resolves.toStrictEqual(success('SP.Data.TasksListItem'))
    const leg = authenticatedLeg(server)
    expect(leg.method).toBe('GET')
    expect(path(leg)).toBe(
      `${SITE_PATH}/_api/web/lists/GetByTitle('Tasks')?$select=ListItemEntityTypeFullName`
    )
  })
})

describe('addListItem', () => {
  it('POSTs the payload with digest and verbose content type', async () => {
    const { sp, server } = await connect(json({ d: { ID: 42 } }))
    const payload = JSON.stringify({ Title: 'café' }) // multi-byte
    const result = await sp.addListItem({
      accessToken: DIGEST,
      listName: 'Tasks',
      payload,
    })
    expect(result).toStrictEqual(success('{"d":{"ID":42}}'))
    const leg = authenticatedLeg(server)
    expect(leg.method).toBe('POST')
    expect(path(leg)).toBe(
      `${SITE_PATH}/_api/web/lists/GetByTitle('Tasks')/items`
    )
    expect(leg.headers.accept).toBe('application/json;odata=nometadata')
    expect(leg.headers['content-type']).toBe('application/json;odata=verbose')
    expect(leg.headers['x-requestdigest']).toBe(DIGEST)
    expect(leg.headers['content-length']).toBe(
      String(Buffer.byteLength(payload))
    )
    expect(leg.body.toString('utf8')).toBe(payload)
  })

  it('returns the failure when the server rejects', async () => {
    const { sp } = await connect(json('bad digest', 403))
    await expect(
      sp.addListItem({ accessToken: 'stale', listName: 'Tasks', payload: '{}' })
    ).resolves.toStrictEqual({
      ...failure('Error in addListItem: HTTP 403: bad digest', 'AUTH'),
      status: 403,
    })
  })
})

describe('updateListItem', () => {
  it('POSTs a MERGE with If-Match: *', async () => {
    const { sp, server } = await connect((_req, res) => {
      res.statusCode = 204
      res.end()
    })
    const patch = JSON.stringify({ Title: 'new' })
    const result = await sp.updateListItem({
      accessToken: DIGEST,
      listName: 'Tasks',
      spId: 3,
      patch,
    })
    expect(result.success).toBe(true)
    const leg = authenticatedLeg(server)
    expect(leg.method).toBe('POST')
    expect(path(leg)).toBe(
      `${SITE_PATH}/_api/web/lists/GetByTitle('Tasks')/items('3')`
    )
    expect(leg.headers['x-http-method']).toBe('MERGE')
    expect(leg.headers['if-match']).toBe('*')
    expect(leg.headers['x-requestdigest']).toBe(DIGEST)
    expect(leg.headers['content-type']).toBe('application/json;odata=verbose')
    expect(leg.headers['content-length']).toBe(String(Buffer.byteLength(patch)))
    expect(leg.body.toString('utf8')).toBe(patch)
  })
})

describe('deleteListItem', () => {
  it('POSTs a DELETE with If-Match: * and an empty body', async () => {
    const { sp, server } = await connect((_req, res) => {
      res.statusCode = 200
      res.end()
    })
    const result = await sp.deleteListItem({
      accessToken: DIGEST,
      listName: 'Tasks',
      spId: 9,
    })
    expect(result.success).toBe(true)
    const leg = authenticatedLeg(server)
    expect(leg.method).toBe('POST')
    expect(path(leg)).toBe(
      `${SITE_PATH}/_api/web/lists/GetByTitle('Tasks')/items('9')`
    )
    expect(leg.headers['x-http-method']).toBe('DELETE')
    expect(leg.headers['if-match']).toBe('*')
    expect(leg.headers['x-requestdigest']).toBe(DIGEST)
    expect(leg.body.length).toBe(0)
  })
})

describe('addAttachmentToListItem', () => {
  it('POSTs the raw file bytes to AttachmentFiles/add', async () => {
    const { sp, server } = await connect(
      json({
        d: { ServerRelativeUrl: '/sites/test/Lists/Tasks/Attachments/1/a.txt' },
      })
    )
    const payload = Buffer.from([0x00, 0xff, 0x10, 0x80])
    const result = await sp.addAttachmentToListItem({
      accessToken: DIGEST,
      listName: 'Tasks',
      spId: 1,
      fileName: 'a.txt',
      payload,
    })
    expect(result).toStrictEqual(
      success('/sites/test/Lists/Tasks/Attachments/1/a.txt')
    )
    const leg = authenticatedLeg(server)
    expect(leg.method).toBe('POST')
    expect(path(leg)).toBe(
      `${SITE_PATH}/_api/web/lists/GetByTitle('Tasks')/items('1')/AttachmentFiles/add(FileName='a.txt')`
    )
    expect(leg.headers['x-requestdigest']).toBe(DIGEST)
    expect(leg.headers['content-length']).toBe('4')
    expect(leg.body.equals(payload)).toBe(true)
  })

  it('fails when ServerRelativeUrl is missing from the response', async () => {
    const { sp } = await connect(json({ d: {} }))
    await expect(
      sp.addAttachmentToListItem({
        accessToken: DIGEST,
        listName: 'Tasks',
        spId: 1,
        fileName: 'a.txt',
        payload: Buffer.alloc(1),
      })
    ).resolves.toStrictEqual(failure('ServerRelativeUrl not in response'))
  })
})

describe('addDocumentToLibrary', () => {
  it('POSTs the file to Files/add with overwrite=true', async () => {
    const { sp, server } = await connect(
      json({ d: { ServerRelativeUrl: '/sites/test/Docs/r.pdf' } })
    )
    const payload = Buffer.from('%PDF-1.4')
    const result = await sp.addDocumentToLibrary({
      accessToken: DIGEST,
      folder: 'Docs',
      fileName: 'r.pdf',
      payload,
    })
    expect(result).toStrictEqual(success('/sites/test/Docs/r.pdf'))
    const leg = authenticatedLeg(server)
    expect(leg.method).toBe('POST')
    expect(path(leg)).toBe(
      `${SITE_PATH}/_api/web/GetFolderByServerRelativeUrl('${SITE_PATH}/Docs')/Files/add(url='r.pdf',overwrite=true)`
    )
    expect(leg.headers['x-requestdigest']).toBe(DIGEST)
    expect(leg.headers['content-length']).toBe(String(payload.length))
    expect(leg.body.equals(payload)).toBe(true)
  })
})

describe('getDocumentFromLibrary', () => {
  const bytes = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x00, 0xff])

  it('GETs $value and returns a Buffer by default', async () => {
    const { sp, server } = await connect((_req, res) => {
      res.setHeader('Content-Type', 'application/octet-stream')
      res.end(bytes)
    })
    const result = await sp.getDocumentFromLibrary({
      folder: 'Docs',
      fileName: 'r.pdf',
    })
    expect(result.success).toBe(true)
    const data = (result as { data: Buffer }).data
    expect(Buffer.isBuffer(data)).toBe(true)
    expect(data.equals(bytes)).toBe(true)
    const leg = authenticatedLeg(server)
    expect(leg.method).toBe('GET')
    expect(path(leg)).toBe(
      `${SITE_PATH}/_api/web/GetFolderByServerRelativeUrl('${SITE_PATH}/Docs')/Files('r.pdf')/$value`
    )
  })

  it('fails the document check when binary is disabled', async () => {
    const { sp } = await connect((_req, res) => res.end(bytes))
    await expect(
      sp.getDocumentFromLibrary({
        folder: 'Docs',
        fileName: 'r.pdf',
        binary: false,
      })
    ).resolves.toStrictEqual(formatError)
  })
})

describe('deleteDocumentFromLibrary', () => {
  it('POSTs a DELETE to GetFileByServerRelativeUrl and echoes the name', async () => {
    const { sp, server } = await connect((_req, res) => {
      res.statusCode = 200
      res.end()
    })
    await expect(
      sp.deleteDocumentFromLibrary({
        accessToken: DIGEST,
        folder: 'Docs',
        fileName: 'r.pdf',
      })
    ).resolves.toStrictEqual(success('r.pdf'))
    const leg = authenticatedLeg(server)
    expect(leg.method).toBe('POST')
    expect(path(leg)).toBe(
      `${SITE_PATH}/_api/web/GetFileByServerRelativeUrl('${SITE_PATH}/Docs/r.pdf')`
    )
    expect(leg.headers['x-http-method']).toBe('DELETE')
    expect(leg.headers['if-match']).toBe('*')
    expect(leg.headers['x-requestdigest']).toBe(DIGEST)
    expect(leg.body.length).toBe(0)
  })

  it('reports failure when the server rejects the delete', async () => {
    const { sp } = await connect(json('locked', 423))
    await expect(
      sp.deleteDocumentFromLibrary({
        accessToken: DIGEST,
        folder: 'Docs',
        fileName: 'r.pdf',
      })
    ).resolves.toStrictEqual({
      ...failure(
        'Error in deleteDocumentFromLibrary: HTTP 423: locked',
        'HTTP'
      ),
      status: 423,
    })
  })
})

describe('getFolderContents', () => {
  it('GETs the folder Files collection', async () => {
    const { sp, server } = await connect(
      json({ value: [{ Name: 'a.txt' }, { Name: 'b.txt' }] })
    )
    await expect(
      sp.getFolderContents({ folder: 'Docs' })
    ).resolves.toStrictEqual(success([{ Name: 'a.txt' }, { Name: 'b.txt' }]))
    const leg = authenticatedLeg(server)
    expect(leg.method).toBe('GET')
    expect(path(leg)).toBe(
      `${SITE_PATH}/_api/web/GetFolderByServerRelativeUrl('${SITE_PATH}/Docs')/Files`
    )
    expect(leg.headers.accept).toBe('application/json; odata=nometadata')
  })

  it('appends OData params as a query string', async () => {
    const { sp, server } = await connect(json({ value: [] }))
    await sp.getFolderContents({
      folder: 'Docs',
      params: new URLSearchParams({ $select: 'Name' }),
    })
    const [, query] = authenticatedLeg(server).url.split('?')
    expect(new URLSearchParams(query).get('$select')).toBe('Name')
  })
})

describe('checkFolderExistsInLibrary', () => {
  it('GETs /Exists and returns the boolean', async () => {
    const { sp, server } = await connect(json({ value: true }))
    await expect(
      sp.checkFolderExistsInLibrary({ folder: 'Docs/Sub' })
    ).resolves.toStrictEqual(success(true))
    const leg = authenticatedLeg(server)
    expect(leg.method).toBe('GET')
    expect(path(leg)).toBe(
      `${SITE_PATH}/_api/web/GetFolderByServerRelativeUrl('${SITE_PATH}/Docs/Sub')/Exists`
    )
  })

  it('returns success(false) when the folder is absent', async () => {
    const { sp } = await connect(json({ value: false }))
    await expect(
      sp.checkFolderExistsInLibrary({ folder: 'Nope' })
    ).resolves.toStrictEqual(success(false))
  })
})

describe('createFolderInLibrary', () => {
  it('POSTs a ServerRelativeUrl payload to /_api/web/folders', async () => {
    const { sp, server } = await connect(
      json({ d: { ServerRelativeUrl: '/sites/test/Docs/New' } })
    )
    await expect(
      sp.createFolderInLibrary({
        accessToken: DIGEST,
        folder: 'Docs/New',
      })
    ).resolves.toStrictEqual(success('/sites/test/Docs/New'))
    const leg = authenticatedLeg(server)
    expect(leg.method).toBe('POST')
    expect(path(leg)).toBe(`${SITE_PATH}/_api/web/folders`)
    expect(leg.headers['content-type']).toBe('application/json')
    expect(leg.headers['x-requestdigest']).toBe(DIGEST)
    expect(JSON.parse(leg.body.toString('utf8'))).toEqual({
      ServerRelativeUrl: `${SITE_PATH}/Docs/New`,
    })
  })
})

describe('URL escaping', () => {
  it('percent-encodes and doubles apostrophes in list titles', async () => {
    const { sp, server } = await connect(json({ value: [] }))
    await sp.getListContents({ listName: "Bob's Tasks #2" })
    const leg = authenticatedLeg(server)
    // Raw URL: apostrophe doubled per OData, space and # percent-encoded
    expect(leg.url).toBe(
      `${SITE_PATH}/_api/web/lists/GetByTitle('Bob''s%20Tasks%20%232')/items`
    )
  })

  it('encodes folder and file names but preserves path separators', async () => {
    const { sp, server } = await connect(json({ value: true }))
    await sp.checkFolderExistsInLibrary({ folder: 'Shared Documents/Q1 2026' })
    expect(authenticatedLeg(server).url).toBe(
      `${SITE_PATH}/_api/web/GetFolderByServerRelativeUrl('${SITE_PATH}/Shared%20Documents/Q1%202026')/Exists`
    )
  })

  it('encodes the file name in document URLs', async () => {
    const { sp, server } = await connect(json({ value: [] }))
    await sp.getDocumentFromLibrary({
      folder: 'Docs',
      fileName: "Mike's report 100%.pdf",
    })
    expect(authenticatedLeg(server).url).toBe(
      `${SITE_PATH}/_api/web/GetFolderByServerRelativeUrl('${SITE_PATH}/Docs')/Files('Mike''s%20report%20100%25.pdf')/$value`
    )
  })

  it('encodes spaces in serverRelativeUrl', async () => {
    const { sp, server } = await connect(json({ value: [] }), {
      serverRelativeUrl: '/sites/My Site',
    })
    await sp.getListContents({ listName: 'Tasks' })
    expect(authenticatedLeg(server).url).toBe(
      `/sites/My%20Site/_api/web/lists/GetByTitle('Tasks')/items`
    )
  })
})

describe('requestDigest alias', () => {
  it('sends requestDigest as X-RequestDigest', async () => {
    const { sp, server } = await connect(json({ d: { ID: 1 } }))
    await sp.addListItem({
      requestDigest: 'digest-new',
      listName: 'Tasks',
      payload: '{}',
    })
    expect(authenticatedLeg(server).headers['x-requestdigest']).toBe(
      'digest-new'
    )
  })

  it('still accepts the deprecated accessToken on every write action', async () => {
    const { sp, server } = await connect((_req, res) => {
      res.statusCode = 204
      res.end()
    })
    await sp.deleteListItem({
      accessToken: 'digest-old',
      listName: 'T',
      spId: 1,
    })
    expect(authenticatedLeg(server).headers['x-requestdigest']).toBe(
      'digest-old'
    )
  })
})

describe('paging', () => {
  /** Serves `pages` in order; each response links to the next via odata.nextLink. */
  const paged =
    (pages: unknown[][], failAt?: number) =>
    (req: SeenRequest, res: http.ServerResponse) => {
      const url = new URL(req.url, 'http://x')
      const n = Number(url.searchParams.get('page') ?? '0')
      if (failAt === n) {
        res.statusCode = 503
        res.end('busy')
        return
      }
      const body: Record<string, unknown> = { value: pages[n] }
      if (n + 1 < pages.length) {
        body['odata.nextLink'] =
          `http://${req.headers.host}${SITE_PATH}/_api/web/lists/GetByTitle('Tasks')/items?page=${n + 1}`
      }
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(body))
    }

  it('getListContents exposes nextLink and omits it on the last page', async () => {
    const { sp } = await connect(paged([[1, 2], [3]]))
    const first = await sp.getListContents<number>({ listName: 'Tasks' })
    expect(first.success).toBe(true)
    if (!first.success) return
    expect(first.data).toEqual([1, 2])
    expect(first.nextLink).toMatch(/page=1$/)

    const second = await sp.getNextPage<number>({ nextLink: first.nextLink! })
    expect(second).toStrictEqual(success([3]))
  })

  it('getNextPage refuses a link on another origin', async () => {
    const { sp } = await connect(paged([[1]]))
    const result = await sp.getNextPage({
      nextLink: 'https://evil.example/_api/web/lists',
    })
    expect(result).toMatchObject({
      success: false,
      code: 'UNKNOWN',
      error: expect.stringContaining('nextLink must be on'),
    })
  })

  it('getNextPage rejects an unparsable link without throwing', async () => {
    const { sp } = await connect(paged([[1]]))
    const result = await sp.getNextPage({ nextLink: 'not a url' })
    expect(result.success).toBe(false)
  })

  it('getAllListContents concatenates every page', async () => {
    const { sp, server } = await connect(paged([[1, 2], [3, 4], [5]]))
    const all = await sp.getAllListContents<number>({ listName: 'Tasks' })
    expect(all).toStrictEqual(success([1, 2, 3, 4, 5]))
    expect(server.requests.filter((r) => r.ntlmType === 3)).toHaveLength(3)
  })

  it('getAllListContents returns the failure of a later page, not partial data', async () => {
    const { sp } = await connect(paged([[1], [2], [3]], 1))
    const all = await sp.getAllListContents<number>({ listName: 'Tasks' })
    expect(all).toMatchObject({ success: false, code: 'HTTP', status: 503 })
  })

  it('getAllListContents honours maxPages', async () => {
    const { sp } = await connect(paged([[1], [2], [3]]))
    const all = await sp.getAllListContents<number>({
      listName: 'Tasks',
      maxPages: 2,
    })
    expect(all).toStrictEqual(success([1, 2]))
  })

  it('iterateListContents yields each page and stops after a failure', async () => {
    const { sp } = await connect(paged([[1], [2], [3]], 1))
    const seen: Array<PageResult<number>> = []
    for await (const page of sp.iterateListContents<number>({
      listName: 'Tasks',
    })) {
      seen.push(page)
    }
    expect(seen).toHaveLength(2)
    expect(seen[0]).toMatchObject({ success: true, data: [1] })
    expect(seen[1]).toMatchObject({ success: false, status: 503 })
  })

  it('iterateFolderContents / getAllFolderContents follow nextLink too', async () => {
    const { sp } = await connect(paged([[{ Name: 'a' }], [{ Name: 'b' }]]))
    const all = await sp.getAllFolderContents<{ Name: string }>({
      folder: 'Docs',
    })
    expect(all).toStrictEqual(success([{ Name: 'a' }, { Name: 'b' }]))
  })
})

describe('retry', () => {
  const flaky = (failures: number, status = 503) =>
    (() => {
      let calls = 0
      return (_req: SeenRequest, res: http.ServerResponse) => {
        calls++
        if (calls <= failures) {
          res.statusCode = status
          res.end('busy')
          return
        }
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ Id: calls }))
      }
    })()

  it('is off by default', async () => {
    const { sp } = await connect(flaky(1))
    const result = await sp.getListItem({ listName: 'Tasks', spId: 1 })
    expect(result).toMatchObject({ success: false, status: 503 })
  })

  it('retries transient HTTP failures on reads', async () => {
    const { sp, server } = await connect(flaky(2), {
      retry: { baseDelayMs: 1 },
    })
    const result = await sp.getListItem<{ Id: number }>({
      listName: 'Tasks',
      spId: 1,
    })
    expect(result).toStrictEqual(success({ Id: 3 }))
    expect(server.requests.filter((r) => r.ntlmType === 3)).toHaveLength(3)
  })

  it('gives up after `retries` and returns the last failure', async () => {
    const { sp, server } = await connect(flaky(5), {
      retry: { retries: 1, baseDelayMs: 1 },
    })
    const result = await sp.getListItem({ listName: 'Tasks', spId: 1 })
    expect(result).toMatchObject({ success: false, status: 503 })
    expect(server.requests.filter((r) => r.ntlmType === 3)).toHaveLength(2)
  })

  it('does not retry non-transient failures', async () => {
    const { sp, server } = await connect(flaky(1, 404), {
      retry: { baseDelayMs: 1 },
    })
    const result = await sp.getListItem({ listName: 'Tasks', spId: 1 })
    expect(result).toMatchObject({ success: false, status: 404 })
    expect(server.requests.filter((r) => r.ntlmType === 3)).toHaveLength(1)
  })

  it('never retries write actions', async () => {
    const { sp, server } = await connect(flaky(1), {
      retry: { baseDelayMs: 1 },
    })
    const result = await sp.deleteListItem({
      requestDigest: DIGEST,
      listName: 'Tasks',
      spId: 1,
    })
    expect(result).toMatchObject({ success: false, status: 503 })
    expect(server.requests.filter((r) => r.ntlmType === 3)).toHaveLength(1)
  })

  it('honours a custom retryOn predicate', async () => {
    const { sp, server } = await connect(flaky(1, 404), {
      retry: { baseDelayMs: 1, retryOn: (f) => f.status === 404 },
    })
    const result = await sp.getListItem({ listName: 'Tasks', spId: 1 })
    expect(result.success).toBe(true)
    expect(server.requests.filter((r) => r.ntlmType === 3)).toHaveLength(2)
  })

  it('retries each page independently when collecting', async () => {
    let calls = 0
    const { sp } = await connect(
      (req, res) => {
        calls++
        const n = Number(
          new URL(req.url, 'http://x').searchParams.get('page') ?? 0
        )
        if (n === 1 && calls === 2) {
          res.statusCode = 503
          res.end('busy')
          return
        }
        const body: Record<string, unknown> = { value: [n] }
        if (n === 0)
          body['odata.nextLink'] =
            `http://${req.headers.host}${SITE_PATH}/_api/x?page=1`
        res.end(JSON.stringify(body))
      },
      { retry: { baseDelayMs: 1 } }
    )
    const all = await sp.getAllListContents<number>({ listName: 'Tasks' })
    expect(all).toStrictEqual(success([0, 1]))
  })
})
