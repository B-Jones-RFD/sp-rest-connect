import type { ActionFactory } from '../types'
import os from 'os'
import { post } from '../ntlm'
import { safeParseServerUrl } from '../utils'

export const addDocumentToLibrary: ActionFactory<
  { accessToken: string; folder: string; fileName: string; payload: Buffer },
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
  async ({ accessToken, folder, fileName, payload }) => {
    const url = `${protocol}://${
      site + serverRelativeUrl
    }/_api/web/GetFolderByServerRelativeUrl('${folder}')/Files/add(url='${fileName}',overwrite=true)`

    try {
      const config = {
        url,
        username,
        password,
        workstation: hostname,
        domain,
        headers: {
          Accept: 'application/json;odata=verbose',
          'Content-Type': 'application/json;odata=verbose',
          'Content-Length': payload.length,
          'X-RequestDigest': accessToken,
        },
        body: payload,
      }
      const res = await post(config)
      const result = safeParseServerUrl(res)
      return result
    } catch (error) {
      return {
        success: false,
        error: `Error in addDocumentToLibrary: ${error}`,
      }
    }
  }
