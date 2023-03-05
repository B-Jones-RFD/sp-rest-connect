import type { ActionFactory, Result } from '../types'
import os from 'os'
import { post } from '../ntlm'

export const addListItem: ActionFactory<
  { accessToken: string; listName: string; spId: number; payload: string },
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
  async ({ accessToken, listName, spId, payload }) => {
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
