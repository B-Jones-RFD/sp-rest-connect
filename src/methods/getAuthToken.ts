import type {
  ActionFactory,
  RequestOptions,
  SiteConnection,
  SiteConnectionOptions,
} from '../types'
import os from 'os'
import { auth } from '../ntlm'
import { safeParseAuthToken } from '../utils'

/**
 * Runs the NTLM handshake and returns the Type 3 `Authorization` header value. Diagnostic only; this is NOT the `accessToken` for writes (see `getFormDigestValue`).
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
    hostname = os.hostname(),
  }) =>
  async (optional) => {
    const url = `${protocol}://${site + serverRelativeUrl}`

    const config = {
      url,
      username,
      password,
      workstation: hostname,
      domain,
      ...optional,
    }

    try {
      const res = await auth(config)
      const result = safeParseAuthToken(res)
      return result
    } catch (error) {
      return {
        success: false,
        error: `Error in getAuthToken: ${error}`,
      }
    }
  }
