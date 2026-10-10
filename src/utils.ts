import type { Failure, Result, Success } from './types'

export function success<T>(data: T): Success<T> {
  return {
    success: true,
    data,
  }
}

export function failure(error: string): Failure {
  return {
    success: false,
    error,
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

export function safeParseFormDigestValue(res: any): Result<string> {
  if (typeof res !== 'string') return failure('Incorrect response format')
  try {
    const parsed = JSON.parse(res)
    if (!parsed.d?.GetContextWebInformation)
      return failure('GetContextWebInformation not in response')
    const contextInfo = parsed.d.GetContextWebInformation
    if (!contextInfo?.FormDigestValue)
      return failure('FormDigestValue not in response')
    const token = contextInfo.FormDigestValue
    return typeof token !== 'string'
      ? failure('Access token not in response')
      : success(token)
  } catch (error) {
    return failure(`Unable to parse ${res}`)
  }
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

export function safeParseResults(res: any): Result<unknown[]> {
  if (typeof res !== 'string') return failure('Incorrect response format')
  try {
    const parsed = JSON.parse(res)
    if (!parsed.value) return failure('Results not in response')
    const results = parsed.value
    return results && Array.isArray(results)
      ? success<unknown[]>(results)
      : failure('No results returned')
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
