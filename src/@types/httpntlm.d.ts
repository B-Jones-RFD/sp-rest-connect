declare module 'httpntlm' {
  interface Options {
    url: string
    username: string
    password: string
    workstation: string
    domain: string
    parameters?: Record<string, string | number>
    headers?: Record<string, string | number>
    cookies?: Array<string>
    binary?: boolean
    allowRedirects?: boolean
    maxRedirects?: number
    timeout?: number | 'none'
    proxy?: {
      host: string
      port: number
      protocol: 'http' | 'https'
    }
  }

  export interface PostOptions extends Options {
    body?: string | Buffer
    json?: string
    files?: object
    encodePostParameters?: boolean
  }

  export interface GetOptions extends Options {}

  interface Response {
    headers: object
    statusCode: number
    body: Buffer | unknown
    cookies?: Array<String>
  }

  export function get(
    config: GetOptions,
    callback: (error: Error, response: Response) => void
  ): void

  export function post(
    config: PostOptions,
    callback: (error: Error, response: Response) => void
  ): void
}
