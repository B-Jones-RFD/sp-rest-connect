import type { ConnectionOptions, Result } from '..'
import os from 'os'
import { post } from '../ntlm'

const updateListItem =
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
    patch: string
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
          'Content-Length': patch.length,
          'X-RequestDigest': accessToken,
          'If-Match': '*',
          'X-HTTP-Method': 'MERGE',
        },
        body: patch,
      }

      await post(config)
      return {
        success: true,
        data: patch,
      }
    } catch (error) {
      return {
        success: false,
        error: `Error in updateListItem: ${error}`,
      }
    }
  }

export default updateListItem
