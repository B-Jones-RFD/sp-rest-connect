import type { ActionFactory, Result } from '../types'
import os from 'os'
import { get } from '../ntlm'
import { safeParseResults } from '../utils'

export const getFolderContents: ActionFactory<{ folder: string }, unknown[]> =
  ({
    site,
    serverRelativeUrl,
    username,
    password,
    protocol = 'https',
    domain = '',
    hostname = os.hostname(),
  }) =>
  async ({ folder }) => {
    const url = `${protocol}://${
      site + serverRelativeUrl
    }/_api/web/GetFolderByServerRelativeUrl('${serverRelativeUrl}/${folder}')/Files`

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
      const results = safeParseResults(res)
      return results
    } catch (error) {
      return {
        success: false,
        error: `Error in getFolderContents: ${error}`,
      }
    }
  }
