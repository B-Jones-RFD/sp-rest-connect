import type { ConnectionOptions, Result } from '..'
import os from 'os'
import { post } from '../ntlm'
import { safeParseServerUrl } from '../utils/parse'

const addDocumentToLibrary =
  ({
    siteUrl,
    username,
    password,
    protocol = 'https',
    domain = '',
    hostname = os.hostname(),
  }: ConnectionOptions) =>
  async (
    accessToken: string,
    folder: string,
    fileName: string,
    payload: Buffer
  ): Promise<Result<string>> => {
    const url = `${protocol}://${siteUrl}/_api/web/GetFolderByServerRelativeUrl('${folder}')/Files/add(url='${fileName}',overwrite=true)`

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

export default addDocumentToLibrary
