import type { ConnectionOptions, Result } from '..'
import os from 'os'
import { get } from '../ntlm'
import { safeParseResults } from '../utils/parse'

const getFolderContents =
  ({
    site,
    serverRelativeUrl,
    username,
    password,
    protocol = 'https',
    domain = '',
    hostname = os.hostname(),
  }: ConnectionOptions) =>
  async (folder: string): Promise<Result<unknown[]>> => {
    const url = `${protocol}://${
      site + serverRelativeUrl
    }/_api/web/GetFolderByServerRelativeUrl('${serverRelativeUrl}/${folder}')/Files`

    const config = {
      url,
      username,
      password,
      workstation: hostname,
      domain,
      headers: {
        Accept: 'application/json; odata=nometadata',
      },
    }

    try {
      const res = await get(config)
      const results = safeParseResults(res)
      return results
    } catch (error) {
      return {
        success: false,
        error: `Error in getFolderContents: ${error}`,
      }
    }
  }

export default getFolderContents
