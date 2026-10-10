import { describe, it, expect, afterEach } from 'vitest'
import http from 'node:http'
import os from 'node:os'
import type { AddressInfo } from 'node:net'
import { createSiteConnection } from '../src'
import type { SiteConnection, SiteConnectionOptions } from '../src'
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
      'getAuthToken',
      'getDocumentFromLibrary',
      'getFolderContents',
      'getFormDigestValue',
      'getListContents',
      'getListItem',
      'getListItemType',
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
    expect(result).toEqual({
      success: false,
      error: expect.stringMatching(
        /^Error in getListItem: .*timed out after 100ms/
      ),
    })
  })

  it('wraps non-2xx responses as a failure carrying the body', async () => {
    const { sp } = await connect(json('{"error":"nope"}', 403))
    const result = await sp.getListItem({ listName: 'Tasks', spId: 1 })
    expect(result).toEqual({
      success: false,
      error: 'Error in getListItem: Error: {"error":"nope"}',
    })
  })

  it('never throws on malformed response bodies', async () => {
    const { sp } = await connect(json('not json'))
    await expect(
      sp.getListContents({ listName: 'Tasks' })
    ).resolves.toStrictEqual(failure('Unable to parse not json'))
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
          'Error in getAuthToken: Error: Auth response missing www-authenticate header'
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
    ).resolves.toStrictEqual(failure('Error in addListItem: Error: bad digest'))
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
    ).resolves.toStrictEqual(
      failure('Error in deleteDocumentFromLibrary: Error: locked')
    )
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
