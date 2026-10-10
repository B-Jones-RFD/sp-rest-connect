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

/**
 * Attaches a file to an existing list item. Returns the attachment's server-relative URL.
 *
 * Factory form of {@link SiteConnection.addAttachmentToListItem}: call with your
 * {@link SiteConnectionOptions} to get a reusable action. See the
 * `SiteConnection` member for full parameter and return documentation.
 */
export const addAttachmentToListItem: ActionFactory<
  AddAttachmentToListItemOptions,
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
  async ({
    accessToken,
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

    try {
      const config = {
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
          'X-RequestDigest': requestDigest ?? accessToken,
        },
        body: payload,
        ...optional,
      }
      const res = await post(config)
      const result = safeParseServerUrl(res)
      return result
    } catch (error) {
      return toFailure('addAttachmentToListItem', error)
    }
  }
