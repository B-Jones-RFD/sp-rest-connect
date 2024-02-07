import type { ActionFactory } from '../types'
import os from 'os'
import { auth } from '../ntlm'
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
    const url = `${protocol}://${site + serverRelativeUrl}`

    const config = {
      url,
      username,
      password,
      workstation: hostname,
      domain,
    }

    try {
      const res = await auth(config)
      const result = safeParseAuthToken(res)
      return result
    } catch (error) {
      return {
        success: false,
        error: `Error in getAuthToken: ${error}`,
      }
    }
  }
