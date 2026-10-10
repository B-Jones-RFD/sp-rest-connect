# @b-jones-rfd/sp-rest-connect

## 4.0.0

### Major Changes

- 199f0d1: Breaking: binary is no longer accepted by actions other than getDocumentFromLibrary (it could only produce a failure there). List titles, folder paths and file names in request URLs are now percent-encoded with OData apostrophe escaping, so names containing spaces, #, % or ' work. Added requestDigest as the preferred name for accessToken on write actions (accessToken still works, now deprecated). Exported a named, documented option type for every action, added JSDoc across the public API, added exports/sideEffects to package.json, rewrote the README, and replaced the broken Bundlephobia badge.

## 3.1.0

### Minor Changes

- 756639a: Export named option types for every action, add JSDoc across the public API, add exports map and sideEffects: false, rewrite README (request-digest flow, return values, folder semantics), replace broken Bundlephobia badge.

## 3.0.0

### Major Changes

- bef5da3: folder is now resolved relative to serverRelativeUrl in addDocumentToLibrary, checkFolderExistsInLibrary and createFolderInLibrary, matching the other folder methods and the README. Callers that passed a full server-relative path to these three methods must drop the site prefix.

## 2.0.0

### Major Changes

- 1e71a59: Replace the `httpntlm` peer dependency with an in-house NTLM implementation. The package now has zero runtime dependencies.

  **Breaking changes**

  - `httpntlm` is no longer a peer dependency and no longer needs to be installed alongside this package. Remove it from your project if nothing else uses it.
  - Only NTLMv2 is supported. Servers that do not send NTLM target information (i.e. do not negotiate extended security) now fail with `NTLM server did not send target info` instead of falling back to NTLMv1/LM. SharePoint 2013 and later negotiate NTLMv2 by default, so most consumers are unaffected.
  - Node 22 or later is required (already declared in `engines`, now relied upon).

  **Internals**

  - NTLM Type 1/2/3 messages, NTOWFv2 and the NTLMv2/LMv2 responses are implemented in `src/ntlm/messages.ts`, with MD4 hand-rolled in `src/ntlm/md4.ts` because Node's OpenSSL 3 build does not expose it.
  - The three-leg handshake runs over `node:http`/`node:https` on a single keep-alive socket per request (`src/ntlm/request.ts`).
  - `get`, `post` and `auth` keep their existing signatures and error behaviour; `getAuthToken` still returns the Type 3 `Authorization` header value.
  - Test suite now covers RFC 1320 and MS-NLMP §4.2 vectors plus an in-process fake NTLM server exercising the handshake.

## 1.0.8

### Patch Changes

- 93472e2: Fix checkFolderExistsInLibrary returning an error for non-existent folders, fix hanging requests on empty responses, correct Content-Length for non-ASCII payloads, and fix README/CHANGELOG typos

## 1.0.7

### Patch Changes

- 22017f7: remove node version locks

## 1.0.6

### Patch Changes

- 7bca87d: Fix deployments

## 1.0.5

### Patch Changes

- aeee42c: Test publishing

## 1.0.4

### Patch Changes

- 50c400e: Further publish tests

## 1.0.3

### Patch Changes

- 9259eb4: NPM publishing change

## 1.0.2

### Patch Changes

- 1e63f4b: Configure trusted publishing

## 1.0.1

### Patch Changes

- 4ddb1a3: Resolve type error

## 1.0.0

### Major Changes

- 0cd91e1: Move to stable

## 0.6.0

### Minor Changes

- 8643fc7: Added support to set timeout and binary in configuration

## 0.5.2

### Patch Changes

- a475240: Improved error messaging

## 0.5.1

### Patch Changes

- eb038e8: Remove logging

## 0.5.0

### Minor Changes

- faec6db: Add option to get bearer token update FormDigestValue naming convention

## 0.4.9

### Patch Changes

- f2244ef: Remove logging

## 0.4.8

### Patch Changes

- 80b56bf: Revert type changes

## 0.4.7

### Patch Changes

- 15d2f44: Update return type for binary files

## 0.4.6

### Patch Changes

- 7ea31ed: Stabilize peer dependency version

## 0.4.5

### Patch Changes

- f69e161: Resolve issue with addListItem return type

## 0.4.4

### Patch Changes

- 4d7c1ae: Export get and post methods

## 0.4.3

### Patch Changes

- 5b99e0d: Updated return type for addListItem to SP response

## 0.4.2

### Patch Changes

- af08e1e: Resolved type issue with SiteConnection and factory function

## 0.4.1

### Patch Changes

- aeabde7: Moved httpntlm to peerDependency removed logging

## 0.4.0

### Minor Changes

- f1a4c6a: getDocumentFromLibrary returns binary data in Buffer

## 0.3.6

### Patch Changes

- b6a98ad: Added methods for checking folder exists and creating a folder in a document library

## 0.3.5

### Patch Changes

- d3b627a: Added params option to getFolderContents

## 0.3.4

### Patch Changes

- 5d8adc1: Completed testing of actions

## 0.3.3

### Patch Changes

- 31baffb: Added action for getting item type for a list

## 0.3.2

### Patch Changes

- 2b7bde8: Updated Readme

## 0.3.1

### Patch Changes

- e6693f5: Added types to package export
  Further enumeration of types

## 0.3.0

### Minor Changes

- 8991959: Updated API to export factory methods and added unit tests for utils

## 0.2.0

### Minor Changes

- f3619ae: getList and getDocument library methods validated

## 0.1.1

### Patch Changes

- e9f0365: Updated readme and sandbox example

## 0.1.0

### Minor Changes

- 9606246: Added initial API

## 0.0.3

### Patch Changes

- 6d57af5: Update package name

## 0.0.2

### Patch Changes

- 5150cb1: Initial Commit
