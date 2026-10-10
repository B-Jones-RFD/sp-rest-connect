import type {
  ActionFactory,
  GetListItemOptions,
  SiteConnection,
  SiteConnectionOptions,
} from '../types'
import os from 'os'
import { get } from '../ntlm'
import { encodePath, odataLiteral, safeParseResult } from '../utils'

/**
 * Reads a single list item by ID.
 *
 * Factory form of {@link SiteConnection.getListItem}: call with your
 * {@link SiteConnectionOptions} to get a reusable action. See the
 * `SiteConnection` member for full parameter and return documentation.
 */
export const getListItem: ActionFactory<GetListItemOptions, unknown> =
  ({
    site,
    serverRelativeUrl,
    username,
    password,
    protocol = 'https',
    domain = '',
    hostname = os.hostname(),
  }) =>
  async ({ listName, spId, ...optional }) => {
    const url = `${protocol}://${
      site + encodePath(serverRelativeUrl)
    }/_api/web/lists/GetByTitle('${odataLiteral(listName)}')/items('${spId}')`

    const config = {
      url,
      username,
      password,
      workstation: hostname,
      domain,
      headers: {
        Accept: 'application/json; odata=nometadata',
      },
      ...optional,
    }

    try {
      const res = await get(config)
      const result = safeParseResult(res)
      return result
    } catch (error) {
      return {
        success: false,
        error: `Error in getListItem: ${error}`,
      }
    }
  }
