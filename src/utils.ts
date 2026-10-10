import { Readable } from 'node:stream'
import type {
  CreatedListItem,
  Failure,
  FailureCode,
  Page,
  PageResult,
  Result,
  Success,
} from './types'

export function success<T>(data: T): Success<T> {
  return {
    success: true,
    data,
  }
}

/**
 * Builds a {@link Failure}. Defaults to code `PARSE`, which is what every
 * `safeParse*` helper in this module reports.
 */
export function failure(error: string, code: FailureCode = 'PARSE'): Failure {
  return {
    success: false,
    error,
    code,
  }
}

/**
 * Escapes a value for use inside an OData string literal (`'...'`) in a URL
 * path: apostrophes are doubled per OData and the result is percent-encoded.
 * `encodeURIComponent` leaves `'` and `()` intact, so the doubled apostrophes
 * survive encoding.
 */
export function odataLiteral(value: string): string {
  return encodeURIComponent(value.replace(/'/g, "''"))
}

/**
 * Escapes a server-relative path for use inside an OData string literal:
 * each `/`-separated segment is treated with {@link odataLiteral} so slashes
 * are preserved while spaces, `#`, `%`, `?` and apostrophes are not.
 */
export function odataPath(path: string): string {
  return path.split('/').map(odataLiteral).join('/')
}

/** Percent-encodes each segment of a URL path, preserving the slashes. */
export function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/')
}

export function safeParseAuthToken(token: any): Result<string> {
  return typeof token !== 'string'
    ? failure('Incorrect token format')
    : success(token)
}

/** Parsed `/_api/contextinfo` response. */
export type ContextInfo = {
  digest: string
  /** Lifetime of `digest` in seconds, as reported by SharePoint (default 1800). */
  timeoutSeconds: number
}

export function safeParseContextInfo(res: any): Result<ContextInfo> {
  if (typeof res !== 'string') return failure('Incorrect response format')
  try {
    const parsed = JSON.parse(res)
    if (!parsed.d?.GetContextWebInformation)
      return failure('GetContextWebInformation not in response')
    const contextInfo = parsed.d.GetContextWebInformation
    if (!contextInfo?.FormDigestValue)
      return failure('FormDigestValue not in response')
    const token = contextInfo.FormDigestValue
    if (typeof token !== 'string')
      return failure('Access token not in response')
    const timeout = contextInfo.FormDigestTimeoutSeconds
    return success({
      digest: token,
      timeoutSeconds:
        typeof timeout === 'number' && timeout > 0 ? timeout : 1800,
    })
  } catch (error) {
    return failure(`Unable to parse ${res}`)
  }
}

export function safeParseFormDigestValue(res: any): Result<string> {
  const info = safeParseContextInfo(res)
  return info.success ? success(info.data.digest) : info
}

export function safeParseItemType(res: any): Result<string> {
  if (typeof res !== 'string') return failure('Incorrect response format')
  try {
    const parsed = JSON.parse(res)
    if (!parsed.ListItemEntityTypeFullName)
      return failure('ListItemEntityTypeFullName not in response')
    const itemType = parsed.ListItemEntityTypeFullName
    return typeof itemType === 'string'
      ? success(itemType)
      : failure('Item type not returned')
  } catch (error) {
    return failure(`Unable to parse ${res}`)
  }
}

export function safeParseResults(res: any): PageResult<unknown> {
  if (typeof res !== 'string') return failure('Incorrect response format')
  try {
    const parsed = JSON.parse(res)
    if (!parsed.value) return failure('Results not in response')
    const results = parsed.value
    if (!results || !Array.isArray(results))
      return failure('No results returned')
    const page: Page<unknown> = success<unknown[]>(results)
    // nometadata: "odata.nextLink"; verbose: d.__next (not used by this package)
    const next = parsed['odata.nextLink'] ?? parsed['@odata.nextLink']
    if (typeof next === 'string' && next.length > 0) page.nextLink = next
    return page
  } catch (error) {
    return failure(`Unable to parse ${res}`)
  }
}

export function safeParseResult(res: any): Result<unknown> {
  if (typeof res !== 'string') return failure('Incorrect response format')
  try {
    const result = JSON.parse(res)
    return success<unknown>(result)
  } catch (error) {
    return failure(`Unable to parse ${res}`)
  }
}

export function safeParseDocument(res: any): Result<Buffer> {
  return Buffer.isBuffer(res)
    ? success(res)
    : failure('Incorrect response format')
}

export function safeParseId(res: any): Result<number> {
  if (typeof res !== 'string') return failure('Incorrect response format')
  try {
    const parsed = JSON.parse(res)
    if (parsed.d?.ID === undefined || parsed.d?.ID === null)
      return failure('ID not in response')
    const id = parsed.d.ID
    return typeof id === 'number'
      ? success(id)
      : failure('Invalid ID type returned')
  } catch (error) {
    return failure(`Unable to parse ${res}`)
  }
}

export function safeParseServerUrl(res: any): Result<string> {
  if (typeof res !== 'string') return failure('Incorrect response format')
  try {
    const parsed = JSON.parse(res)
    if (!parsed.d?.ServerRelativeUrl)
      return failure('ServerRelativeUrl not in response')
    const url = parsed.d.ServerRelativeUrl
    return typeof url === 'string'
      ? success(url)
      : failure('Invalid ServerRelativeUrl type returned')
  } catch (error) {
    return failure(`Unable to parse ${res}`)
  }
}

export function safeParseFolderExists(res: any): Result<boolean> {
  if (typeof res !== 'string') return failure('Incorrect response format')
  try {
    const parsed = JSON.parse(res)
    if (parsed.value === undefined || parsed.value === null)
      return failure('Exists value not in response')
    const exists = parsed.value
    return typeof exists === 'boolean'
      ? success(exists)
      : failure('Invalid Exists type returned')
  } catch (error) {
    return failure(`Unable to parse ${res}`)
  }
}

export function safeParseStream(res: any): Result<Readable> {
  return res instanceof Readable
    ? success(res)
    : failure('Incorrect response format')
}

/**
 * Parses the body SharePoint returns after creating an item. Accepts both the
 * `nometadata` shape (flat object) and the `verbose` shape (`{ d: {...} }`),
 * and guarantees a numeric `Id`.
 */
export function safeParseCreatedItem(res: any): Result<CreatedListItem> {
  if (typeof res !== 'string') return failure('Incorrect response format')
  try {
    const parsed = JSON.parse(res)
    const item = parsed?.d ?? parsed
    if (typeof item !== 'object' || item === null || Array.isArray(item))
      return failure('Created item not in response')
    const id = item.Id ?? item.ID
    if (typeof id !== 'number') return failure('Id not in response')
    return success({ ...item, Id: id })
  } catch (error) {
    return failure(`Unable to parse ${res}`)
  }
}
