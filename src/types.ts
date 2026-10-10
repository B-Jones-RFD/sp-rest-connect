import type { AgentOptions } from 'node:https'
import type { Readable } from 'node:stream'

/**
 * Public types for `@b-jones-rfd/sp-rest-connect`.
 *
 * Every action resolves to a {@link Result} and never throws: check
 * `result.success` to narrow to {@link Success} or {@link Failure}.
 */

/** Successful action result. The payload is in `data`. */
export type Success<T> = { success: true; data: T }

/**
 * Classification of a {@link Failure}. Branch on this rather than on the
 * `error` text.
 *
 * - `HTTP`    — SharePoint answered with a non-2xx status other than 401/403. See `status` and `details`.
 * - `AUTH`    — 401 or 403: bad credentials, NTLM rejected, or an expired/missing request digest.
 * - `TIMEOUT` — the socket was idle longer than `timeout`.
 * - `ABORTED` — the request was cancelled through `signal`.
 * - `NETWORK` — DNS, connection or TLS failure before a response arrived.
 * - `PARSE`   — SharePoint answered 2xx but the body was not in the expected shape.
 * - `UNKNOWN` — anything else.
 */
export type FailureCode =
  'HTTP' | 'AUTH' | 'TIMEOUT' | 'ABORTED' | 'NETWORK' | 'PARSE' | 'UNKNOWN'

/** The `error` object SharePoint returns in a failed response body, when present. */
export type SharePointError = {
  /** SharePoint error code, e.g. `'-2130575338, Microsoft.SharePoint.SPException'`. */
  code?: string
  /** Human-readable message from SharePoint. */
  message?: string
}

/**
 * Failed action result.
 *
 * `error` is a human-readable message prefixed with the action name, for
 * logging. `code` classifies the failure; `status` and `details` are present
 * for `HTTP`/`AUTH` failures when SharePoint supplied them.
 */
export type Failure = {
  success: false
  error: string
  code: FailureCode
  /** HTTP status code, for `HTTP` and `AUTH` failures. */
  status?: number
  /** Parsed SharePoint error body, when the response carried one. */
  details?: SharePointError
}

/**
 * Discriminated union returned by every action.
 *
 * @example
 * const res = await connection.getListContents({ listName: 'Tasks' })
 * if (res.success) console.log(res.data) // unknown[]
 * else console.error(res.error)         // string
 */
export type Result<T> = Success<T> | Failure

/** An asynchronous SharePoint operation bound to a site connection. */
export type Action<TConfig, TResponse> = (
  options: TConfig
) => Promise<Result<TResponse>>

/**
 * A successful page of results. `nextLink` is present when SharePoint has
 * more items than it returned (it caps a response at `$top`, or 100 by
 * default); pass it to {@link SiteConnection.getNextPage}, or use
 * `getAllListContents` / `iterateListContents` to follow it automatically.
 */
export type Page<T> = Success<T[]> & { nextLink?: string }

/** Result of a paged read: a {@link Page} or a {@link Failure}. */
export type PageResult<T> = Page<T> | Failure

/**
 * A read action whose item type the caller chooses. The type parameter is an
 * unchecked assertion — SharePoint's JSON is not validated against `T`.
 *
 * @example
 * type Task = { Id: number; Title: string }
 * const res = await connection.getListContents<Task>({ listName: 'Tasks' })
 * if (res.success) res.data[0].Title // string
 */
export type PagedAction<TConfig> = <T = unknown>(
  options: TConfig
) => Promise<PageResult<T>>

/** A single-item read action whose result type the caller chooses (unchecked). */
export type TypedAction<TConfig> = <T = unknown>(
  options: TConfig
) => Promise<Result<T>>

/**
 * Yields one {@link PageResult} per request until SharePoint reports no more
 * pages, `maxPages` is reached, or a page fails (the failure is yielded, then
 * iteration ends). Never throws.
 */
export type PagedIterator<TConfig> = <T = unknown>(
  options: TConfig
) => AsyncGenerator<PageResult<T>, void, undefined>

/**
 * Opt-in retry for read actions. Writes are never retried automatically.
 * Delays use exponential backoff with full jitter:
 * `random(0, min(maxDelayMs, baseDelayMs * 2^attempt))`.
 */
export type RetryOptions = {
  /** Extra attempts after the first failure. @defaultValue `2` */
  retries?: number
  /** Base delay in milliseconds. @defaultValue `200` */
  baseDelayMs?: number
  /** Upper bound on a single delay. @defaultValue `5000` */
  maxDelayMs?: number
  /**
   * Decide whether a failed attempt should be retried. `attempt` is
   * 1-based. The default retries `NETWORK`, `TIMEOUT`, and `HTTP` with status
   * 429, 502, 503 or 504. `ABORTED` is never retried.
   */
  retryOn?: (failure: Failure, attempt: number) => boolean
}

/**
 * Connection and credential settings for an on-premises SharePoint site
 * (2013, 2016, 2019 or Subscription Edition). SharePoint Online is not
 * supported: it does not accept NTLM authentication.
 */
export type SiteConnectionOptions = {
  /** Windows account name used for NTLM authentication, without the domain (e.g. `'jsmith'`). */
  username: string
  /** Password for `username`. Prefer reading this from the environment rather than hard-coding it. */
  password: string
  /** SharePoint host name, without protocol or path (e.g. `'sharepoint.contoso.local'`). */
  site: string
  /**
   * Server-relative URL of the site (web), starting with `/` and without a
   * trailing slash (e.g. `'/sites/finance'`). All `folder` arguments are
   * resolved relative to this path.
   */
  serverRelativeUrl: string
  /** URL scheme. @defaultValue `'https'` */
  protocol?: 'https' | 'http'
  /**
   * NTLM (NetBIOS) domain of the account, e.g. `'CONTOSO'` — not a DNS name.
   * Leave empty if the account is local to the server.
   * @defaultValue `''`
   */
  domain?: string
  /**
   * Workstation name sent in the NTLM handshake. Rarely needs changing.
   * @defaultValue `os.hostname()`
   */
  hostname?: string
  /**
   * Options for the per-request `http.Agent`/`https.Agent`, e.g. `ca` for an
   * internal certificate authority, `rejectUnauthorized`, `localAddress`, or
   * `lookup`. `keepAlive` and `maxSockets` are fixed by the NTLM handshake and
   * cannot be overridden.
   * @example
   * agentOptions: { ca: fs.readFileSync('corp-root-ca.pem') }
   */
  agentOptions?: AgentOptions
  /**
   * Retry transient failures on read actions (`get*`, `check*`,
   * `iterate*`). Off unless set; `{}` enables the defaults. Write actions are
   * never retried.
   * @example
   * retry: { retries: 3, baseDelayMs: 500 }
   */
  retry?: RetryOptions
}

/** Options accepted by every action in addition to its own parameters. */
export interface RequestOptions {
  /**
   * Socket inactivity timeout in milliseconds: the request fails with code
   * `TIMEOUT` if no bytes arrive for this long. It is not a cap on total
   * duration; use `signal` with `AbortSignal.timeout()` for that.
   * Omit for no timeout.
   */
  timeout?: number
  /**
   * Cancels the request. Abort yields a `Failure` with code `ABORTED`.
   * @example
   * connection.getListContents({ listName: 'Tasks', signal: AbortSignal.timeout(5000) })
   */
  signal?: AbortSignal
}

/**
 * Options for write actions.
 *
 * `requestDigest` is optional: when omitted, the connection fetches a digest
 * from `/_api/contextinfo`, caches it until shortly before it expires, and
 * transparently refreshes it (retrying the write once) if SharePoint rejects
 * it with 403. Pass your own value to bypass the cache.
 *
 * `accessToken` is the pre-4.0 name for the same value and still works.
 */
export type AuthenticatedRequestOptions = RequestOptions & {
  /**
   * SharePoint request digest (`X-RequestDigest`). Omit to let the connection
   * manage it; supply one from {@link SiteConnection.getFormDigestValue} to
   * take control yourself.
   */
  requestDigest?: string
  /** @deprecated Use `requestDigest`, or omit both to use the managed digest. */
  accessToken?: string
}

/**
 * A list item to create or merge. Either a plain object — the entity type
 * (`__metadata.type`) is looked up and cached per list when absent — or,
 * for backwards compatibility, a pre-serialised JSON string.
 *
 * The `string` form is deprecated and will be removed in 5.0; pass an object.
 */
export type ListItemPayload = Record<string, unknown> | string

export type AddAttachmentToListItemOptions = AuthenticatedRequestOptions & {
  /** List display title, as shown in the SharePoint UI (not the URL segment). */
  listName: string
  /** Integer `ID` of the list item. */
  spId: number
  /** Attachment file name, including extension. */
  fileName: string
  /** File contents. */
  payload: Buffer
}

export type AddDocumentToLibraryOptions = AuthenticatedRequestOptions & {
  /**
   * Target folder path relative to `serverRelativeUrl`, starting with the
   * library name (e.g. `'Shared Documents/Reports'`).
   */
  folder: string
  /** File name, including extension. An existing file with the same name is overwritten. */
  fileName: string
  /**
   * File contents. A `Readable` (e.g. `fs.createReadStream(path)`) is piped
   * to SharePoint without buffering it in memory. A stream can only be sent
   * once, so a 403 for a stale managed digest is not retried for streams;
   * supply `contentLength` when you know it, otherwise the upload is chunked.
   */
  payload: Buffer | Readable
  /** Byte length of a `Readable` payload, if known. Ignored for `Buffer`. */
  contentLength?: number
}

export type AddListItemOptions = AuthenticatedRequestOptions & {
  /** List display title, as shown in the SharePoint UI (not the URL segment). */
  listName: string
  /**
   * The item's fields. Pass a plain object; the entity type is resolved via
   * {@link SiteConnection.getListItemType} and cached per list. Include
   * `__metadata: { type }` yourself to skip the lookup.
   *
   * A pre-serialised JSON string is still accepted but deprecated.
   */
  payload: ListItemPayload
}

export interface CheckFolderExistsInLibraryOptions extends RequestOptions {
  /** Folder path relative to `serverRelativeUrl` (e.g. `'Shared Documents/Reports'`). */
  folder: string
}

export type CreateFolderInLibraryOptions = AuthenticatedRequestOptions & {
  /**
   * Folder path to create, relative to `serverRelativeUrl`
   * (e.g. `'Shared Documents/Reports/2026'`). The parent folder must exist.
   */
  folder: string
}

export type DeleteDocumentFromLibraryOptions = AuthenticatedRequestOptions & {
  /** Folder containing the file, relative to `serverRelativeUrl`. */
  folder: string
  /** File name, including extension. */
  fileName: string
}

export type DeleteListItemOptions = AuthenticatedRequestOptions & {
  /** List display title, as shown in the SharePoint UI (not the URL segment). */
  listName: string
  /** Integer `ID` of the list item. */
  spId: number
}

export interface GetDocumentFromLibraryOptions extends RequestOptions {
  /** Folder containing the file, relative to `serverRelativeUrl`. */
  folder: string
  /** File name, including extension. */
  fileName: string
  /**
   * Return the file as a `Buffer`. Setting this to `false` decodes the body as
   * UTF-8 text, which fails the Buffer check and yields a `Failure`; there is
   * no reason to change it.
   * @defaultValue `true`
   */
  binary?: boolean
}

export interface GetDocumentStreamFromLibraryOptions extends RequestOptions {
  /** Folder containing the file, relative to `serverRelativeUrl`. */
  folder: string
  /** File name, including extension. */
  fileName: string
}

export interface GetFolderContentsOptions extends RequestOptions {
  /** Folder path relative to `serverRelativeUrl` (e.g. `'Shared Documents'`). */
  folder: string
  /** OData query options, e.g. `new URLSearchParams({ $select: 'Name,Length', $top: '500' })`. */
  params?: URLSearchParams
}

export interface GetListContentsOptions extends RequestOptions {
  /** List display title, as shown in the SharePoint UI (not the URL segment). */
  listName: string
  /**
   * OData query options, e.g.
   * `new URLSearchParams({ $select: 'Id,Title', $filter: "Status eq 'Open'", $top: '200' })`.
   * Without `$top` SharePoint returns at most 100 items.
   */
  params?: URLSearchParams
}

/** Options for following a {@link Page.nextLink}. */
export interface GetNextPageOptions extends RequestOptions {
  /** The `nextLink` from a previous page. Must point at the connection's own host. */
  nextLink: string
}

/** Extra options for the `getAll*` and `iterate*` helpers. */
export interface PagingOptions {
  /**
   * Stop after this many pages even if SharePoint reports more.
   * @defaultValue unlimited
   */
  maxPages?: number
}

export type GetAllListContentsOptions = GetListContentsOptions & PagingOptions
export type GetAllFolderContentsOptions = GetFolderContentsOptions &
  PagingOptions

export interface GetListItemOptions extends RequestOptions {
  /** List display title, as shown in the SharePoint UI (not the URL segment). */
  listName: string
  /** Integer `ID` of the list item. */
  spId: number
}

export interface GetListItemTypeOptions extends RequestOptions {
  /** List display title, as shown in the SharePoint UI (not the URL segment). */
  listName: string
}

export type UpdateListItemOptions = AuthenticatedRequestOptions & {
  /** List display title, as shown in the SharePoint UI (not the URL segment). */
  listName: string
  /** Integer `ID` of the list item. */
  spId: number
  /**
   * The fields to change (OData MERGE: fields you omit are untouched). Pass a
   * plain object; the entity type is resolved and cached per list unless you
   * include `__metadata: { type }` yourself.
   *
   * A pre-serialised JSON string is still accepted but deprecated.
   */
  patch: ListItemPayload
}

/**
 * Caches a request digest for one site. Created by `createConnectionContext`.
 */
export interface DigestCache {
  /** A valid digest, fetching or refreshing it as needed. Concurrent callers share one fetch. */
  get(request: RequestOptions): Promise<Result<string>>
  /** Drop the cached digest so the next `get` fetches a fresh one. */
  invalidate(): void
}

/** Caches `ListItemEntityTypeFullName` per list. Created by `createConnectionContext`. */
export interface EntityTypeCache {
  get(listName: string, request: RequestOptions): Promise<Result<string>>
  /** Forget one list's type, or every list's when `listName` is omitted. */
  invalidate(listName?: string): void
}

/**
 * Per-site state shared by write actions: the managed request digest and the
 * entity-type lookup cache. `createSiteConnection` makes one and hands it to
 * every action it creates; standalone factories create their own unless you
 * pass one, so share a context to share the caches:
 *
 * @example
 * const ctx = createConnectionContext(options)
 * const add = addListItem(options, ctx)
 * const update = updateListItem(options, ctx)
 */
export interface ConnectionContext {
  digests: DigestCache
  entityTypes: EntityTypeCache
}

/**
 * Creates an {@link Action} bound to a site. Call it once with your
 * {@link SiteConnectionOptions}, then call the returned action as many times
 * as needed. Write actions accept an optional {@link ConnectionContext} to
 * share the managed digest across actions.
 */
export type ActionFactory<TParams, TResponse> = (
  options: SiteConnectionOptions,
  context?: ConnectionContext
) => Action<TParams, TResponse>

/**
 * All actions bound to one site. Create with `createSiteConnection`.
 *
 * Write actions need a request digest; the connection obtains, caches and
 * refreshes one automatically. Pass `requestDigest` yourself only if you want
 * to manage it (see {@link SiteConnection.getFormDigestValue}).
 */
export type SiteConnection = {
  /**
   * Attaches a file to an existing list item.
   *
   * `POST /_api/web/lists/GetByTitle('{listName}')/items('{spId}')/AttachmentFiles/add(FileName='{fileName}')`
   *
   * @returns `data` is the server-relative URL of the new attachment.
   */
  addAttachmentToListItem: Action<AddAttachmentToListItemOptions, string>
  /**
   * Uploads a file to a document library folder, overwriting any existing
   * file with the same name. `payload` may be a `Buffer` or a `Readable`.
   *
   * `POST /_api/web/GetFolderByServerRelativeUrl('{serverRelativeUrl}/{folder}')/Files/add(url='{fileName}',overwrite=true)`
   *
   * @returns `data` is the server-relative URL of the uploaded file.
   */
  addDocumentToLibrary: Action<AddDocumentToLibraryOptions, string>
  /**
   * Creates a list item.
   *
   * `POST /_api/web/lists/GetByTitle('{listName}')/items`
   *
   * @returns `data` is the created item as a raw JSON string
   *   (`odata=nometadata`); `JSON.parse` it to read the new `Id`. (5.0 will
   *   return the parsed object.)
   * @example
   * const created = await connection.addListItem({
   *   listName: 'Tasks',
   *   payload: { Title: 'Hello' },
   * })
   * if (created.success) console.log(JSON.parse(created.data).Id)
   */
  addListItem: Action<AddListItemOptions, string>
  /**
   * Checks whether a folder exists.
   *
   * `GET /_api/web/GetFolderByServerRelativeUrl('{serverRelativeUrl}/{folder}')/Exists`
   *
   * @returns `data` is `true` or `false`. A missing folder is a successful
   *   `false`, not a `Failure`.
   */
  checkFolderExistsInLibrary: Action<CheckFolderExistsInLibraryOptions, boolean>
  /**
   * Creates a folder. The parent folder must already exist.
   *
   * `POST /_api/web/folders`
   *
   * @returns `data` is the server-relative URL of the new folder.
   */
  createFolderInLibrary: Action<CreateFolderInLibraryOptions, string>
  /**
   * Deletes a file from a document library.
   *
   * `POST /_api/web/GetFileByServerRelativeUrl('{serverRelativeUrl}/{folder}/{fileName}')` with `X-HTTP-Method: DELETE`
   *
   * @returns `data` is the deleted `fileName`.
   */
  deleteDocumentFromLibrary: Action<DeleteDocumentFromLibraryOptions, string>
  /**
   * Deletes a list item.
   *
   * `POST /_api/web/lists/GetByTitle('{listName}')/items('{spId}')` with `X-HTTP-Method: DELETE`
   *
   * @returns `data` is an empty string.
   */
  deleteListItem: Action<DeleteListItemOptions, string>
  /**
   * Performs the NTLM handshake against the site and returns the resulting
   * `Authorization` header value (NTLM Type 3 message).
   *
   * This is a low-level diagnostic: NTLM authenticates the TCP connection,
   * not the request, so the value cannot be reused for later requests. Use it
   * to verify credentials, not to obtain a `requestDigest` — that comes from
   * {@link SiteConnection.getFormDigestValue}.
   *
   * @returns `data` is the `NTLM <base64>` header value.
   */
  getAuthToken: Action<RequestOptions, string>
  /**
   * Downloads a file.
   *
   * `GET /_api/web/GetFolderByServerRelativeUrl('{serverRelativeUrl}/{folder}')/Files('{fileName}')/$value`
   *
   * @returns `data` is the file contents as a `Buffer`.
   */
  getDocumentFromLibrary: Action<GetDocumentFromLibraryOptions, Buffer>
  /**
   * Downloads a file as a stream, without buffering it in memory.
   *
   * `GET /_api/web/GetFolderByServerRelativeUrl('{serverRelativeUrl}/{folder}')/Files('{fileName}')/$value`
   *
   * @returns `data` is a `Readable` of the file contents. HTTP and auth
   *   errors are still reported as a `Failure` before any stream is returned;
   *   a network drop mid-download surfaces as an `'error'` event on the stream.
   * @example
   * const res = await connection.getDocumentStreamFromLibrary({ folder: 'Shared Documents', fileName: 'big.iso' })
   * if (res.success) await pipeline(res.data, createWriteStream('big.iso'))
   */
  getDocumentStreamFromLibrary: Action<
    GetDocumentStreamFromLibraryOptions,
    Readable
  >
  /**
   * Lists the files directly inside a folder (subfolders are not included).
   *
   * `GET /_api/web/GetFolderByServerRelativeUrl('{serverRelativeUrl}/{folder}')/Files?{params}`
   *
   * @returns `data` is the OData `value` array; each element is a SharePoint
   *   `SP.File` object (`Name`, `ServerRelativeUrl`, `Length`, `TimeLastModified`, …).
   *   `nextLink` is set when more files remain.
   */
  getFolderContents: PagedAction<GetFolderContentsOptions>
  /**
   * Like {@link SiteConnection.getFolderContents} but follows `nextLink`
   * until every file is collected (or `maxPages` is reached).
   *
   * @returns `data` is every file; if any page fails, the whole call is that
   *   `Failure` (no partial results).
   */
  getAllFolderContents: <T = unknown>(
    options: GetAllFolderContentsOptions
  ) => Promise<Result<T[]>>
  /**
   * Streams folder contents one page at a time. Yields each
   * {@link PageResult}; ends after the last page or the first failure.
   *
   * @example
   * for await (const page of connection.iterateFolderContents<SpFile>({ folder: 'Shared Documents' })) {
   *   if (!page.success) throw new Error(page.error)
   *   for (const file of page.data) console.log(file.Name)
   * }
   */
  iterateFolderContents: PagedIterator<GetAllFolderContentsOptions>
  /**
   * Obtains a request digest, required as `requestDigest` by every write
   * action.
   *
   * `POST /_api/contextinfo`
   *
   * @returns `data` is the `FormDigestValue` string. It expires (30 minutes
   *   by default); request a new one per batch of writes.
   */
  getFormDigestValue: Action<RequestOptions, string>
  /**
   * Queries one page of list items.
   *
   * `GET /_api/web/lists/GetByTitle('{listName}')/items?{params}`
   *
   * @returns `data` is the OData `value` array, typed as `T[]` (unchecked).
   *   `nextLink` is set when SharePoint has more items than it returned;
   *   pass it to {@link SiteConnection.getNextPage}, or use
   *   {@link SiteConnection.getAllListContents}.
   * @example
   * type Task = { Id: number; Title: string }
   * const params = new URLSearchParams({ $select: 'Id,Title', $top: '500' })
   * const res = await connection.getListContents<Task>({ listName: 'Tasks', params })
   */
  getListContents: PagedAction<GetListContentsOptions>
  /**
   * Like {@link SiteConnection.getListContents} but follows `nextLink` until
   * every item is collected (or `maxPages` is reached).
   *
   * @returns `data` is every item; if any page fails, the whole call is that
   *   `Failure` (no partial results).
   */
  getAllListContents: <T = unknown>(
    options: GetAllListContentsOptions
  ) => Promise<Result<T[]>>
  /**
   * Streams list items one page at a time. Yields each {@link PageResult};
   * ends after the last page or the first failure.
   *
   * @example
   * for await (const page of connection.iterateListContents<Task>({ listName: 'Tasks' })) {
   *   if (!page.success) throw new Error(page.error)
   *   for (const task of page.data) console.log(task.Title)
   * }
   */
  iterateListContents: PagedIterator<GetAllListContentsOptions>
  /**
   * Fetches the page a previous result's `nextLink` points at.
   *
   * `GET {nextLink}`
   *
   * The link must be on the connection's own host; anything else is rejected
   * with a `Failure` so credentials are never sent elsewhere.
   */
  getNextPage: PagedAction<GetNextPageOptions>
  /**
   * Reads a single list item by `ID`.
   *
   * `GET /_api/web/lists/GetByTitle('{listName}')/items('{spId}')`
   *
   * @returns `data` is the item object (`odata=nometadata`), typed as `T` (unchecked).
   */
  getListItem: TypedAction<GetListItemOptions>
  /**
   * Reads the list's entity type name, needed in `__metadata.type` when
   * creating or updating items.
   *
   * `GET /_api/web/lists/GetByTitle('{listName}')?$select=ListItemEntityTypeFullName`
   *
   * @returns `data` is e.g. `'SP.Data.TasksListItem'`.
   */
  getListItemType: Action<GetListItemTypeOptions, string>
  /**
   * Partially updates a list item (OData MERGE with `If-Match: *`, so the
   * last write wins).
   *
   * `POST /_api/web/lists/GetByTitle('{listName}')/items('{spId}')` with `X-HTTP-Method: MERGE`
   *
   * @returns `data` echoes back the `patch` string; SharePoint returns no body
   *   for a successful MERGE.
   */
  updateListItem: Action<UpdateListItemOptions, string>
}

/** Factory for a {@link PagedAction}. */
export type PagedActionFactory<TConfig> = (
  options: SiteConnectionOptions
) => PagedAction<TConfig>

/** Factory for a {@link TypedAction}. */
export type TypedActionFactory<TConfig> = (
  options: SiteConnectionOptions
) => TypedAction<TConfig>

/** Signature of `createSiteConnection`. */
export type SiteConnectionFactory = (
  options: SiteConnectionOptions
) => SiteConnection
