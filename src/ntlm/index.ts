import http from 'node:http'
import https from 'node:https'
import {
  createType1Message,
  createType3Message,
  parseType2Message,
  type NtlmCredentials,
} from './messages'
import { request, type NtlmRequestOptions } from './request'

export type { NtlmRequestOptions } from './request'
export type GetOptions = NtlmRequestOptions
export type PostOptions = NtlmRequestOptions
export type AuthOptions = NtlmCredentials & { url: string }

function unwrap(
  method: string,
  options: NtlmRequestOptions
): Promise<unknown> {
  return request(method as 'GET' | 'POST', options).then((res) => {
    if (res.statusCode >= 200 && res.statusCode <= 299) return res.body
    throw new Error(String(res.body))
  })
}

export async function get(options: GetOptions): Promise<unknown> {
  return unwrap('GET', options)
}

export async function post(options: PostOptions): Promise<unknown> {
  return unwrap('POST', options)
}

/**
 * Perform the NTLM negotiate leg against `url` and return the resulting
 * Type 3 `Authorization` header value.
 */
export async function auth(options: AuthOptions): Promise<string> {
  const type1msg = createType1Message(options)
  const client = options.url.startsWith('http:') ? http : https
  return new Promise<string>((resolve, reject) => {
    const req = client.get(
      options.url,
      { headers: { Authorization: type1msg } },
      (res) => {
        res.resume()
        const header = res.headers['www-authenticate']
        if (!header) {
          return reject(new Error('Auth response missing www-authenticate header'))
        }
        try {
          const type2msg = parseType2Message(header)
          resolve(createType3Message(type2msg, options))
        } catch (error) {
          reject(error)
        }
      }
    )
    req.on('error', reject)
  })
}
