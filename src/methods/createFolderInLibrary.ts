import type {
  ActionFactory,
  CreateFolderInLibraryOptions,
  SiteConnection,
  SiteConnectionOptions,
} from '../types'
import os from 'os'
import { post } from '../ntlm'
import { encodePath, safeParseServerUrl } from '../utils'
import { toFailure } from '../errors'
import { createConnectionContext, withDigest } from '../context'

/**
 * Creates a folder (parent must exist). Returns the new folder's server-relative URL.
 *
 * Factory form of {@link SiteConnection.createFolderInLibrary}: call with
 * your {@link SiteConnectionOptions} to get a reusable action. See the
 * `SiteConnection` member for full parameter and return documentation.
 */
export const createFolderInLibrary: ActionFactory<
  CreateFolderInLibraryOptions,
  string
> = (options, context = createConnectionContext(options)) => {
  const {
    site,
    serverRelativeUrl,
    username,
    password,
    protocol = 'https',
    domain = '',
    agentOptions,
    hostname = os.hostname(),
  } = options
  return async ({ requestDigest, folder, ...optional }) => {
    const url = `${protocol}://${site + encodePath(serverRelativeUrl)}/_api/web/folders`
    const payload = JSON.stringify({
      ServerRelativeUrl: `${serverRelativeUrl}/${folder}`,
    })

    return withDigest(
      'createFolderInLibrary',
      context,
      requestDigest,
      optional,
      async (digest) => {
        try {
          const res = await post({
            url,
            username,
            password,
            workstation: hostname,
            domain,
            agentOptions,
            headers: {
              Accept: 'application/json;odata=verbose',
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(payload),
              'X-RequestDigest': digest,
            },
            body: payload,
            ...optional,
          })
          return safeParseServerUrl(res)
        } catch (error) {
          return toFailure('createFolderInLibrary', error)
        }
      }
    )
  }
}
