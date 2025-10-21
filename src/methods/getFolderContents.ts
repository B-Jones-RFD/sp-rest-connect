import type { ActionFactory } from '../types'
import os from 'os'
import { get } from '../ntlm'
import { safeParseResults } from '../utils'
import { URLSearchParams } from 'url'

export const getFolderContents: ActionFactory<
  { folder: string; params?: URLSearchParams },
  unknown[]
> =
  ({
    site,
    serverRelativeUrl,
    username,
    password,
    protocol = 'https',
    domain = '',
    hostname = os.hostname(),
    ...optional
  }) =>
  async ({ folder, params }) => {
    const baseUrl = `${protocol}://${
      site + serverRelativeUrl
    }/_api/web/GetFolderByServerRelativeUrl('${serverRelativeUrl}/${folder}')/Files`
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
        error: `Error in getFolderContents: ${error}`,
      }
    }
  }
