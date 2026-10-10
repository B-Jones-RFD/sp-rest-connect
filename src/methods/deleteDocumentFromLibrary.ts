import type {
  ActionFactory,
  DeleteDocumentFromLibraryOptions,
  SiteConnection,
  SiteConnectionOptions,
} from '../types'
import os from 'os'
import { post } from '../ntlm'
import { encodePath, odataPath } from '../utils'
import { toFailure } from '../errors'

/**
 * Deletes a file from a document library. Returns the deleted file name.
 *
 * Factory form of {@link SiteConnection.deleteDocumentFromLibrary}: call with your
 * {@link SiteConnectionOptions} to get a reusable action. See the
 * `SiteConnection` member for full parameter and return documentation.
 */
export const deleteDocumentFromLibrary: ActionFactory<
  DeleteDocumentFromLibraryOptions,
  string
> =
  ({
    site,
    serverRelativeUrl,
    username,
    password,
    protocol = 'https',
    domain = '',
    agentOptions,
    hostname = os.hostname(),
  }) =>
  async ({ accessToken, requestDigest, folder, fileName, ...optional }) => {
    const url = `${protocol}://${
      site + encodePath(serverRelativeUrl)
    }/_api/web/GetFileByServerRelativeUrl('${odataPath(`${serverRelativeUrl}/${folder}/${fileName}`)}')`

    const config = {
      url,
      username,
      password,
      workstation: hostname,
      domain,
      agentOptions,
      headers: {
        'X-RequestDigest': requestDigest ?? accessToken,
        'If-Match': '*',
        'X-HTTP-Method': 'DELETE',
      },
      ...optional,
    }

    try {
      await post(config)
      return {
        success: true,
        data: fileName,
      }
    } catch (error) {
      return toFailure('deleteDocumentFromLibrary', error)
    }
  }
