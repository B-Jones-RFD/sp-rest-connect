import type { Result, ActionFactory } from '../types'
import os from 'os'
import { post } from '../ntlm'
import { safeParseServerUrl } from '../utils'

export const addAttachmentToListItem: ActionFactory<
  {
    accessToken: string
    listName: string
    spId: number
    fileName: string
    payload: Buffer
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
  async ({ accessToken, listName, spId, fileName, payload }) => {
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
