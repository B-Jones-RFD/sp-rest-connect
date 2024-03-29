import type { ActionFactory } from '../types'
import os from 'os'
import { get } from '../ntlm'
import { safeParseDocument } from '../utils'

export const getDocumentFromLibrary: ActionFactory<
  { folder: string; fileName: string },
  Buffer
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
  async ({ folder, fileName }) => {
    const url = `${protocol}://${
      site + serverRelativeUrl
    }/_api/web/GetFolderByServerRelativeUrl('${serverRelativeUrl}/${folder}')/Files('${fileName}')/$value`

    const config = {
      url,
      username,
      password,
      workstation: hostname,
      domain,
      headers: {
        Accept: 'application/json; odata=verbose',
      },
      binary: true,
    }

    try {
      const res = await get(config)
      const document = safeParseDocument(res)
      return document
    } catch (error) {
      return {
        success: false,
        error: `Error in getDocumentFromLibrary: ${error}`,
      }
    }
  }
