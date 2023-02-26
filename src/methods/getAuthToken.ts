import os from 'os'

const getAuthToken =
  (
    username: string,
    password: string,
    siteUrl: string,
    protocol: string = 'https',
    domain: string = '',
    hostname: string = os.hostname()
  ) =>
  async () => {
    const route = `${protocol ?? 'https'}//${siteUrl}/_api/contextinfo`
    const token: string = 'someToken'
    return token
  }

export default getAuthToken
