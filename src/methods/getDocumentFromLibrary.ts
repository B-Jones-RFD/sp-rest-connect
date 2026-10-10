import type {
  ActionFactory,
  GetDocumentFromLibraryOptions,
  SiteConnection,
  SiteConnectionOptions,
} from '../types'
import os from 'os'
import { get } from '../ntlm'
import { safeParseDocument } from '../utils'

/**
 * Downloads a file as a `Buffer`.
 *
 * Factory form of {@link SiteConnection.getDocumentFromLibrary}: call with your
 * {@link SiteConnectionOptions} to get a reusable action. See the
 * `SiteConnection` member for full parameter and return documentation.
 */
export const getDocumentFromLibrary: ActionFactory<
  GetDocumentFromLibraryOptions,
  Buffer
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
  async ({ folder, fileName, binary = true, ...optional }) => {
    const url = `${protocol}://${
      site + serverRelativeUrl
    }/_api/web/GetFolderByServerRelativeUrl('${serverRelativeUrl}/${folder}')/Files('${fileName}')/$value`

    const config = {
      url,
      username,
      password,
      workstation: hostname,
      domain,
      headers: {
        Accept: 'application/json; odata=verbose',
      },
      binary,
      ...optional,
    }

    try {
      const res = await get(config)
      const document = safeParseDocument(res)
      return document
    } catch (error) {
      return {
        success: false,
        error: `Error in getDocumentFromLibrary: ${error}`,
      }
    }
  }
