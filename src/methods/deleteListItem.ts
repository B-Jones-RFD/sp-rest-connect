import type {
  ActionFactory,
  DeleteListItemOptions,
  SiteConnection,
  SiteConnectionOptions,
} from '../types'
import os from 'os'
import { post } from '../ntlm'

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
    hostname = os.hostname(),
  }) =>
  async ({ accessToken, listName, spId, ...optional }) => {
    const url = `${protocol}://${
      site + serverRelativeUrl
    }/_api/web/lists/GetByTitle('${listName}')/items('${spId}')`

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
          'X-RequestDigest': accessToken,
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
      return {
        success: false,
        error: `Error in deleteListItem: ${error}`,
      }
    }
  }
