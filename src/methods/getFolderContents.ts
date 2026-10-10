import type {
  PagedActionFactory,
  PageResult,
  GetFolderContentsOptions,
  SiteConnection,
  SiteConnectionOptions,
} from '../types'
import os from 'os'
import { get } from '../ntlm'
import { encodePath, odataPath, safeParseResults } from '../utils'
import { toFailure } from '../errors'
import { withRetry } from '../retry'

/**
 * Lists the files directly inside a folder. Returns the OData `value` array.
 *
 * Factory form of {@link SiteConnection.getFolderContents}: call with your
 * {@link SiteConnectionOptions} to get a reusable action. See the
 * `SiteConnection` member for full parameter and return documentation.
 */
export const getFolderContents: PagedActionFactory<GetFolderContentsOptions> =
  ({
    site,
    serverRelativeUrl,
    username,
    password,
    protocol = 'https',
    domain = '',
    agentOptions,
    retry,
    hostname = os.hostname(),
  }) =>
  async <T = unknown>({
    folder,
    params,
    ...optional
  }: GetFolderContentsOptions): Promise<PageResult<T>> => {
    const baseUrl = `${protocol}://${
      site + encodePath(serverRelativeUrl)
    }/_api/web/GetFolderByServerRelativeUrl('${odataPath(`${serverRelativeUrl}/${folder}`)}')/Files`
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
        return toFailure('getFolderContents', error)
      }
    })
  }
