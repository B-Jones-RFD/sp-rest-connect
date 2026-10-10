import type {
  ActionFactory,
  AddDocumentToLibraryOptions,
  SiteConnection,
  SiteConnectionOptions,
} from '../types'
import os from 'os'
import { post } from '../ntlm'
import { safeParseServerUrl } from '../utils'

/**
 * Uploads a file to a document library folder (overwrites). Returns the file's server-relative URL.
 *
 * Factory form of {@link SiteConnection.addDocumentToLibrary}: call with your
 * {@link SiteConnectionOptions} to get a reusable action. See the
 * `SiteConnection` member for full parameter and return documentation.
 */
export const addDocumentToLibrary: ActionFactory<
  AddDocumentToLibraryOptions,
  string
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
  async ({ accessToken, folder, fileName, payload, ...optional }) => {
    const url = `${protocol}://${
      site + serverRelativeUrl
    }/_api/web/GetFolderByServerRelativeUrl('${serverRelativeUrl}/${folder}')/Files/add(url='${fileName}',overwrite=true)`

    try {
      const config = {
        url,
        username,
        password,
        workstation: hostname,
        domain,
        headers: {
          Accept: 'application/json;odata=verbose',
          'Content-Type': 'application/json;odata=verbose',
          'Content-Length': payload.length,
          'X-RequestDigest': accessToken,
        },
        body: payload,
        ...optional,
      }
      const res = await post(config)
      const result = safeParseServerUrl(res)
      return result
    } catch (error) {
      return {
        success: false,
        error: `Error in addDocumentToLibrary: ${error}`,
      }
    }
  }
