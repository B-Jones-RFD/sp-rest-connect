import type { Result } from '../'

export function safeParseAuthToken(res: any): Result<string> {
  if (typeof res !== 'string')
    return { success: false, error: 'Incorrect response format' }
  const parsed = JSON.parse(res)
  if (!parsed.d?.GetContextWebInformation)
    return { success: false, error: 'GetContextWebInformation not in response' }
  const contextInfo = parsed.d.GetContextWebInformation
  if (!contextInfo?.FormDigestValue)
    return { success: false, error: 'FormDigestValue not in response' }
  const token = contextInfo.FormDigestValue
  return typeof token !== 'string'
    ? { success: false, error: 'token not in response' }
    : { success: true, data: token }
}

export function safeParseResults(res: any): Result<unknown[]> {
  if (typeof res !== 'string')
    return { success: false, error: 'Incorrect response format' }
  const parsed = JSON.parse(res)
  if (!parsed.value) return { success: false, error: 'Results not in response' }
  const results = parsed.value
  return results && Array.isArray(results)
    ? { success: true, data: results }
    : { success: false, error: 'No results returned' }
}

export function safeParseResult(res: any): Result<unknown> {
  if (typeof res !== 'string')
    return { success: false, error: 'Incorrect response format' }
  const result = JSON.parse(res)
  return result
    ? { success: true, data: result }
    : { success: false, error: 'No result returned' }
}

export function safeParseDocument(res: any): Result<string> {
  if (typeof res !== 'string')
    return { success: false, error: 'Incorrect response format' }
  return res
    ? { success: true, data: res }
    : { success: false, error: 'No data returned' }
}

export function safeParseId(res: any): Result<unknown[]> {
  if (typeof res !== 'string')
    return { success: false, error: 'Incorrect response format' }
  const parsed = JSON.parse(res)
  if (!parsed.d?.ID) return { success: false, error: 'ID not in response' }
  const id = parsed.d.ID
  return id
    ? { success: true, data: id }
    : { success: false, error: 'No results returned' }
}

export function safeParseServerUrl(res: any): Result<string> {
  if (typeof res !== 'string')
    return { success: false, error: 'Incorrect response format' }
  const parsed = JSON.parse(res)
  if (!parsed.d?.ServerRelativeUrl)
    return { success: false, error: 'ServerRelativeUrl not in response' }
  const url = parsed.d.ServerRelativeUrl
  return url && typeof url === 'string'
    ? { success: true, data: url }
    : { success: false, error: 'No results returned' }
}
