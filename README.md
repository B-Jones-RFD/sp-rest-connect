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
const params = new URLSearchParams({ $select: 'Id,Title', $top: '500' })
const items = await connection.getListContents({ listName: 'Invoices', params })
if (!items.success) throw new Error(items.error)
console.log(items.data) // unknown[] — narrow with `as Invoice[]`

// Write: every write needs a request digest and the list's entity type
const [type, digest] = await Promise.all([
  connection.getListItemType({ listName: 'Invoices' }),
  connection.getFormDigestValue({}),
])
if (!type.success) throw new Error(type.error)
if (!digest.success) throw new Error(digest.error)

const created = await connection.addListItem({
  requestDigest: digest.data,
  listName: 'Invoices',
  payload: JSON.stringify({
    __metadata: { type: type.data },
    Title: 'INV-1042',
    Amount: 1250,
  }),
})
if (created.success) console.log(JSON.parse(created.data).Id)
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
const res = await connection.addListItem({ requestDigest, listName, payload })
if (!res.success) {
  if (res.code === 'AUTH') requestDigest = await refreshDigest()
  else if (res.code === 'TIMEOUT' || res.code === 'NETWORK') await retryLater()
  else log.error(res.error, res.details)
}
```

`error` is always a human-readable message prefixed with the action name, for
logging.

### Write operations: the request digest

SharePoint requires an `X-RequestDigest` header on every write. Obtain one
with `getFormDigestValue()` and pass it as `requestDigest` to any write action.
Digests expire (30 minutes by default), so fetch one per batch of writes.

`accessToken` is the pre-4.0 name for the same option and is still accepted,
but it is deprecated; new code should use `requestDigest`.

`getAuthToken()` is **not** this value — it returns the NTLM handshake header,
which is connection-bound and only useful as a credentials check.

### Creating and updating items

`addListItem` and `updateListItem` take a JSON **string**, and SharePoint
requires it to carry the list's entity type:

```ts
const type = await connection.getListItemType({ listName: 'Invoices' })
// type.data === 'SP.Data.InvoicesListItem'

const payload = JSON.stringify({
  __metadata: { type: type.data },
  Title: 'INV-1042',
})
```

`updateListItem` is a partial update (OData `MERGE` with `If-Match: *`): only
the fields in `patch` change, and the last writer wins.

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
`signal` aborts. Pass `retryOn(failure, attempt)` to change what counts as
retryable; `isTransientFailure` (the default) is exported if you want to
extend it.

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

All option types are exported (`AddListItemOptions`, `GetListContentsOptions`,
…) and every member below is documented inline, so hovering in your editor
shows the same details. `requestDigest` means a digest from
`getFormDigestValue`; `listName` is the list's display title.

### Lists

| Action                                                                          | Required options                              | `data`                                                                         |
| ------------------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------ |
| `getListContents<T>({ listName, params? })`                                     | —                                             | `T[]` — one page; `nextLink` set when more remain. ≤ 100 items without `$top`. |
| `getAllListContents<T>({ listName, params?, maxPages? })`                       | —                                             | `T[]` — every page concatenated.                                               |
| `iterateListContents<T>({ listName, params?, maxPages? })`                      | —                                             | async iterator of `PageResult<T>`.                                             |
| `getNextPage<T>({ nextLink })`                                                  | —                                             | `T[]` — the linked page; same-origin links only.                               |
| `getListItem<T>({ listName, spId })`                                            | —                                             | `T` — the item object.                                                         |
| `getListItemType({ listName })`                                                 | —                                             | `string` — e.g. `'SP.Data.InvoicesListItem'`.                                  |
| `addListItem({ requestDigest, listName, payload })`                             | `payload`: JSON string with `__metadata.type` | `string` — created item as raw JSON; `JSON.parse` for the new `Id`.            |
| `updateListItem({ requestDigest, listName, spId, patch })`                      | `patch`: JSON string with `__metadata.type`   | `string` — echoes `patch` (SharePoint returns no body).                        |
| `deleteListItem({ requestDigest, listName, spId })`                             | —                                             | `''`                                                                           |
| `addAttachmentToListItem({ requestDigest, listName, spId, fileName, payload })` | `payload`: `Buffer`                           | `string` — server-relative URL of the attachment.                              |

### Document libraries

| Action                                                               | Required options    | `data`                                                                                    |
| -------------------------------------------------------------------- | ------------------- | ----------------------------------------------------------------------------------------- |
| `getFolderContents<T>({ folder, params? })`                          | —                   | `T[]` — one page of `SP.File` objects (`Name`, `Length`, …); `nextLink` when more remain. |
| `getAllFolderContents<T>({ folder, params?, maxPages? })`            | —                   | `T[]` — every page concatenated.                                                          |
| `iterateFolderContents<T>({ folder, params?, maxPages? })`           | —                   | async iterator of `PageResult<T>`.                                                        |
| `getDocumentFromLibrary({ folder, fileName })`                       | —                   | `Buffer` — file contents.                                                                 |
| `checkFolderExistsInLibrary({ folder })`                             | —                   | `boolean` — a missing folder is a successful `false`.                                     |
| `createFolderInLibrary({ requestDigest, folder })`                   | parent must exist   | `string` — server-relative URL of the new folder.                                         |
| `addDocumentToLibrary({ requestDigest, folder, fileName, payload })` | `payload`: `Buffer` | `string` — server-relative URL; overwrites existing files.                                |
| `deleteDocumentFromLibrary({ requestDigest, folder, fileName })`     | —                   | `string` — the deleted `fileName`.                                                        |

### Authentication

| Action                   | `data`                                                                     |
| ------------------------ | -------------------------------------------------------------------------- |
| `getFormDigestValue({})` | `string` — request digest for `requestDigest`.                             |
| `getAuthToken({})`       | `string` — NTLM Type 3 `Authorization` header. Diagnostic only; see above. |

### Low-level NTLM transport

The NTLM helpers `get`, `post` and `auth` are still exported but
**deprecated**: they are internal transport, offer no `Result` wrapping (they
throw `SpRestError` on non-2xx), and will be removed from the public API in
5.0. If you need a SharePoint endpoint this package does not wrap, please open
an issue instead.

`SpRestError` and `parseSharePointError(body)` are exported and supported; the
latter extracts `{ code, message }` from either OData error-body shape.

## Contributing

This is a pet project to save me time at work, but issues and PRs are welcome
at [github.com/B-Jones-RFD/sp-rest-connect](https://github.com/B-Jones-RFD/sp-rest-connect/issues).

```sh
pnpm install
pnpm dev        # vitest in watch mode
pnpm ci         # lint, test, build
pnpm changeset  # describe your change for the release notes
```

## Versioning

[SemVer](https://semver.org/). See the [CHANGELOG](CHANGELOG.md) for release notes and breaking changes.

## License

[MIT](LICENSE)
