import type { ActionFactory } from '../types'
import os from 'os'
import { post } from '../ntlm'

export const deleteDocumentFromLibrary: ActionFactory<
  {
    accessToken: string
    folder: string
    fileName: string
    timeout?: number
    binary?: boolean
  },
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
  async ({ accessToken, folder, fileName, ...optional }) => {
    const url = `${protocol}://${
      site + serverRelativeUrl
    }/_api/web/GetFileByServerRelativeUrl('${serverRelativeUrl}/${folder}/${fileName}')`

    const config = {
      url,
      username,
      password,
      workstation: hostname,
      domain,
      headers: {
        'X-RequestDigest': accessToken,
        'If-Match': '*',
        'X-HTTP-Method': 'DELETE',
      },
      ...optional,
    }

    try {
      await post(config)
      return {
        success: true,
        data: fileName,
      }
    } catch (error) {
      return {
        success: false,
        error: `Error in deleteDocumentFromLibrary: ${error}`,
      }
    }
  }
