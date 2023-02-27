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
  if (!parsed.d?.results)
    return { success: false, error: 'Results not in response' }
  const results = parsed.d.results
  return results && Array.isArray(results)
    ? { success: true, data: results }
    : { success: false, error: 'No results returned' }
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
