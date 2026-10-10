import type {
  GetNextPageOptions,
  PagedActionFactory,
  PageResult,
  SiteConnection,
  SiteConnectionOptions,
} from '../types'
import os from 'os'
import { get } from '../ntlm'
import { failure, safeParseResults } from '../utils'
import { toFailure } from '../errors'
import { withRetry } from '../retry'

/**
 * Fetches the page that a previous result's `nextLink` points at. The link
 * must be on the connection's own origin.
 *
 * Factory form of {@link SiteConnection.getNextPage}: call with your
 * {@link SiteConnectionOptions} to get a reusable action.
 */
export const getNextPage: PagedActionFactory<GetNextPageOptions> =
  ({
    username,
    password,
    site,
    protocol = 'https',
    domain = '',
    agentOptions,
    retry,
    hostname = os.hostname(),
  }) =>
  async <T = unknown>({
    nextLink,
    ...optional
  }: GetNextPageOptions): Promise<PageResult<T>> => {
    let origin: string
    try {
      origin = new URL(`${protocol}://${site}`).origin
      if (new URL(nextLink).origin !== origin) {
        return failure(
          `Error in getNextPage: nextLink must be on ${origin} (got ${nextLink})`,
          'UNKNOWN'
        )
      }
    } catch (error) {
      return toFailure('getNextPage', error)
    }

    const config = {
      url: nextLink,
      username,
      password,
      workstation: hostname,
      domain,
      agentOptions,
      headers: {
        Accept: 'application/json; odata=nometadata',
      },
      ...optional,
    }

    return withRetry(retry, optional.signal, async () => {
      try {
        const res = await get(config)
        return safeParseResults(res) as PageResult<T>
      } catch (error) {
        return toFailure('getNextPage', error)
      }
    })
  }
