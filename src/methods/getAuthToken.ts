import type { ActionFactory, Result } from '../types'
import os from 'os'
import { post } from '../ntlm'
import { safeParseAuthToken } from '../utils'

export const getAuthToken: ActionFactory<void, string> =
  ({
    username,
    password,
    site,
    serverRelativeUrl,
    protocol = 'https',
    domain = '',
    hostname = os.hostname(),
  }) =>
  async () => {
    const url = `${protocol}://${site + serverRelativeUrl}/_api/contextinfo`

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