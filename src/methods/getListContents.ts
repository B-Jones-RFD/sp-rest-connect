import type { ActionFactory } from '../types'
import os from 'os'
import { get } from '../ntlm'
import { safeParseResults } from '../utils'

export const getListContents: ActionFactory<
  {
    listName: string
    params?: URLSearchParams
    timeout?: number
    binary?: boolean
  },
  unknown[]
> =
  ({
    username,
    password,
    site,
    serverRelativeUrl,
    protocol = 'https',
    domain = '',
    hostname = os.hostname(),
  }) =>
  async ({ listName, params = undefined, ...optional }) => {
    const baseUrl = `${protocol}://${
      site + serverRelativeUrl
    }/_api/web/lists/GetByTitle('${listName}')/items`
    const query = params?.toString()
    const url = query && query.length > 0 ? baseUrl + '?' + query : baseUrl

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
      const results = safeParseResults(res)
      return results
    } catch (error) {
      return {
        success: false,
        error: `Error in getListContents: ${error}`,
      }
    }
  }
