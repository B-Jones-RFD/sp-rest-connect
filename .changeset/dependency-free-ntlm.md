---
'@b-jones-rfd/sp-rest-connect': major
---

Replace the `httpntlm` peer dependency with an in-house NTLM implementation. The package now has zero runtime dependencies.

**Breaking changes**

- `httpntlm` is no longer a peer dependency and no longer needs to be installed alongside this package. Remove it from your project if nothing else uses it.
- Only NTLMv2 is supported. Servers that do not send NTLM target information (i.e. do not negotiate extended security) now fail with `NTLM server did not send target info` instead of falling back to NTLMv1/LM. SharePoint 2013 and later negotiate NTLMv2 by default, so most consumers are unaffected.
- Node 22 or later is required (already declared in `engines`, now relied upon).

**Internals**

- NTLM Type 1/2/3 messages, NTOWFv2 and the NTLMv2/LMv2 responses are implemented in `src/ntlm/messages.ts`, with MD4 hand-rolled in `src/ntlm/md4.ts` because Node's OpenSSL 3 build does not expose it.
- The three-leg handshake runs over `node:http`/`node:https` on a single keep-alive socket per request (`src/ntlm/request.ts`).
- `get`, `post` and `auth` keep their existing signatures and error behaviour; `getAuthToken` still returns the Type 3 `Authorization` header value.
- Test suite now covers RFC 1320 and MS-NLMP §4.2 vectors plus an in-process fake NTLM server exercising the handshake.
