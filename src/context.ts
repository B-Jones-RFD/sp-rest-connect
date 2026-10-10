import type {
  ConnectionContext,
  DigestCache,
  EntityTypeCache,
  ListItemPayload,
  RequestOptions,
  Result,
  SiteConnectionOptions,
} from './types'
import { getContextInfo } from './methods/getFormDigestValue'
import { getListItemType } from './methods/getListItemType'
import { failure, success } from './utils'

/** Refresh the digest this long before SharePoint says it expires. */
const REFRESH_MARGIN_MS = 60_000

function createDigestCache(options: SiteConnectionOptions): DigestCache {
  const fetchInfo = getContextInfo(options)
  let value: string | undefined
  let expiresAt = 0
  let inflight: Promise<Result<string>> | undefined

  return {
    get(request) {
      if (value !== undefined && Date.now() < expiresAt) {
        return Promise.resolve(success(value))
      }
      if (inflight) return inflight
      inflight = fetchInfo(request)
        .then((info) => {
          if (!info.success) return info
          const lifetime = info.data.timeoutSeconds * 1000
          // For very short lifetimes keep at least half of it.
          const margin = Math.min(REFRESH_MARGIN_MS, lifetime / 2)
          value = info.data.digest
          expiresAt = Date.now() + lifetime - margin
          return success(value)
        })
        .finally(() => {
          inflight = undefined
        })
      return inflight
    },
    invalidate() {
      value = undefined
      expiresAt = 0
    },
  }
}

function createEntityTypeCache(
  options: SiteConnectionOptions
): EntityTypeCache {
  const lookup = getListItemType(options)
  const types = new Map<string, Promise<Result<string>>>()

  return {
    get(listName, request) {
      const cached = types.get(listName)
      if (cached) return cached
      const pending = lookup({ listName, ...request }).then((res) => {
        if (!res.success) types.delete(listName)
        return res
      })
      types.set(listName, pending)
      return pending
    },
    invalidate(listName) {
      if (listName === undefined) types.clear()
      else types.delete(listName)
    },
  }
}

/**
 * Creates the shared per-site caches used by write actions.
 * `createSiteConnection` calls this for you; use it directly to share a
 * managed digest between standalone action factories.
 */
export function createConnectionContext(
  options: SiteConnectionOptions
): ConnectionContext {
  return {
    digests: createDigestCache(options),
    entityTypes: createEntityTypeCache(options),
  }
}

function withPrefix<T>(
  action: string,
  what: string,
  res: Result<T>
): Result<T> {
  if (res.success) return res
  return { ...res, error: `Error in ${action}: ${what}: ${res.error}` }
}

/**
 * Runs `run` with a request digest. An explicit digest is used as-is. A
 * managed digest comes from the cache; if SharePoint answers 403 the cache is
 * invalidated and `run` is retried once with a fresh digest (unless
 * `retryOnReject` is false — e.g. the body was a stream and cannot be resent).
 */
export async function withDigest<T>(
  action: string,
  context: ConnectionContext,
  explicit: string | undefined,
  request: RequestOptions,
  run: (digest: string) => Promise<Result<T>>,
  retryOnReject = true
): Promise<Result<T>> {
  if (explicit !== undefined) return run(explicit)

  const first = await context.digests.get(request)
  if (!first.success)
    return withPrefix(action, 'could not obtain a request digest', first)

  const result = await run(first.data)
  if (
    retryOnReject &&
    !result.success &&
    result.code === 'AUTH' &&
    result.status === 403
  ) {
    context.digests.invalidate()
    const fresh = await context.digests.get(request)
    if (!fresh.success)
      return withPrefix(action, 'could not refresh the request digest', fresh)
    return run(fresh.data)
  }
  return result
}

/**
 * Serialises a list-item payload. Objects without `__metadata` get the
 * list's entity type from the cache; strings are passed through unchanged.
 */
export async function serialiseListItem(
  action: string,
  context: ConnectionContext,
  listName: string,
  payload: ListItemPayload,
  request: RequestOptions
): Promise<Result<string>> {
  if (typeof payload === 'string') return success(payload)
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload))
    return failure(
      `Error in ${action}: payload must be a plain object or a JSON string`,
      'UNKNOWN'
    )
  if ('__metadata' in payload) return success(JSON.stringify(payload))

  const type = await context.entityTypes.get(listName, request)
  if (!type.success)
    return withPrefix(
      action,
      `could not resolve the entity type of '${listName}'`,
      type
    )
  return success(
    JSON.stringify({ __metadata: { type: type.data }, ...payload })
  )
}
