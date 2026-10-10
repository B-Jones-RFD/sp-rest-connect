import type {
  ActionFactory,
  GetDocumentStreamFromLibraryOptions,
  SiteConnection,
  SiteConnectionOptions,
} from '../types'
import type { Readable } from 'node:stream'
import os from 'os'
import { get } from '../ntlm'
import { encodePath, odataLiteral, odataPath, safeParseStream } from '../utils'
import { toFailure } from '../errors'
import { withRetry } from '../retry'

/**
 * Downloads a file as a `Readable` without buffering it.
 *
 * Factory form of {@link SiteConnection.getDocumentStreamFromLibrary}: call
 * with your {@link SiteConnectionOptions} to get a reusable action. See the
 * `SiteConnection` member for full parameter and return documentation.
 */
export const getDocumentStreamFromLibrary: ActionFactory<
  GetDocumentStreamFromLibraryOptions,
  Readable
> =
  ({
    site,
    serverRelativeUrl,
    username,
    password,
    protocol = 'https',
    domain = '',
    agentOptions,
    retry,
    hostname = os.hostname(),
  }) =>
  async ({ folder, fileName, ...optional }) => {
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
      stream: true,
      ...optional,
    }

    return withRetry(retry, optional.signal, async () => {
      try {
        const res = await get(config)
        return safeParseStream(res)
      } catch (error) {
        return toFailure('getDocumentStreamFromLibrary', error)
      }
    })
  }
