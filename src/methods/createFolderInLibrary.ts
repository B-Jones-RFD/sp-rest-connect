import type { ActionFactory } from '../types'
import os from 'os'
import { post } from '../ntlm'
import { safeParseServerUrl } from '../utils'

export const createFolderInLibrary: ActionFactory<
  { accessToken: string; folder: string; timeout?: number; binary?: boolean },
  string
> =
  ({
    site,
    serverRelativeUrl,
    username,
    password,
    protocol = 'https',
    domain = '',
    hostname = os.hostname(),
  }) =>
  async ({ accessToken, folder, ...optional }) => {
    const url = `${protocol}://${site + serverRelativeUrl}/_api/web/folders`

    const payload = JSON.stringify({
      ServerRelativeUrl: folder,
    })

    try {
      const config = {
        url,
        username,
        password,
        workstation: hostname,
        domain,
        headers: {
          Accept: 'application/json;odata=verbose',
          'Content-Type': 'application/json',
          'Content-Length': payload.length,
          'X-RequestDigest': accessToken,
        },
        body: payload,
        ...optional,
      }
      const res = await post(config)
      const result = safeParseServerUrl(res)
      return result
    } catch (error) {
      return {
        success: false,
        error: `Error in createFolderInLibrary: ${error}`,
      }
    }
  }
