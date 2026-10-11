# Security Policy

This package handles Windows credentials and implements NTLMv2 authentication,
so security reports are taken seriously.

## Supported versions

| Version | Supported                             |
| ------- | ------------------------------------- |
| 5.x     | Yes                                   |
| 4.x     | Security fixes only, until 2027-04-10 |
| < 4.0   | No                                    |

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Use GitHub's private vulnerability reporting:
<https://github.com/B-Jones-RFD/sp-rest-connect/security/advisories/new>.

Include what you found, how to reproduce it, and the version affected. You
should hear back within a week. If the report is confirmed, a fix will be
released as a patch and a GitHub Security Advisory published once it is
available.

## Scope notes

- Credentials are held in memory for the lifetime of a connection and sent
  only to the host named in `site`. `getNextPage` refuses links on any other
  origin for this reason.
- Only NTLMv2 is implemented. The library will not downgrade to NTLMv1 or LM
  responses.
- TLS verification is on by default; `agentOptions.rejectUnauthorized` and
  `agentOptions.ca` exist so that it can be configured without disabling it
  process-wide.
