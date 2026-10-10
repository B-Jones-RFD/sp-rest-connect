import type {
  ActionFactory,
  RequestOptions,
  SiteConnection,
  SiteConnectionOptions,
} from '../types'
import os from 'os'
import { post } from '../ntlm'
import {
  encodePath,
  safeParseContextInfo,
  success,
  type ContextInfo,
} from '../utils'
import { toFailure } from '../errors'
import { withRetry } from '../retry'

/**
 * Fetches `/_api/contextinfo` and returns both the digest and its lifetime.
 * Used by the managed digest cache; `getFormDigestValue` is the public
 * string-only view.
 */
export const getContextInfo: ActionFactory<RequestOptions, ContextInfo> =
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
        return safeParseContextInfo(res)
      } catch (error) {
        return toFailure('getFormDigestValue', error)
      }
    })
  }

/**
 * Obtains the request digest a write action sends as `X-RequestDigest`. You
 * rarely need this: writes fetch and cache a digest automatically when
 * `requestDigest` is omitted.
 *
 * Factory form of {@link SiteConnection.getFormDigestValue}: call with your
 * {@link SiteConnectionOptions} to get a reusable action. See the
 * `SiteConnection` member for full parameter and return documentation.
 */
export const getFormDigestValue: ActionFactory<RequestOptions, string> = (
  options
) => {
  const contextInfo = getContextInfo(options)
  return async (optional) => {
    const info = await contextInfo(optional)
    return info.success ? success(info.data.digest) : info
  }
}
