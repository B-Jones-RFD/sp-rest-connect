import type {
  ActionFactory,
  RequestOptions,
  SiteConnection,
  SiteConnectionOptions,
} from '../types'
import os from 'os'
import { post } from '../ntlm'
import { encodePath, safeParseFormDigestValue } from '../utils'
import { toFailure } from '../errors'
import { withRetry } from '../retry'

/**
 * Obtains the request digest required as `accessToken` by every write action.
 *
 * Factory form of {@link SiteConnection.getFormDigestValue}: call with your
 * {@link SiteConnectionOptions} to get a reusable action. See the
 * `SiteConnection` member for full parameter and return documentation.
 */
export const getFormDigestValue: ActionFactory<RequestOptions, string> =
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
    const url = `${protocol}://${site + encodePath(serverRelativeUrl)}/_api/contextinfo`

    const config = {
      url,
      username,
      password,
      workstation: hostname,
      domain,
      agentOptions,
      headers: {
        Accept: 'application/json;odata=verbose',
        'Content-Type': 'application/json;odata=verbose',
      },
      body: '',
      ...optional,
    }

    return withRetry(retry, optional.signal, async () => {
      try {
        const res = await post(config)
        const result = safeParseFormDigestValue(res)
        return result
      } catch (error) {
        return toFailure('getFormDigestValue', error)
      }
    })
  }
