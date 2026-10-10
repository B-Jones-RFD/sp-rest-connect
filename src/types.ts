import type { AgentOptions } from 'node:https'

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
 * Options for write actions. Supply the request digest from
 * {@link SiteConnection.getFormDigestValue} as `requestDigest`. Digests expire
 * (30 minutes by default); fetch a fresh one per batch of writes.
 *
 * `accessToken` is the pre-4.0 name for the same value and still works.
 */
export type AuthenticatedRequestOptions = RequestOptions &
  (
    | {
        /** SharePoint request digest (`X-RequestDigest`) from {@link SiteConnection.getFormDigestValue}. */
        requestDigest: string
        accessToken?: undefined
      }
    | {
        /** @deprecated Use `requestDigest`. Same value, clearer name. */
        accessToken: string
        requestDigest?: undefined
      }
  )

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
  /** File contents. */
  payload: Buffer
}

export type AddListItemOptions = AuthenticatedRequestOptions & {
  /** List display title, as shown in the SharePoint UI (not the URL segment). */
  listName: string
  /**
   * JSON-encoded item. Must include the entity type from
   * {@link SiteConnection.getListItemType}:
   *
   * ```ts
   * JSON.stringify({ __metadata: { type: itemType }, Title: 'Hello' })
   * ```
   */
  payload: string
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
   * JSON-encoded partial item. Only the fields present are changed (OData
   * MERGE). Must include `__metadata: { type }` from
   * {@link SiteConnection.getListItemType}.
   */
  patch: string
}

/**
 * Creates an {@link Action} bound to a site. Call it once with your
 * {@link SiteConnectionOptions}, then call the returned action as many times
 * as needed.
 */
export type ActionFactory<TParams, TResponse> = (
  options: SiteConnectionOptions
) => Action<TParams, TResponse>

/**
 * All actions bound to one site. Create with `createSiteConnection`.
 *
 * Read actions need only the connection. Write actions additionally need a
 * request digest from {@link SiteConnection.getFormDigestValue}, passed as
 * `requestDigest`.
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
   * file with the same name.
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
   *   (`odata=nometadata`); `JSON.parse` it to read the new `Id`.
   * @example
   * const [type, digest] = await Promise.all([
   *   connection.getListItemType({ listName: 'Tasks' }),
   *   connection.getFormDigestValue({}),
   * ])
   * if (!type.success || !digest.success) throw new Error('setup failed')
   * const created = await connection.addListItem({
   *   requestDigest: digest.data,
   *   listName: 'Tasks',
   *   payload: JSON.stringify({ __metadata: { type: type.data }, Title: 'Hello' }),
   * })
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
   * Lists the files directly inside a folder (subfolders are not included).
   *
   * `GET /_api/web/GetFolderByServerRelativeUrl('{serverRelativeUrl}/{folder}')/Files?{params}`
   *
   * @returns `data` is the OData `value` array; each element is a SharePoint
   *   `SP.File` object (`Name`, `ServerRelativeUrl`, `Length`, `TimeLastModified`, …).
   */
  getFolderContents: Action<GetFolderContentsOptions, unknown[]>
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
   * Queries list items.
   *
   * `GET /_api/web/lists/GetByTitle('{listName}')/items?{params}`
   *
   * @returns `data` is the OData `value` array. Narrow it to your item shape:
   *   `res.data as MyItem[]`.
   * @example
   * const params = new URLSearchParams({ $select: 'Id,Title', $top: '500' })
   * const res = await connection.getListContents({ listName: 'Tasks', params })
   */
  getListContents: Action<GetListContentsOptions, unknown[]>
  /**
   * Reads a single list item by `ID`.
   *
   * `GET /_api/web/lists/GetByTitle('{listName}')/items('{spId}')`
   *
   * @returns `data` is the item object (`odata=nometadata`).
   */
  getListItem: Action<GetListItemOptions, unknown>
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

/** Signature of `createSiteConnection`. */
export type SiteConnectionFactory = (
  options: SiteConnectionOptions
) => SiteConnection
