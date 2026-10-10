import type {
  GetAllFolderContentsOptions,
  GetAllListContentsOptions,
  PagedIterator,
  PageResult,
  Result,
  SiteConnection,
  SiteConnectionOptions,
} from '../types'
import { success } from '../utils'
import { getListContents } from './getListContents'
import { getFolderContents } from './getFolderContents'
import { getNextPage } from './getNextPage'

async function* followPages<T>(
  first: Promise<PageResult<T>>,
  next: (nextLink: string) => Promise<PageResult<T>>,
  maxPages: number
): AsyncGenerator<PageResult<T>, void, undefined> {
  let page = await first
  let count = 1
  for (;;) {
    yield page
    if (!page.success || page.nextLink === undefined || count >= maxPages)
      return
    page = await next(page.nextLink)
    count++
  }
}

async function collect<T>(
  pages: AsyncGenerator<PageResult<T>, void, undefined>
): Promise<Result<T[]>> {
  const all: T[] = []
  for await (const page of pages) {
    if (!page.success) return page
    all.push(...page.data)
  }
  return success(all)
}

/**
 * Yields list items one page at a time, following `nextLink`.
 *
 * Factory form of {@link SiteConnection.iterateListContents}: call with your
 * {@link SiteConnectionOptions} to get a reusable iterator.
 */
export const iterateListContents =
  (options: SiteConnectionOptions): PagedIterator<GetAllListContentsOptions> =>
  <T = unknown>({
    maxPages = Infinity,
    ...query
  }: GetAllListContentsOptions) => {
    const { listName: _l, params: _p, ...request } = query
    return followPages<T>(
      getListContents(options)<T>(query),
      (nextLink) => getNextPage(options)<T>({ nextLink, ...request }),
      maxPages
    )
  }

/**
 * Collects every list item across all pages.
 *
 * Factory form of {@link SiteConnection.getAllListContents}.
 */
export const getAllListContents =
  (options: SiteConnectionOptions) =>
  <T = unknown>(query: GetAllListContentsOptions): Promise<Result<T[]>> =>
    collect(iterateListContents(options)<T>(query))

/**
 * Yields folder files one page at a time, following `nextLink`.
 *
 * Factory form of {@link SiteConnection.iterateFolderContents}.
 */
export const iterateFolderContents =
  (
    options: SiteConnectionOptions
  ): PagedIterator<GetAllFolderContentsOptions> =>
  <T = unknown>({
    maxPages = Infinity,
    ...query
  }: GetAllFolderContentsOptions) => {
    const { folder: _f, params: _p, ...request } = query
    return followPages<T>(
      getFolderContents(options)<T>(query),
      (nextLink) => getNextPage(options)<T>({ nextLink, ...request }),
      maxPages
    )
  }

/**
 * Collects every file in a folder across all pages.
 *
 * Factory form of {@link SiteConnection.getAllFolderContents}.
 */
export const getAllFolderContents =
  (options: SiteConnectionOptions) =>
  <T = unknown>(query: GetAllFolderContentsOptions): Promise<Result<T[]>> =>
    collect(iterateFolderContents(options)<T>(query))
