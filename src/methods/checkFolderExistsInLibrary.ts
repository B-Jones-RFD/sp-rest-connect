import type { ActionFactory } from '../types'
import os from 'os'
import { get } from '../ntlm'
import { safeParseFolderExists } from '../utils'

export const checkFolderExistsInLibrary: ActionFactory<
  { folder: string },
  boolean
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
  async ({ folder }) => {
    const url = `${protocol}://${
      site + serverRelativeUrl
    }/_api/web/GetFolderByServerRelativeUrl('${folder}')/Exists`

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
      const results = safeParseFolderExists(res)
      return results
    } catch (error) {
      return {
        success: false,
        error: `Error in checkFolderExistsInLibrary: ${error}`,
      }
    }
  }
