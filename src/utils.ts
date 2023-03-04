import type { Result } from './@types'

export function safeParseAuthToken(res: any): Result<string> {
  if (typeof res !== 'string')
    return { success: false, error: 'Incorrect response format' }
  try {
    const parsed = JSON.parse(res)
    if (!parsed.d?.GetContextWebInformation)
      return {
        success: false,
        error: 'GetContextWebInformation not in response',
      }
    const contextInfo = parsed.d.GetContextWebInformation
    if (!contextInfo?.FormDigestValue)
      return { success: false, error: 'FormDigestValue not in response' }
    const token = contextInfo.FormDigestValue
    return typeof token !== 'string'
      ? { success: false, error: 'Access token not in response' }
      : { success: true, data: token }
  } catch (error) {
    return {
      success: false,
      error: `Unable to parse ${res}`,
    }
  }
}

export function safeParseResults(res: any): Result<unknown[]> {
  if (typeof res !== 'string')
    return { success: false, error: 'Incorrect response format' }
  try {
    const parsed = JSON.parse(res)
    if (!parsed.value)
      return { success: false, error: 'Results not in response' }
    const results = parsed.value
    return results && Array.isArray(results)
      ? { success: true, data: results }
      : { success: false, error: 'No results returned' }
  } catch (error) {
    return {
      success: false,
      error: `Unable to parse ${res}`,
    }
  }
}

export function safeParseResult(res: any): Result<unknown> {
  if (typeof res !== 'string')
    return { success: false, error: 'Incorrect response format' }
  try {
    const result = JSON.parse(res)
    return { success: true, data: result }
  } catch (error) {
    return {
      success: false,
      error: `Unable to parse ${res}`,
    }
  }
}

export function safeParseDocument(res: any): Result<string> {
  if (typeof res !== 'string')
    return { success: false, error: 'Incorrect response format' }
  return { success: true, data: res }
}

export function safeParseId(res: any): Result<unknown[]> {
  if (typeof res !== 'string')
    return { success: false, error: 'Incorrect response format' }
  try {
    const parsed = JSON.parse(res)
    if (!parsed.d?.ID) return { success: false, error: 'ID not in response' }
    const id = parsed.d.ID
    return { success: true, data: id }
  } catch (error) {
    return {
      success: false,
      error: `Unable to parse ${res}`,
    }
  }
}

export function safeParseServerUrl(res: any): Result<string> {
  if (typeof res !== 'string')
    return { success: false, error: 'Incorrect response format' }
  try {
    const parsed = JSON.parse(res)
    if (!parsed.d?.ServerRelativeUrl)
      return { success: false, error: 'ServerRelativeUrl not in response' }
    const url = parsed.d.ServerRelativeUrl
    return typeof url === 'string'
      ? { success: true, data: url }
      : { success: false, error: 'Invalid ServerRelativeUrl type returned' }
  } catch (error) {
    return {
      success: false,
      error: `Unable to parse ${res}`,
    }
  }
}
