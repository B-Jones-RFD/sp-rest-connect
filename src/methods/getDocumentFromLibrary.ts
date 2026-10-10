import type {
  ActionFactory,
  GetDocumentFromLibraryOptions,
  SiteConnection,
  SiteConnectionOptions,
} from '../types'
import os from 'os'
import { get } from '../ntlm'
import {
  encodePath,
  odataLiteral,
  odataPath,
  safeParseDocument,
} from '../utils'
import { toFailure } from '../errors'

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
    agentOptions,
    hostname = os.hostname(),
  }) =>
  async ({ folder, fileName, binary = true, ...optional }) => {
    const url = `${protocol}://${
      site + encodePath(serverRelativeUrl)
    }/_api/web/GetFolderByServerRelativeUrl('${odataPath(`${serverRelativeUrl}/${folder}`)}')/Files('${odataLiteral(fileName)}')/$value`

    const config = {
      url,
      username,
      password,
      workstation: hostname,
      domain,
      agentOptions,
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
      return toFailure('getDocumentFromLibrary', error)
    }
  }
