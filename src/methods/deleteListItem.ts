import type { ActionFactory, Result } from '../@types'
import os from 'os'
import { post } from '../ntlm'

export const deleteListItem: ActionFactory<
  {
    accessToken: string
    listName: string
    spId: number
  },
  Promise<Result<string>>
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
  async ({ accessToken, listName, spId }) => {
    const url = `${protocol}://${
      site + serverRelativeUrl
    }/_api/web/lists/GetByTitle('${listName}')/items('${spId}')`

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
