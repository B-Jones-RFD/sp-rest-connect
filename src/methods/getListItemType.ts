import type {
  ActionFactory,
  GetListItemTypeOptions,
  SiteConnection,
  SiteConnectionOptions,
} from '../types'
import os from 'os'
import { get } from '../ntlm'
import { encodePath, odataLiteral, safeParseItemType } from '../utils'
import { toFailure } from '../errors'
import { withRetry } from '../retry'

/**
 * Reads the list entity type name used in `__metadata.type` for creates and updates.
 *
 * Factory form of {@link SiteConnection.getListItemType}: call with your
 * {@link SiteConnectionOptions} to get a reusable action. See the
 * `SiteConnection` member for full parameter and return documentation.
 */
export const getListItemType: ActionFactory<GetListItemTypeOptions, string> =
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
  async ({ listName, ...optional }) => {
    const url = `${protocol}://${
      site + encodePath(serverRelativeUrl)
    }/_api/web/lists/GetByTitle('${odataLiteral(listName)}')?$select=ListItemEntityTypeFullName`

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
        const results = safeParseItemType(res)
        return results
      } catch (error) {
        return toFailure('getListItemType', error)
      }
    })
  }
