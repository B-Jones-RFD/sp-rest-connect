import type { GetOptions, PostOptions, AuthOptions } from 'httpntlm'
import http from 'node:http'
import https from 'node:https'
import httpntlm, { ntlm } from 'httpntlm'

export async function get(options: GetOptions) {
  return new Promise<unknown>((resolve, reject) => {
    httpntlm.get(options, (err, res) => {
      if (err) return reject(err)
      if (res && (res.body || res.body === '')) {
        res.statusCode >= 200 && res.statusCode <= 299
          ? resolve(res.body as unknown)
          : reject(new Error(String(res.body)))
      } else {
        reject(new Error(`Get did not return response body: ${options.url}`))
      }
    })
  })
}

export async function post(options: PostOptions) {
  return new Promise((resolve, reject) => {
    httpntlm.post(options, (err, res) => {
      if (err) return reject(err)
      if (res && (res.body || res.body === '')) {
        res.statusCode >= 200 && res.statusCode <= 299
          ? resolve(res.body)
          : reject(new Error(String(res.body)))
      } else {
        reject(new Error(`Post did not return response body: ${options.url}`))
      }
    })
  })
}

export async function auth(options: AuthOptions) {
  const type1msg = ntlm.createType1Message(options)
  const client = options.url.startsWith('http:') ? http : https
  return new Promise((resolve, reject) => {
    const req = client.get(
      options.url,
      {
        headers: {
          Authorization: type1msg,
        },
      },
      (res) => {
        res.resume()
        const headers = res.headers
        if (headers['www-authenticate']) {
          const type2msg = ntlm.parseType2Message(headers['www-authenticate'])
          const type3msg = ntlm.createType3Message(type2msg, options)
          resolve(type3msg)
        } else {
          reject(new Error('Auth response missing www-authenticate header'))
        }
      }
    )
    req.on('error', reject)
  })
}
