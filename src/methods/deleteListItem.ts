import type {
  ActionFactory,
  DeleteListItemOptions,
  SiteConnection,
  SiteConnectionOptions,
} from '../types'
import os from 'os'
import { post } from '../ntlm'
import { encodePath, odataLiteral, success } from '../utils'
import { toFailure } from '../errors'
import { createConnectionContext, withDigest } from '../context'

/**
 * Deletes a list item. Returns an empty string on success.
 *
 * Factory form of {@link SiteConnection.deleteListItem}: call with your
 * {@link SiteConnectionOptions} to get a reusable action. See the
 * `SiteConnection` member for full parameter and return documentation.
 */
export const deleteListItem: ActionFactory<DeleteListItemOptions, string> = (
  options,
  context = createConnectionContext(options)
) => {
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
    accessToken,
    requestDigest,
    listName,
    spId,
    ...optional
  }) => {
    const url = `${protocol}://${
      site + encodePath(serverRelativeUrl)
    }/_api/web/lists/GetByTitle('${odataLiteral(listName)}')/items('${spId}')`

    return withDigest(
      'deleteListItem',
      context,
      requestDigest ?? accessToken,
      optional,
      async (digest) => {
        try {
          await post({
            url,
            username,
            password,
            workstation: hostname,
            domain,
            agentOptions,
            headers: {
              Accept: 'application/json;odata=verbose',
              'Content-Type': 'application/json',
              'X-RequestDigest': digest,
              'If-Match': '*',
              'X-HTTP-Method': 'DELETE',
            },
            body: '',
            ...optional,
          })
          return success('')
        } catch (error) {
          return toFailure('deleteListItem', error)
        }
      }
    )
  }
}
