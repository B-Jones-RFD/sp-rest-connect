---
'@b-jones-rfd/sp-rest-connect': major
---

Breaking: binary is no longer accepted by actions other than getDocumentFromLibrary (it could only produce a failure there). List titles, folder paths and file names in request URLs are now percent-encoded with OData apostrophe escaping, so names containing spaces, #, % or ' work. Added requestDigest as the preferred name for accessToken on write actions (accessToken still works, now deprecated). Exported a named, documented option type for every action, added JSDoc across the public API, added exports/sideEffects to package.json, rewrote the README, and replaced the broken Bundlephobia badge.
