import type {
  ActionFactory,
  DeleteListItemOptions,
  SiteConnection,
  SiteConnectionOptions,
} from '../types'
import os from 'os'
import { post } from '../ntlm'
import { encodePath, odataLiteral } from '../utils'
import { toFailure } from '../errors'

/**
 * Deletes a list item. Returns an empty string.
 *
 * Factory form of {@link SiteConnection.deleteListItem}: call with your
 * {@link SiteConnectionOptions} to get a reusable action. See the
 * `SiteConnection` member for full parameter and return documentation.
 */
export const deleteListItem: ActionFactory<DeleteListItemOptions, string> =
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
  async ({ accessToken, requestDigest, listName, spId, ...optional }) => {
    const url = `${protocol}://${
      site + encodePath(serverRelativeUrl)
    }/_api/web/lists/GetByTitle('${odataLiteral(listName)}')/items('${spId}')`

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
          'Content-Type': 'application/json',
          'X-RequestDigest': requestDigest ?? accessToken,
          'If-Match': '*',
          'X-HTTP-Method': 'DELETE',
        },
        body: '',
        ...optional,
      }

      await post(config)
      return {
        success: true,
        data: '',
      }
    } catch (error) {
      return toFailure('deleteListItem', error)
    }
  }
