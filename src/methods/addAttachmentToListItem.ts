import type { ConnectionOptions, Result } from '..'
import os from 'os'
import { post } from '../ntlm'
import { safeParseServerUrl } from '../utils/parse'

const addAttachmentToListItem =
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
    listName: string,
    spId: number,
    fileName: string,
    payload: Buffer
  ): Promise<Result<string>> => {
    const url = `${protocol}://${
      site + serverRelativeUrl
    }/_api/web/lists/GetByTitle('${listName}')/items('${spId}')/AttachmentFiles/add(FileName='${fileName}')`

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
        error: `Error in addAttachmentToList: ${error}`,
      }
    }
  }

export default addAttachmentToListItem
