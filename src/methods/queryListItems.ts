import type {
  ItemsActionFactory,
  QueryListItemsOptions,
  Result,
  SiteConnection,
  SiteConnectionOptions,
} from '../types'
import os from 'os'
import { post } from '../ntlm'
import { encodePath, odataLiteral, safeParseResults } from '../utils'
import { toFailure } from '../errors'
import { withRetry } from '../retry'
import { createConnectionContext, withDigest } from '../context'

/**
 * Runs a CAML query (`GetItems`) against a list. Needs a request digest
 * because `GetItems` is a POST; the managed digest is used unless one is
 * supplied. Read semantics, so `retry` applies.
 *
 * Factory form of {@link SiteConnection.queryListItems}: call with your
 * {@link SiteConnectionOptions} to get a reusable action. See the
 * `SiteConnection` member for full parameter and return documentation.
 */
export const queryListItems: ItemsActionFactory<QueryListItemsOptions> = (
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
    retry,
    hostname = os.hostname(),
  } = options
  return async <T = unknown>({
    requestDigest,
    listName,
    viewXml,
    pagingInfo,
    params,
    ...optional
  }: QueryListItemsOptions): Promise<Result<T[]>> => {
    const baseUrl = `${protocol}://${
      site + encodePath(serverRelativeUrl)
    }/_api/web/lists/GetByTitle('${odataLiteral(listName)}')/GetItems`
    const query = params?.toString()
    const url = query && query.length > 0 ? baseUrl + '?' + query : baseUrl

    const body = JSON.stringify({
      query: {
        __metadata: { type: 'SP.CamlQuery' },
        ViewXml: viewXml,
        ...(pagingInfo === undefined
          ? {}
          : { ListItemCollectionPosition: { PagingInfo: pagingInfo } }),
      },
    })

    return withRetry(retry, optional.signal, () =>
      withDigest(
        'queryListItems',
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
                Accept: 'application/json;odata=nometadata',
                'Content-Type': 'application/json;odata=verbose',
                'Content-Length': Buffer.byteLength(body),
                'X-RequestDigest': digest,
              },
              body,
              ...optional,
            })
            const page = safeParseResults(res)
            return page.success
              ? { success: true, data: page.data as T[] }
              : page
          } catch (error) {
            return toFailure('queryListItems', error)
          }
        }
      )
    )
  }
}
