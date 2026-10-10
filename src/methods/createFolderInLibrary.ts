import type {
  ActionFactory,
  CreateFolderInLibraryOptions,
  SiteConnection,
  SiteConnectionOptions,
} from '../types'
import os from 'os'
import { post } from '../ntlm'
import { encodePath, safeParseServerUrl } from '../utils'

/**
 * Creates a folder (parent must exist). Returns the folder's server-relative URL.
 *
 * Factory form of {@link SiteConnection.createFolderInLibrary}: call with your
 * {@link SiteConnectionOptions} to get a reusable action. See the
 * `SiteConnection` member for full parameter and return documentation.
 */
export const createFolderInLibrary: ActionFactory<
  CreateFolderInLibraryOptions,
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
  async ({ accessToken, requestDigest, folder, ...optional }) => {
    const url = `${protocol}://${site + encodePath(serverRelativeUrl)}/_api/web/folders`

    const payload = JSON.stringify({
      ServerRelativeUrl: `${serverRelativeUrl}/${folder}`,
    })

    try {
      const config = {
        url,
        username,
        password,
        workstation: hostname,
        domain,
        headers: {
          Accept: 'application/json;odata=verbose',
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'X-RequestDigest': requestDigest ?? accessToken,
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
        error: `Error in createFolderInLibrary: ${error}`,
      }
    }
  }
