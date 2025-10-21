import type { ActionFactory } from '../types'
import os from 'os'
import { post } from '../ntlm'

export const deleteListItem: ActionFactory<
  {
    accessToken: string
    listName: string
    spId: number
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
    ...optional
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
        ...optional,
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
