import type {
  ActionFactory,
  AddListItemOptions,
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
 * Creates a list item. `payload` is a plain object (entity type resolved
 * automatically) or a legacy JSON string. Returns the created item as a raw
 * JSON string.
 *
 * Factory form of {@link SiteConnection.addListItem}: call with your
 * {@link SiteConnectionOptions} to get a reusable action. See the
 * `SiteConnection` member for full parameter and return documentation.
 */
export const addListItem: ActionFactory<AddListItemOptions, string> = (
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
    payload,
    ...optional
  }) => {
    const url = `${protocol}://${
      site + encodePath(serverRelativeUrl)
    }/_api/web/lists/GetByTitle('${odataLiteral(listName)}')/items`

    const body = await serialiseListItem(
      'addListItem',
      context,
      listName,
      payload,
      optional
    )
    if (!body.success) return body

    return withDigest(
      'addListItem',
      context,
      requestDigest ?? accessToken,
      optional,
      async (digest) => {
        try {
          const result = await post({
            url,
            username,
            password,
            workstation: hostname,
            domain,
            agentOptions,
            headers: {
              Accept: 'application/json;odata=nometadata',
              'Content-Type': 'application/json;odata=verbose',
              'Content-Length': Buffer.byteLength(body.data),
              'X-RequestDigest': digest,
            },
            body: body.data,
            ...optional,
          })
          return success(
            typeof result === 'string' ? result : JSON.stringify(result)
          )
        } catch (error) {
          return toFailure('addListItem', error)
        }
      }
    )
  }
}
