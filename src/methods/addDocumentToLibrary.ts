import type {
  ActionFactory,
  AddDocumentToLibraryOptions,
  SiteConnection,
  SiteConnectionOptions,
} from '../types'
import os from 'os'
import { Readable } from 'node:stream'
import { post } from '../ntlm'
import {
  encodePath,
  odataLiteral,
  odataPath,
  safeParseServerUrl,
} from '../utils'
import { toFailure } from '../errors'
import { createConnectionContext, withDigest } from '../context'

/**
 * Uploads a file (Buffer or Readable) to a document library folder,
 * overwriting any existing file. Returns the file's server-relative URL.
 *
 * Factory form of {@link SiteConnection.addDocumentToLibrary}: call with your
 * {@link SiteConnectionOptions} to get a reusable action. See the
 * `SiteConnection` member for full parameter and return documentation.
 */
export const addDocumentToLibrary: ActionFactory<
  AddDocumentToLibraryOptions,
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
  return async ({
    requestDigest,
    folder,
    fileName,
    payload,
    contentLength,
    ...optional
  }) => {
    const url = `${protocol}://${
      site + encodePath(serverRelativeUrl)
    }/_api/web/GetFolderByServerRelativeUrl('${odataPath(`${serverRelativeUrl}/${folder}`)}')/Files/add(url='${odataLiteral(fileName)}',overwrite=true)`

    const isStream = payload instanceof Readable
    const length = isStream ? contentLength : payload.length

    return withDigest(
      'addDocumentToLibrary',
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
              'Content-Type': 'application/json;odata=verbose',
              ...(length === undefined ? {} : { 'Content-Length': length }),
              'X-RequestDigest': digest,
            },
            body: payload,
            ...optional,
          })
          return safeParseServerUrl(res)
        } catch (error) {
          return toFailure('addDocumentToLibrary', error)
        }
      },
      // A stream can only be sent once, so a stale-digest retry is impossible.
      !isStream
    )
  }
}
