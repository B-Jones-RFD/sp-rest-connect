import type { GetOptions, PostOptions, AuthOptions } from 'httpntlm'
import https from 'node:https'
import httpntlm, { ntlm } from 'httpntlm'

export async function get(options: GetOptions) {
  return new Promise<unknown>((resolve, reject) => {
    httpntlm.get(options, (err, res) => {
      if (err) reject(err)
      if (res && res.body) {
        res.statusCode >= 200 && res.statusCode <= 299
          ? resolve(res.body as unknown)
          : reject(new Error(res.body.toString()))
      }
    })
  })
}

export async function post(options: PostOptions) {
  return new Promise((resolve, reject) => {
    httpntlm.post(options, (err, res) => {
      if (err) reject(err)
      if (res && (res.body || res.body === '')) {
        res.statusCode >= 200 && res.statusCode <= 299
          ? resolve(res.body)
          : reject(new Error(res.body.toString()))
      } else {
        reject(new Error(`Post did not return response body: ${options.url}`))
      }
    })
  })
}

export async function auth(options: AuthOptions) {
  const type1msg = ntlm.createType1Message(options)
  return new Promise((resolve, reject) => {
    https.get(
      options.url,
      {
        headers: {
          Authorization: type1msg,
        },
      },
      (res) => {
        const headers = res.headers
        if (headers['www-authenticate']) {
          const type2msg = ntlm.parseType2Message(headers['www-authenticate'])
          const type3msg = ntlm.createType3Message(type2msg, options)
          resolve(type3msg)
        } else {
          reject('Auth response missing www-authenticate header')
        }
      }
    )
  })
}
