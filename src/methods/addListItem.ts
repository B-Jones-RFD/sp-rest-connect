import type {
  AddListItemActionFactory,
  AddListItemOptions,
  CreatedListItem,
  Result,
  SiteConnection,
  SiteConnectionOptions,
} from '../types'
import os from 'os'
import { post } from '../ntlm'
import { encodePath, odataLiteral, safeParseCreatedItem } from '../utils'
import { toFailure } from '../errors'
import {
  createConnectionContext,
  withDigest,
  serialiseListItem,
} from '../context'

/**
 * Creates a list item from a plain object (entity type resolved
 * automatically). Returns the created item, including its new `Id`.
 *
 * Factory form of {@link SiteConnection.addListItem}: call with your
 * {@link SiteConnectionOptions} to get a reusable action. See the
 * `SiteConnection` member for full parameter and return documentation.
 */
export const addListItem: AddListItemActionFactory = (
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
  return async <T = Record<string, unknown>>({
    requestDigest,
    listName,
    payload,
    ...optional
  }: AddListItemOptions): Promise<Result<CreatedListItem<T>>> => {
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
      requestDigest,
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
          return safeParseCreatedItem(result) as Result<CreatedListItem<T>>
        } catch (error) {
          return toFailure('addListItem', error)
        }
      }
    )
  }
}
