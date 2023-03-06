import type { ActionFactory, Result } from '../types'
import os from 'os'
import { get } from '../ntlm'
import { safeParseItemType } from '../utils'

export const getListItemType: ActionFactory<{ listName: string }, string> =
  ({
    username,
    password,
    site,
    serverRelativeUrl,
    protocol = 'https',
    domain = '',
    hostname = os.hostname(),
  }) =>
  async ({ listName }) => {
    const url = `${protocol}://${
      site + serverRelativeUrl
    }/_api/web/lists/GetByTitle('${listName}')?$select=ListItemEntityTypeFullName`

    const config = {
      url,
      username,
      password,
      workstation: hostname,
      domain,
      headers: {
        Accept: 'application/json; odata=nometadata',
      },
    }

    try {
      const res = await get(config)
      const results = safeParseItemType(res)
      return results
    } catch (error) {
      return {
        success: false,
        error: `Error in getListMetadata: ${error}`,
      }
    }
  }
