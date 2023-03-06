import type { ActionFactory } from '../types'
import os from 'os'
import { post } from '../ntlm'

export const updateListItem: ActionFactory<
  {
    accessToken: string
    listName: string
    spId: number
    patch: string
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
  async ({ accessToken, listName, spId, patch }) => {
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
