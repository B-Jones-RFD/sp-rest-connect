/**
 * Usage examples. Not part of the published package; type-checked by
 * `pnpm lint` so they stay in sync with the API.
 */
import { createSiteConnection, getListContents } from '../src'
import type { SiteConnectionOptions } from '../src'

const siteConnectionOptions: SiteConnectionOptions = {
  username: 'jsmith',
  password: process.env.SP_PASSWORD ?? '',
  domain: 'CONTOSO', // NetBIOS domain, not a DNS name
  site: 'sharepoint.contoso.local',
  serverRelativeUrl: '/sites/finance',
}

const connection = createSiteConnection(siteConnectionOptions)

const params = new URLSearchParams({
  $select: 'Id,Title',
  $top: '200',
})

// Reading with an instance method
export async function getMyList(listName: string) {
  const contents = await connection.getListContents({ listName, params })
  if (contents.success) return contents.data
  throw new Error(contents.error)
}

// Reading with a standalone factory action
export async function getMyListAlt(listName: string) {
  const action = getListContents(siteConnectionOptions)
  const contents = await action({ listName, params })
  if (contents.success) return contents.data
  throw new Error(contents.error)
}

// Writing: entity type + request digest, then create
export async function createTask(title: string) {
  const [type, digest] = await Promise.all([
    connection.getListItemType({ listName: 'Tasks' }),
    connection.getFormDigestValue({}),
  ])
  if (!type.success) throw new Error(type.error)
  if (!digest.success) throw new Error(digest.error)

  const created = await connection.addListItem({
    requestDigest: digest.data,
    listName: 'Tasks',
    payload: JSON.stringify({ __metadata: { type: type.data }, Title: title }),
  })
  if (!created.success) throw new Error(created.error)
  return JSON.parse(created.data) as { Id: number; Title: string }
}

// Uploading a document
export async function uploadReport(fileName: string, contents: Buffer) {
  const digest = await connection.getFormDigestValue({})
  if (!digest.success) throw new Error(digest.error)

  return connection.addDocumentToLibrary({
    requestDigest: digest.data,
    folder: 'Shared Documents/Reports',
    fileName,
    payload: contents,
  })
}
