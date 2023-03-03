import type { ConnectionOptions, Result } from '..'
import os from 'os'
import { post } from '../ntlm'
import { safeParseDocument } from '../utils/parse'

const deleteDocumentFromLibrary =
  ({
    site,
    serverRelativeUrl,
    username,
    password,
    protocol = 'https',
    domain = '',
    hostname = os.hostname(),
  }: ConnectionOptions) =>
  async (
    accessToken: string,
    folder: string,
    fileName: string
  ): Promise<Result<string>> => {
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

export default deleteDocumentFromLibrary
