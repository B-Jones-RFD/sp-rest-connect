import type {
  TypedActionFactory,
  Result,
  GetListItemOptions,
  SiteConnection,
  SiteConnectionOptions,
} from '../types'
import os from 'os'
import { get } from '../ntlm'
import { encodePath, odataLiteral, safeParseResult } from '../utils'
import { toFailure } from '../errors'
import { withRetry } from '../retry'

/**
 * Reads a single list item by ID.
 *
 * Factory form of {@link SiteConnection.getListItem}: call with your
 * {@link SiteConnectionOptions} to get a reusable action. See the
 * `SiteConnection` member for full parameter and return documentation.
 */
export const getListItem: TypedActionFactory<GetListItemOptions> =
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
    listName,
    spId,
    ...optional
  }: GetListItemOptions): Promise<Result<T>> => {
    const url = `${protocol}://${
      site + encodePath(serverRelativeUrl)
    }/_api/web/lists/GetByTitle('${odataLiteral(listName)}')/items('${spId}')`

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
        return safeParseResult(res) as Result<T>
      } catch (error) {
        return toFailure('getListItem', error)
      }
    })
  }
