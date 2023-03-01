import type { ConnectionOptions, Result } from '..'
import os from 'os'
import { post } from '../ntlm'

const deleteListItem =
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
    spId: number
  ): Promise<Result<string>> => {
    const url = `${protocol}://${siteUrl}/_api/web/lists/GetByTitle('${listName}')/items('${spId}')`

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
          'X-RequestDigest': accessToken,
          'If-Match': '*',
          'X-HTTP-Method': 'DELETE',
        },
        body: '',
      }

      await post(config)
      return {
        success: true,
        data: '',
      }
    } catch (error) {
      return {
        success: false,
        error: `Error in deleteListItem: ${error}`,
      }
    }
  }

export default deleteListItem
