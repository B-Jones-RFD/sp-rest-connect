[![CI](https://github.com/B-Jones-RFD/sp-rest-connect/actions/workflows/main.yml/badge.svg?branch=main)](https://github.com/B-Jones-RFD/sp-rest-connect/actions/workflows/main.yml)
[![npm version](https://img.shields.io/npm/v/%40b-jones-rfd%2Fsp-rest-connect?style=flat-square)](https://www.npmjs.com/package/@b-jones-rfd/sp-rest-connect)
[![npm unpacked size](https://img.shields.io/npm/unpacked-size/%40b-jones-rfd%2Fsp-rest-connect?style=flat-square)](https://www.npmjs.com/package/@b-jones-rfd/sp-rest-connect)
[![node](https://img.shields.io/node/v/%40b-jones-rfd%2Fsp-rest-connect?style=flat-square)](https://nodejs.org)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)

# SharePoint REST Connect

A small, dependency-free Node.js client for **on-premises SharePoint** REST
services, with built-in NTLMv2 authentication. Read and write list items,
upload and download documents, manage folders. Every call returns a typed
`Result` instead of throwing.

I got tired of rewriting these for work projects.

## Requirements

- **Node.js 20 or later.**
- **On-premises SharePoint** — 2013, 2016, 2019 or Subscription Edition — with
  NTLM authentication enabled. SharePoint Online is **not** supported; it does
  not accept NTLM.
- Nothing else. There are no runtime dependencies: NTLM is implemented on top
  of `node:http`/`node:https` and `node:crypto`.

### Authentication

Only **NTLMv2** is supported. SharePoint 2013 and later negotiate it by
default. If a server does not send the target information NTLMv2 requires,
requests fail with `NTLM server did not send target info` rather than silently
downgrading to NTLMv1, which is insecure and unavailable in Node's OpenSSL 3
build.

## Installation

```sh
npm i @b-jones-rfd/sp-rest-connect
# or
pnpm add @b-jones-rfd/sp-rest-connect
# or
yarn add @b-jones-rfd/sp-rest-connect
```

## Quick start

```ts
import { createSiteConnection } from '@b-jones-rfd/sp-rest-connect'

const connection = createSiteConnection({
  username: 'jsmith',
  password: process.env.SP_PASSWORD!,
  domain: 'CONTOSO', // NTLM (NetBIOS) domain, not a DNS name
  site: 'sharepoint.contoso.local',
  serverRelativeUrl: '/sites/finance',
})

// Read
type Invoice = { Id: number; Title: string; Amount: number }
const params = new URLSearchParams({ $select: 'Id,Title,Amount', $top: '500' })
const items = await connection.getAllListContents<Invoice>({
  listName: 'Invoices',
  params,
})
if (!items.success) throw new Error(items.error)
console.log(items.data.map((i) => i.Title))

// Write: the request digest and the list's entity type are handled for you
const created = await connection.addListItem({
  listName: 'Invoices',
  payload: { Title: 'INV-1042', Amount: 1250 },
})
if (created.success) console.log(created.data.Id)
```

More examples, including document upload, are in [`examples/basic.ts`](examples/basic.ts).

## Usage

### Site connection

`createSiteConnection(options)` binds every action to one site and returns a
`SiteConnection`. Creating a connection performs no network I/O; credentials
are captured in closures and used on each call. It does check the shape of the
options and throws a `TypeError` for obvious mistakes (a protocol inside
`site`, a `serverRelativeUrl` without a leading slash), so misconfiguration
fails at startup rather than as an opaque 404 later.

| Option              | Type                 | Required | Default         | Description                                                                                                   |
| ------------------- | -------------------- | -------- | --------------- | ------------------------------------------------------------------------------------------------------------- |
| `username`          | `string`             | Y        |                 | Windows account name, without the domain.                                                                     |
| `password`          | `string`             | Y        |                 | Account password. Read it from the environment rather than hard-coding it.                                    |
| `site`              | `string`             | Y        |                 | Host name only, e.g. `'sharepoint.contoso.local'`.                                                            |
| `serverRelativeUrl` | `string`             | Y        |                 | Site (web) path, e.g. `'/sites/finance'`. All `folder` arguments are resolved relative to this.               |
| `protocol`          | `'https' \| 'http'`  | N        | `'https'`       |                                                                                                               |
| `domain`            | `string`             | N        | `''`            | NTLM (NetBIOS) domain, e.g. `'CONTOSO'`. Leave empty for a server-local account.                              |
| `hostname`          | `string`             | N        | `os.hostname()` | Workstation name sent in the NTLM handshake. Rarely needs changing.                                           |
| `agentOptions`      | `https.AgentOptions` | N        |                 | TLS / socket options for the HTTP agent. See [TLS and internal certificates](#tls-and-internal-certificates). |
| `retry`             | `RetryOptions`       | N        |                 | Retry transient failures on read actions. See [Retrying transient failures](#retrying-transient-failures).    |

### Standalone actions

For single use, or to import only what you need, each action is also exported
as a factory. Call it with the same options object to get a reusable action:

```ts
import { getListContents } from '@b-jones-rfd/sp-rest-connect'

const fetchList = getListContents(siteConnectionOptions)
const items = await fetchList({ listName: 'Invoices' })
```

### Results

Every action resolves to a `Result<T>` and never throws:

```ts
type Result<T> = Success<T> | Failure

type Success<T> = { success: true; data: T }
type Failure = {
  success: false
  error: string // "Error in getListContents: HTTP 404: List 'Tasks' does not exist"
  code: FailureCode
  status?: number // HTTP status, for HTTP / AUTH failures
  details?: { code?: string; message?: string } // SharePoint's own error, when it sent one
  retryAfterMs?: number // from a Retry-After header, when present
}
```

Check `success` to narrow, then branch on `code` rather than on the message
text:

| `code`    | Meaning                                                                                 |
| --------- | --------------------------------------------------------------------------------------- |
| `HTTP`    | SharePoint answered with a non-2xx status (other than 401/403). See `status`/`details`. |
| `AUTH`    | 401 or 403 — bad credentials, NTLM rejected, or a missing/expired request digest.       |
| `TIMEOUT` | No bytes arrived for `timeout` ms.                                                      |
| `ABORTED` | Cancelled through `signal`.                                                             |
| `NETWORK` | DNS, connection or TLS failure before any response.                                     |
| `PARSE`   | A 2xx response whose body was not in the expected shape.                                |
| `UNKNOWN` | Anything else.                                                                          |

```ts
const res = await connection.addListItem({ listName, payload })
if (!res.success) {
  if (res.code === 'AUTH') await alertOps('credentials rejected')
  else if (res.code === 'TIMEOUT' || res.code === 'NETWORK') await retryLater()
  else log.error(res.error, res.details)
}
```

`error` is always a human-readable message prefixed with the action name, for
logging.

### Write operations: the request digest

SharePoint requires an `X-RequestDigest` header on every write. The connection
takes care of it: the first write fetches a digest from `/_api/contextinfo`,
caches it until a minute before SharePoint says it expires (30 minutes by
default), and if SharePoint still rejects it with 403 the digest is refreshed
and the write retried once. Concurrent writes share a single fetch.

To manage the digest yourself, pass `requestDigest` explicitly — the cache is
then bypassed, and no automatic retry happens. `getFormDigestValue()` fetches
one.

Standalone action factories each keep their own cache. To share one, create a
context and pass it as the second argument:

```ts
import {
  createConnectionContext,
  addListItem,
  deleteListItem,
} from '@b-jones-rfd/sp-rest-connect'

const ctx = createConnectionContext(options)
const add = addListItem(options, ctx)
const remove = deleteListItem(options, ctx) // shares add's digest
```

`getAuthToken()` is **not** this value — it returns the NTLM handshake header,
which is connection-bound and only useful as a credentials check.

### Creating and updating items

`addListItem` and `updateListItem` take a plain object. SharePoint needs the
list's entity type (`__metadata.type`) on the body; the connection looks it up
with `getListItemType` the first time it sees a list and caches it:

```ts
await connection.addListItem({
  listName: 'Invoices',
  payload: { Title: 'INV-1042', Amount: 1250 },
})

await connection.updateListItem({
  listName: 'Invoices',
  spId: 17,
  patch: { Amount: 1300 },
})
```

Include `__metadata: { type: 'SP.Data.InvoicesListItem' }` in the object
yourself to skip the lookup. `addListItem` resolves to the created item as
SharePoint returned it, with its new `Id`; pass a type parameter for the rest
of the shape (`addListItem<Invoice>(...)`).

`updateListItem` is a partial update (OData `MERGE` with `If-Match: *`): only
the fields in `patch` change, and the last writer wins.

### Large files

`addDocumentToLibrary` accepts a `Readable` as `payload`, and
`getDocumentStreamFromLibrary` returns one, so files never have to fit in
memory:

```ts
import { createReadStream, createWriteStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'

const { size } = await stat('backup.zip')
await connection.addDocumentToLibrary({
  folder: 'Shared Documents/Archive',
  fileName: 'backup.zip',
  payload: createReadStream('backup.zip'),
  contentLength: size, // optional; without it the upload is chunked
})

const download = await connection.getDocumentStreamFromLibrary({
  folder: 'Shared Documents/Archive',
  fileName: 'backup.zip',
})
if (download.success)
  await pipeline(download.data, createWriteStream('restored.zip'))
```

A stream can only be sent once, so if the managed digest turns out to be stale
mid-upload the write fails with code `AUTH` instead of being retried; call
again. HTTP errors on a download are reported as a `Failure` before any
stream is returned.

### Folders

Every `folder` argument is relative to `serverRelativeUrl` and starts with the
library name: `'Shared Documents'`, `'Shared Documents/Reports/2026'`.

### Typing results

`getListContents`, `getFolderContents` and `getListItem` take a type parameter
for the item shape. It is an assertion, not validation — SharePoint's JSON is
not checked against it — but it saves a cast at every call site:

```ts
type Task = { Id: number; Title: string; Status: 'Open' | 'Done' }

const res = await connection.getListContents<Task>({
  listName: 'Tasks',
  params,
})
if (res.success) res.data.filter((t) => t.Status === 'Open')
```

### Paging

SharePoint returns at most `$top` items per response (100 if you don't set
it) and, when more remain, a `nextLink`. You have three ways to deal with it:

```ts
// 1. Everything, in one array. Fails as a whole if any page fails.
const all = await connection.getAllListContents<Task>({
  listName: 'Tasks',
  params,
})

// 2. Page by page, as an async iterator. Ends after the last page or the first failure.
for await (const page of connection.iterateListContents<Task>({
  listName: 'Tasks',
})) {
  if (!page.success) throw new Error(page.error)
  process(page.data)
}

// 3. Manually: a single page exposes `nextLink`, which `getNextPage` follows.
const first = await connection.getListContents<Task>({ listName: 'Tasks' })
if (first.success && first.nextLink) {
  const second = await connection.getNextPage<Task>({
    nextLink: first.nextLink,
  })
}
```

`getAllFolderContents` / `iterateFolderContents` do the same for document
library folders. Both `getAll*` and `iterate*` accept `maxPages` to cap the
walk. `getNextPage` only follows links on the connection's own host, so your
credentials are never sent elsewhere.

### Retrying transient failures

Set `retry` on the connection to retry **read** actions that fail with
`NETWORK`, `TIMEOUT`, or HTTP 429/502/503/504. Writes are never retried
automatically — a retried `addListItem` could create duplicates.

```ts
const connection = createSiteConnection({
  ...options,
  retry: { retries: 3, baseDelayMs: 300, maxDelayMs: 5000 },
})
```

Delays grow exponentially with full jitter and stop early if the request's
`signal` aborts. When SharePoint sends a `Retry-After` header (429/503), that
wait is used instead — or, if it is longer than `maxDelayMs`, retrying stops
and the failure comes back with `retryAfterMs` set so you can decide. Pass
`retryOn(failure, attempt)` to change what counts as retryable;
`isTransientFailure` (the default) is exported if you want to extend it.

### CAML queries and the 5,000-item threshold

`$filter` on an unindexed column fails once a list passes SharePoint's list
view threshold (5,000 items by default). `queryListItems` sends a CAML query
to `GetItems` instead, which SQL Server evaluates against indexed columns:

```ts
const open = await connection.queryListItems<Task>({
  listName: 'Tasks',
  viewXml: `<View>
    <Query><Where><Eq><FieldRef Name='Status'/><Value Type='Text'>Open</Value></Eq></Where></Query>
    <RowLimit>500</RowLimit>
  </View>`,
  params: new URLSearchParams({ $select: 'Id,Title,Status' }),
})
```

Page by putting `<RowLimit>` in the view and passing `pagingInfo` built from
the last item of the previous page — `Paged=TRUE&p_ID=${last.Id}` when the view
is ordered by ID (the default). `GetItems` is a POST, so the managed request
digest is used; it is still treated as a read for `retry` purposes.

### Batching requests

`batch` sends several REST calls in one round trip (SharePoint 2016 and
later; 2013 has no `$batch` endpoint). Reads go as individual parts;
consecutive writes are grouped into one changeset, which SharePoint applies
atomically. Each sub-request gets its own response — a failing one does not
fail the batch, so check `ok`:

```ts
const res = await connection.batch({
  requests: [
    { method: 'GET', path: `_api/web/lists/GetByTitle('Tasks')/items?$top=5` },
    {
      method: 'POST',
      path: `_api/web/lists/GetByTitle('Tasks')/items`,
      body: { __metadata: { type }, Title: 'A' },
    },
    {
      method: 'MERGE',
      path: `_api/web/lists/GetByTitle('Tasks')/items(7)`,
      body: { __metadata: { type }, Title: 'B' },
    },
    { method: 'DELETE', path: `_api/web/lists/GetByTitle('Tasks')/items(8)` },
  ],
})
if (res.success) {
  const [list, created, merged, deleted] = res.data
  if (created.ok) console.log((created.json as { Id: number }).Id)
}
```

`path` is relative to the site (`_api/...`) or an absolute URL on the same
origin. Defaults per sub-request: `Accept: application/json;odata=nometadata`,
`Content-Type: application/json;odata=verbose` when there is a body, and
`If-Match: *` on `MERGE`/`PATCH`/`DELETE`; override any of them with `headers`.
Bodies that create or merge list items still need `__metadata.type` — the
batch does not resolve entity types for you (`getListItemType` does).

### Common options

Every action accepts:

- `timeout` — socket **inactivity** timeout in milliseconds. The request fails
  with code `TIMEOUT` when no bytes arrive for this long. It is not a cap on
  total duration; a slow but steady download never times out. Omit for none.
- `signal` — an `AbortSignal`. Aborting yields a `Failure` with code
  `ABORTED`. For a hard deadline on the whole call, use
  `signal: AbortSignal.timeout(30_000)`.

`getDocumentFromLibrary` additionally accepts `binary` (default `true`), which
returns the file as a `Buffer`; there is no reason to turn it off.

### TLS and internal certificates

On-premises SharePoint is usually behind a certificate from an internal CA.
Rather than setting `NODE_TLS_REJECT_UNAUTHORIZED=0` process-wide, pass the CA
to the connection:

```ts
import { readFileSync } from 'node:fs'

const connection = createSiteConnection({
  ...options,
  agentOptions: { ca: readFileSync('/etc/ssl/corp-root-ca.pem') },
})
```

`agentOptions` accepts anything `https.Agent` does — `ca`, `cert`/`key` for
client certificates, `rejectUnauthorized`, `localAddress`, a custom `lookup`,
and so on — except `keepAlive` and `maxSockets`, which the NTLM handshake
fixes. The agent is created per request and destroyed afterwards.

### Special characters

List titles, folder paths and file names are percent-encoded and have
apostrophes doubled for OData automatically, so `"Bob's Tasks"` and
`'Shared Documents/Q1 2026'` work as written.

## API

Full generated reference:
**[b-jones-rfd.github.io/sp-rest-connect](https://b-jones-rfd.github.io/sp-rest-connect/)**.

All option types are exported (`AddListItemOptions`, `GetListContentsOptions`,
…) and every member below is documented inline, so hovering in your editor
shows the same details. Every write action also accepts the common
`requestDigest` option (managed automatically when omitted); `listName` is the
list's display title.

### Lists

| Action                                                           | Required options    | `data`                                                                         |
| ---------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------ |
| `getListContents<T>({ listName, params? })`                      | —                   | `T[]` — one page; `nextLink` set when more remain. ≤ 100 items without `$top`. |
| `getAllListContents<T>({ listName, params?, maxPages? })`        | —                   | `T[]` — every page concatenated.                                               |
| `iterateListContents<T>({ listName, params?, maxPages? })`       | —                   | async iterator of `PageResult<T>`.                                             |
| `getNextPage<T>({ nextLink })`                                   | —                   | `T[]` — the linked page; same-origin links only.                               |
| `queryListItems<T>({ listName, viewXml, pagingInfo?, params? })` | —                   | `T[]` — CAML query results via `GetItems`.                                     |
| `getListItem<T>({ listName, spId })`                             | —                   | `T` — the item object.                                                         |
| `getListItemType({ listName })`                                  | —                   | `string` — e.g. `'SP.Data.InvoicesListItem'`.                                  |
| `addListItem<T>({ listName, payload })`                          | `payload`: object   | `T & { Id: number }` — the created item.                                       |
| `updateListItem({ listName, spId, patch })`                      | `patch`: object     | `string` — the serialised patch (SharePoint returns no body).                  |
| `deleteListItem({ listName, spId })`                             | —                   | `''`                                                                           |
| `addAttachmentToListItem({ listName, spId, fileName, payload })` | `payload`: `Buffer` | `string` — server-relative URL of the attachment.                              |

### Document libraries

| Action                                                                | Required options                | `data`                                                                                    |
| --------------------------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------- |
| `getFolderContents<T>({ folder, params? })`                           | —                               | `T[]` — one page of `SP.File` objects (`Name`, `Length`, …); `nextLink` when more remain. |
| `getAllFolderContents<T>({ folder, params?, maxPages? })`             | —                               | `T[]` — every page concatenated.                                                          |
| `iterateFolderContents<T>({ folder, params?, maxPages? })`            | —                               | async iterator of `PageResult<T>`.                                                        |
| `getDocumentFromLibrary({ folder, fileName })`                        | —                               | `Buffer` — file contents.                                                                 |
| `getDocumentStreamFromLibrary({ folder, fileName })`                  | —                               | `Readable` — file contents, unbuffered.                                                   |
| `checkFolderExistsInLibrary({ folder })`                              | —                               | `boolean` — a missing folder is a successful `false`.                                     |
| `createFolderInLibrary({ folder })`                                   | parent must exist               | `string` — server-relative URL of the new folder.                                         |
| `addDocumentToLibrary({ folder, fileName, payload, contentLength? })` | `payload`: `Buffer \| Readable` | `string` — server-relative URL; overwrites existing files.                                |
| `deleteDocumentFromLibrary({ folder, fileName })`                     | —                               | `string` — the deleted `fileName`.                                                        |

### Batching

| Action                | Required options | `data`                                                                            |
| --------------------- | ---------------- | --------------------------------------------------------------------------------- |
| `batch({ requests })` | SharePoint 2016+ | `BatchResponse[]` — `{ status, ok, headers, body, json? }` per request, in order. |

### Authentication

| Action                   | `data`                                                                       |
| ------------------------ | ---------------------------------------------------------------------------- |
| `getFormDigestValue({})` | `string` — a request digest, if you want to manage `requestDigest` yourself. |
| `getAuthToken({})`       | `string` — NTLM Type 3 `Authorization` header. Diagnostic only; see above.   |

### Errors

`SpRestError` and `parseSharePointError(body)` are exported. The former is
what the internal transport throws on a non-2xx response before an action
turns it into a `Failure`; the latter extracts `{ code, message }` from either
OData error-body shape. The NTLM transport itself is not part of the public
API. If you need a SharePoint endpoint this package does not wrap, please open
an issue.

## Migrating to 5.0

- **`accessToken` is gone.** Use `requestDigest`, or omit it and let the
  connection manage the digest.
- **`addListItem` / `updateListItem` take objects only.** Replace
  `payload: JSON.stringify({ __metadata: { type }, ... })` with
  `payload: { ... }` — the entity type is resolved for you.
- **`addListItem` resolves to the created item**, not a JSON string. Replace
  `JSON.parse(res.data).Id` with `res.data.Id`.
- **The NTLM helpers (`get`, `post`, `auth`, `request`, message builders) are
  no longer exported.**

Everything added in 4.x — structured `Failure` codes, `signal`, `agentOptions`,
`retry`, typed reads, paging, the managed digest, streams — is unchanged.

## Contributing

This is a pet project to save me time at work, but issues and PRs are welcome
at [github.com/B-Jones-RFD/sp-rest-connect](https://github.com/B-Jones-RFD/sp-rest-connect/issues).

```sh
pnpm install
pnpm dev        # vitest in watch mode
pnpm ci         # lint, test, build, package checks
pnpm docs       # generate the API reference into docs/
pnpm changeset  # describe your change for the release notes
```

## Versioning

[SemVer](https://semver.org/). See the [CHANGELOG](CHANGELOG.md) for release notes and breaking changes.

## License

[MIT](LICENSE)
