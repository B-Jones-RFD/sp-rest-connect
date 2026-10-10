/**
 * Usage examples. Not part of the published package; type-checked by
 * `pnpm lint` so they stay in sync with the API.
 */
import { createSiteConnection, getListContents } from '../src'
import type { SiteConnectionOptions } from '../src'
import { createReadStream, createWriteStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { basename } from 'node:path'
import { pipeline } from 'node:stream/promises'

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

// Writing: the connection fetches and caches the request digest and the
// list's entity type for you.
export async function createTask(title: string) {
  const created = await connection.addListItem<{ Title: string }>({
    listName: 'Tasks',
    payload: { Title: title },
  })
  if (!created.success) throw new Error(created.error)
  return created.data
}

// Uploading a document from memory
export async function uploadReport(fileName: string, contents: Buffer) {
  return connection.addDocumentToLibrary({
    folder: 'Shared Documents/Reports',
    fileName,
    payload: contents,
  })
}

// Uploading a large file without buffering it
export async function uploadLargeFile(path: string) {
  const { size } = await stat(path)
  return connection.addDocumentToLibrary({
    folder: 'Shared Documents/Archive',
    fileName: basename(path),
    payload: createReadStream(path),
    contentLength: size,
  })
}

// Downloading a large file to disk
export async function downloadTo(fileName: string, destination: string) {
  const res = await connection.getDocumentStreamFromLibrary({
    folder: 'Shared Documents/Archive',
    fileName,
  })
  if (!res.success) throw new Error(res.error)
  await pipeline(res.data, createWriteStream(destination))
}
