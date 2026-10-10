import type {
  ActionFactory,
  CheckFolderExistsInLibraryOptions,
  SiteConnection,
  SiteConnectionOptions,
} from '../types'
import os from 'os'
import { get } from '../ntlm'
import { encodePath, odataPath, safeParseFolderExists } from '../utils'

/**
 * Checks whether a folder exists. A missing folder is a successful `false`.
 *
 * Factory form of {@link SiteConnection.checkFolderExistsInLibrary}: call with your
 * {@link SiteConnectionOptions} to get a reusable action. See the
 * `SiteConnection` member for full parameter and return documentation.
 */
export const checkFolderExistsInLibrary: ActionFactory<
  CheckFolderExistsInLibraryOptions,
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
  }) =>
  async ({ folder, ...optional }) => {
    const url = `${protocol}://${
      site + encodePath(serverRelativeUrl)
    }/_api/web/GetFolderByServerRelativeUrl('${odataPath(`${serverRelativeUrl}/${folder}`)}')/Exists`

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
