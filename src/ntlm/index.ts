import { request, authenticate, type NtlmRequestOptions } from './request'
import { SpRestError } from '../errors'

export type { NtlmRequestOptions } from './request'
export type GetOptions = NtlmRequestOptions
export type PostOptions = NtlmRequestOptions
export type AuthOptions = Omit<
  NtlmRequestOptions,
  'headers' | 'body' | 'binary'
>

function unwrap(
  method: 'GET' | 'POST',
  options: NtlmRequestOptions
): Promise<unknown> {
  return request(method, options).then((res) => {
    if (res.statusCode >= 200 && res.statusCode <= 299) return res.body
    throw new SpRestError(res.statusCode, String(res.body), res.headers)
  })
}

/**
 * NTLM-authenticated GET. Resolves the response body on 2xx, rejects otherwise.
 */
export async function get(options: GetOptions): Promise<unknown> {
  return unwrap('GET', options)
}

/**
 * NTLM-authenticated POST. Resolves the response body on 2xx, rejects otherwise.
 */
export async function post(options: PostOptions): Promise<unknown> {
  return unwrap('POST', options)
}

/**
 * Perform the NTLM negotiate leg against `url` and return the resulting
 * Type 3 `Authorization` header value.
 */
export async function auth(options: AuthOptions): Promise<string> {
  return authenticate(options)
}
