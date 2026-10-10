import type {
  ActionFactory,
  RequestOptions,
  SiteConnection,
  SiteConnectionOptions,
} from '../types'
import os from 'os'
import { auth } from '../ntlm'
import { encodePath, safeParseAuthToken } from '../utils'
import { toFailure } from '../errors'
import { withRetry } from '../retry'

/**
 * Runs the NTLM handshake and returns the Type 3 `Authorization` header value. Diagnostic only; this is NOT the request digest for writes (see `getFormDigestValue`).
 *
 * Factory form of {@link SiteConnection.getAuthToken}: call with your
 * {@link SiteConnectionOptions} to get a reusable action. See the
 * `SiteConnection` member for full parameter and return documentation.
 */
export const getAuthToken: ActionFactory<RequestOptions, string> =
  ({
    username,
    password,
    site,
    serverRelativeUrl,
    protocol = 'https',
    domain = '',
    agentOptions,
    retry,
    hostname = os.hostname(),
  }) =>
  async (optional) => {
    const url = `${protocol}://${site + encodePath(serverRelativeUrl)}`

    const config = {
      url,
      username,
      password,
      workstation: hostname,
      domain,
      agentOptions,
      ...optional,
    }

    return withRetry(retry, optional.signal, async () => {
      try {
        const res = await auth(config)
        const result = safeParseAuthToken(res)
        return result
      } catch (error) {
        return toFailure('getAuthToken', error)
      }
    })
  }
