import type {
  ActionFactory,
  AddAttachmentToListItemOptions,
  SiteConnection,
  SiteConnectionOptions,
} from '../types'
import os from 'os'
import { post } from '../ntlm'
import { encodePath, odataLiteral, safeParseServerUrl } from '../utils'
import { toFailure } from '../errors'
import { createConnectionContext, withDigest } from '../context'

/**
 * Attaches a file to a list item. Returns the attachment's server-relative URL.
 *
 * Factory form of {@link SiteConnection.addAttachmentToListItem}: call with
 * your {@link SiteConnectionOptions} to get a reusable action. See the
 * `SiteConnection` member for full parameter and return documentation.
 */
export const addAttachmentToListItem: ActionFactory<
  AddAttachmentToListItemOptions,
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
    listName,
    spId,
    fileName,
    payload,
    ...optional
  }) => {
    const url = `${protocol}://${
      site + encodePath(serverRelativeUrl)
    }/_api/web/lists/GetByTitle('${odataLiteral(listName)}')/items('${spId}')/AttachmentFiles/add(FileName='${odataLiteral(fileName)}')`

    return withDigest(
      'addAttachmentToListItem',
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
              'Content-Length': payload.length,
              'X-RequestDigest': digest,
            },
            body: payload,
            ...optional,
          })
          return safeParseServerUrl(res)
        } catch (error) {
          return toFailure('addAttachmentToListItem', error)
        }
      }
    )
  }
}
