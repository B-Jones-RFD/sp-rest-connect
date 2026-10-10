import type {
  ActionFactory,
  UpdateListItemOptions,
  SiteConnection,
  SiteConnectionOptions,
} from '../types'
import os from 'os'
import { post } from '../ntlm'
import { encodePath, odataLiteral } from '../utils'
import { toFailure } from '../errors'

/**
 * Partially updates a list item (OData MERGE, last write wins). Echoes back `patch`.
 *
 * Factory form of {@link SiteConnection.updateListItem}: call with your
 * {@link SiteConnectionOptions} to get a reusable action. See the
 * `SiteConnection` member for full parameter and return documentation.
 */
export const updateListItem: ActionFactory<UpdateListItemOptions, string> =
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
    patch,
    ...optional
  }) => {
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
          'Content-Type': 'application/json;odata=verbose',
          'Content-Length': Buffer.byteLength(patch),
          'X-RequestDigest': requestDigest ?? accessToken,
          'If-Match': '*',
          'X-HTTP-Method': 'MERGE',
        },
        body: patch,
        ...optional,
      }

      await post(config)
      return {
        success: true,
        data: patch,
      }
    } catch (error) {
      return toFailure('updateListItem', error)
    }
  }
