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

export function safeParseAuthToken(res: any): Result<string> {
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
    const results = parsed
    if (!parsed.ListItemEntityTypeFullName)
      return failure('ListItemEntityTypeFullName not in response')
    return results.ListItemEntityTypeFullName &&
      typeof results.ListItemEntityTypeFullName === 'string'
      ? success(results.ListItemEntityTypeFullName)
      : failure('Item type not returned')
  } catch (error) {
    return failure(`Unable to parse ${res}`)
  }
}

export function safeParseResults<T>(res: any): Result<unknown[]> {
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

export function safeParseDocument(res: any): Result<string> {
  return typeof res !== 'string'
    ? failure('Incorrect response format')
    : success(res)
}

export function safeParseId(res: any): Result<unknown[]> {
  if (typeof res !== 'string') return failure('Incorrect response format')
  try {
    const parsed = JSON.parse(res)
    if (!parsed.d?.ID) return failure('ID not in response')
    const id = parsed.d.ID
    return success<unknown[]>(id)
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
    if (!parsed.value) return failure('Exists value not in response')
    const exists = parsed.value
    return typeof exists === 'boolean'
      ? success(exists)
      : failure('Invalid Exists type returned')
  } catch (error) {
    return failure(`Unable to parse ${res}`)
  }
}
