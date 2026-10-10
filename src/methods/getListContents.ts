import type {
  PagedActionFactory,
  PageResult,
  GetListContentsOptions,
  SiteConnection,
  SiteConnectionOptions,
} from '../types'
import os from 'os'
import { get } from '../ntlm'
import { encodePath, odataLiteral, safeParseResults } from '../utils'
import { toFailure } from '../errors'
import { withRetry } from '../retry'

/**
 * Queries list items with optional OData `params`. Returns the OData `value` array.
 *
 * Factory form of {@link SiteConnection.getListContents}: call with your
 * {@link SiteConnectionOptions} to get a reusable action. See the
 * `SiteConnection` member for full parameter and return documentation.
 */
export const getListContents: PagedActionFactory<GetListContentsOptions> =
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
  async <T = unknown>({
    listName,
    params = undefined,
    ...optional
  }: GetListContentsOptions): Promise<PageResult<T>> => {
    const baseUrl = `${protocol}://${
      site + encodePath(serverRelativeUrl)
    }/_api/web/lists/GetByTitle('${odataLiteral(listName)}')/items`
    const query = params?.toString()
    const url = query && query.length > 0 ? baseUrl + '?' + query : baseUrl

    const config = {
      url,
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
        return toFailure('getListContents', error)
      }
    })
  }
