import type {
  ActionFactory,
  AddListItemOptions,
  SiteConnection,
  SiteConnectionOptions,
} from '../types'
import os from 'os'
import { post } from '../ntlm'

/**
 * Creates a list item. `payload` must be a JSON string including `__metadata.type` from `getListItemType`. Returns the created item as a raw JSON string.
 *
 * Factory form of {@link SiteConnection.addListItem}: call with your
 * {@link SiteConnectionOptions} to get a reusable action. See the
 * `SiteConnection` member for full parameter and return documentation.
 */
export const addListItem: ActionFactory<AddListItemOptions, string> =
  ({
    site,
    serverRelativeUrl,
    username,
    password,
    protocol = 'https',
    domain = '',
    hostname = os.hostname(),
  }) =>
  async ({ accessToken, listName, payload, ...optional }) => {
    const url = `${protocol}://${
      site + serverRelativeUrl
    }/_api/web/lists/GetByTitle('${listName}')/items`

    try {
      const config = {
        url,
        username,
        password,
        workstation: hostname,
        domain,
        headers: {
          Accept: 'application/json;odata=nometadata',
          'Content-Type': 'application/json;odata=verbose',
          'Content-Length': Buffer.byteLength(payload),
          'X-RequestDigest': accessToken,
        },
        body: payload,
        ...optional,
      }

      const result = await post(config)
      const data = typeof result === 'string' ? result : JSON.stringify(result)

      return {
        success: true,
        data,
      }
    } catch (error) {
      return {
        success: false,
        error: `Error in addListItem: ${error}`,
      }
    }
  }
