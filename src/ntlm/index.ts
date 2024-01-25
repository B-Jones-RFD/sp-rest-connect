import type { GetOptions, PostOptions } from 'httpntlm'
import ntlm from 'httpntlm'

export async function get(options: GetOptions) {
  return new Promise<ReadableStream<Uint8Array>>((resolve, reject) => {
    ntlm.get(options, (err, res) => {
      if (err) reject(err)
      if (res && res.body) {
        resolve(res.body as ReadableStream<Uint8Array>)
      } else {
        reject(new Error(`Get empty response: ${options.url}`))
      }
    })
  })
}

export async function post(options: PostOptions) {
  return new Promise((resolve, reject) => {
    ntlm.post(options, (err, res) => {
      if (err) reject(err)
      if (res && (res.body || res.body === '')) {
        resolve(res.body)
      } else {
        reject(new Error(`Post did not return response body: ${options.url}`))
      }
    })
  })
}
