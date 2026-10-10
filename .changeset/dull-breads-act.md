---
'@b-jones-rfd/sp-rest-connect': patch
---

Fix ESM type resolution and tighten the low-level `auth()` helper.- `package.json` exports now point ESM consumers at `dist/index.d.mts`, so `import { createSiteConnection } from '@b-jones-rfd/sp-rest-connect'` under `moduleResolution: node16`/`nodenext` resolves ESM types instead of CJS ones masquerading as ESM. Adds `"type": "commonjs"` explicitly.- `auth()` / `getAuthToken` now share the main NTLM transport: they honour `timeout`, release their socket, and fail with `Server did not issue an NTLM challenge (HTTP <status>)` when the server answers without a 401 instead of a misleading "missing www-authenticate" error.- `get`, `post` and `auth` are marked `@deprecated`; they are internal transport and will leave the public API in 5.0.- CI now runs `publint` and `@arethetypeswrong/cli` against the packed tarball.
