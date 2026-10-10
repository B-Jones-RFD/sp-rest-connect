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

- **Node.js 22 or later.**
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
  accessToken: digest.data,
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
are captured in closures and used on each call.

| Option              | Type                | Required | Default         | Description                                                                                     |
| ------------------- | ------------------- | -------- | --------------- | ----------------------------------------------------------------------------------------------- |
| `username`          | `string`            | Y        |                 | Windows account name, without the domain.                                                       |
| `password`          | `string`            | Y        |                 | Account password. Read it from the environment rather than hard-coding it.                      |
| `site`              | `string`            | Y        |                 | Host name only, e.g. `'sharepoint.contoso.local'`.                                              |
| `serverRelativeUrl` | `string`            | Y        |                 | Site (web) path, e.g. `'/sites/finance'`. All `folder` arguments are resolved relative to this. |
| `protocol`          | `'https' \| 'http'` | N        | `'https'`       |                                                                                                 |
| `domain`            | `string`            | N        | `''`            | NTLM (NetBIOS) domain, e.g. `'CONTOSO'`. Leave empty for a server-local account.                |
| `hostname`          | `string`            | N        | `os.hostname()` | Workstation name sent in the NTLM handshake. Rarely needs changing.                             |

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
type Result<T> = { success: true; data: T } | { success: false; error: string }
```

Check `success` to narrow. Error messages are prefixed with the action name,
e.g. `Error in getListContents: ...`.

### Write operations: the request digest

SharePoint requires an `X-RequestDigest` header on every write. Obtain one
with `getFormDigestValue()` and pass it as `accessToken` to any write action.
Digests expire (30 minutes by default), so fetch one per batch of writes.

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

### Common options

Every action also accepts:

| Option    | Type      | Default | Description                                                                                                                                                                                 |
| --------- | --------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `timeout` | `number`  | none    | Socket inactivity timeout in milliseconds.                                                                                                                                                  |
| `binary`  | `boolean` | `false` | Return the raw body as a `Buffer` instead of a string. Only `getDocumentFromLibrary` uses this (default `true` there); other actions need a string body and will return a `Failure` if set. |

## API

All option types are exported (`AddListItemOptions`, `GetListContentsOptions`,
…) and every member below is documented inline, so hovering in your editor
shows the same details. `accessToken` means a digest from
`getFormDigestValue`; `listName` is the list's display title.

### Lists

| Action                                                                        | Required options                              | `data`                                                                 |
| ----------------------------------------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------- |
| `getListContents({ listName, params? })`                                      | —                                             | `unknown[]` — OData `value` array. Without `$top` you get ≤ 100 items. |
| `getListItem({ listName, spId })`                                             | —                                             | `unknown` — the item object.                                           |
| `getListItemType({ listName })`                                               | —                                             | `string` — e.g. `'SP.Data.InvoicesListItem'`.                          |
| `addListItem({ accessToken, listName, payload })`                             | `payload`: JSON string with `__metadata.type` | `string` — created item as raw JSON; `JSON.parse` for the new `Id`.    |
| `updateListItem({ accessToken, listName, spId, patch })`                      | `patch`: JSON string with `__metadata.type`   | `string` — echoes `patch` (SharePoint returns no body).                |
| `deleteListItem({ accessToken, listName, spId })`                             | —                                             | `''`                                                                   |
| `addAttachmentToListItem({ accessToken, listName, spId, fileName, payload })` | `payload`: `Buffer`                           | `string` — server-relative URL of the attachment.                      |

### Document libraries

| Action                                                             | Required options    | `data`                                                     |
| ------------------------------------------------------------------ | ------------------- | ---------------------------------------------------------- |
| `getFolderContents({ folder, params? })`                           | —                   | `unknown[]` — `SP.File` objects (`Name`, `Length`, …).     |
| `getDocumentFromLibrary({ folder, fileName })`                     | —                   | `Buffer` — file contents.                                  |
| `checkFolderExistsInLibrary({ folder })`                           | —                   | `boolean` — a missing folder is a successful `false`.      |
| `createFolderInLibrary({ accessToken, folder })`                   | parent must exist   | `string` — server-relative URL of the new folder.          |
| `addDocumentToLibrary({ accessToken, folder, fileName, payload })` | `payload`: `Buffer` | `string` — server-relative URL; overwrites existing files. |
| `deleteDocumentFromLibrary({ accessToken, folder, fileName })`     | —                   | `string` — the deleted `fileName`.                         |

### Authentication

| Action                   | `data`                                                                     |
| ------------------------ | -------------------------------------------------------------------------- |
| `getFormDigestValue({})` | `string` — request digest for `accessToken`.                               |
| `getAuthToken({})`       | `string` — NTLM Type 3 `Authorization` header. Diagnostic only; see above. |

### Low-level NTLM transport

The NTLM layer is exported for advanced use (`request`, `get`, `post`, `auth`,
and the message builders in `createType1Message` / `parseType2Message` /
`createType3Message`). These are stable but undocumented here; see the inline
JSDoc in `src/ntlm/` if you need to call SharePoint endpoints this package
does not wrap.

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
