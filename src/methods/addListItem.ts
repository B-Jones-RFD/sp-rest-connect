import type { ConnectionOptions, Result } from '..'
import os from 'os'
import { post } from '../ntlm'

const addListItem =
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
    listName: string,
    spId: number,
    payload: string
  ): Promise<Result<string>> => {
    const url = `${protocol}//${siteUrl}/_api/web/lists/GetByTitle('${listName}')/items('${spId}')`

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

      await post(config)
      return {
        success: true,
        data: payload,
      }
    } catch (error) {
      return {
        success: false,
        error: `Error in addListItem: ${error}`,
      }
    }
  }
export default addListItem
