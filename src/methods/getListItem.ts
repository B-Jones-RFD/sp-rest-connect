import type { ActionFactory } from '../types'
import os from 'os'
import { get } from '../ntlm'
import { safeParseResult } from '../utils'

export const getListItem: ActionFactory<
  { listName: string; spId: number },
  unknown
> =
  ({
    site,
    serverRelativeUrl,
    username,
    password,
    protocol = 'https',
    domain = '',
    hostname = os.hostname(),
  }) =>
  async ({ listName, spId }) => {
    const url = `${protocol}://${
      site + serverRelativeUrl
    }/_api/web/lists/GetByTitle('${listName}')/items('${spId}')`

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
      const result = safeParseResult(res)
      return result
    } catch (error) {
      return {
        success: false,
        error: `Error in getListItem: ${error}`,
      }
    }
  }
