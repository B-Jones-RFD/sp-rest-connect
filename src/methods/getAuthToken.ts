import type { ConnectionOptions, Result } from '..'
import os from 'os'
import { post } from '../ntlm'
import { safeParseAuthToken } from '../utils/parse'

const getAuthToken =
  ({
    username,
    password,
    siteUrl,
    protocol = 'https',
    domain = '',
    hostname = os.hostname(),
  }: ConnectionOptions) =>
  async (): Promise<Result<string>> => {
    const url = `${protocol}//${siteUrl}/_api/contextinfo`

    const config = {
      url,
      username,
      password,
      workstation: hostname,
      domain,
      headers: {
        Accept: 'application/json;odata=verbose',
        'Content-Type': 'application/json;odata=verbose',
      },
      body: '',
    }

    try {
      const res = await post(config)
      const result = safeParseAuthToken(res)
      return result
    } catch (error) {
      return {
        success: false,
        error: `Error in getAuthToken: ${error}`,
      }
    }
  }

export default getAuthToken
