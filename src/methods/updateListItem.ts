import type {
  ActionFactory,
  UpdateListItemOptions,
  SiteConnection,
  SiteConnectionOptions,
} from '../types'
import os from 'os'
import { post } from '../ntlm'
import { encodePath, odataLiteral, success } from '../utils'
import { toFailure } from '../errors'
import {
  createConnectionContext,
  withDigest,
  serialiseListItem,
} from '../context'

/**
 * Partially updates a list item (OData MERGE). `patch` is a plain object
 * (entity type resolved automatically) or a legacy JSON string. Echoes the
 * serialised patch back.
 *
 * Factory form of {@link SiteConnection.updateListItem}: call with your
 * {@link SiteConnectionOptions} to get a reusable action. See the
 * `SiteConnection` member for full parameter and return documentation.
 */
export const updateListItem: ActionFactory<UpdateListItemOptions, string> = (
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
    patch,
    ...optional
  }) => {
    const url = `${protocol}://${
      site + encodePath(serverRelativeUrl)
    }/_api/web/lists/GetByTitle('${odataLiteral(listName)}')/items('${spId}')`

    const body = await serialiseListItem(
      'updateListItem',
      context,
      listName,
      patch,
      optional
    )
    if (!body.success) return body

    return withDigest(
      'updateListItem',
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
              'Content-Type': 'application/json;odata=verbose',
              'Content-Length': Buffer.byteLength(body.data),
              'X-RequestDigest': digest,
              'If-Match': '*',
              'X-HTTP-Method': 'MERGE',
            },
            body: body.data,
            ...optional,
          })
          return success(body.data)
        } catch (error) {
          return toFailure('updateListItem', error)
        }
      }
    )
  }
}
