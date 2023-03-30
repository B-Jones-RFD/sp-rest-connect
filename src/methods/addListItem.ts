import type { ActionFactory } from '../types'
import os from 'os'
import { post } from '../ntlm'

export const addListItem: ActionFactory<
  { accessToken: string; listName: string; payload: string },
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
  async ({ accessToken, listName, payload }) => {
    const url = `${protocol}://${
      site + serverRelativeUrl
    }/_api/web/lists/GetByTitle('${listName}')/items`

    try {
      const config = {
        url,
        username,
        password,
        workstation: hostname,
        domain,
        headers: {
          Accept: 'application/json;odata=nometadata',
          'Content-Type': 'application/json;odata=verbose',
          'Content-Length': payload.length,
          'X-RequestDigest': accessToken,
        },
        body: payload,
      }

      const result = await post(config)
      const data = JSON.stringify(result, null, 2)
      return {
        success: true,
        data,
      }
    } catch (error) {
      return {
        success: false,
        error: `Error in addListItem: ${error}`,
      }
    }
  }
