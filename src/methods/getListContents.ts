import type { ConnectionOptions, Result } from '..'
import os from 'os'
import { get } from '../ntlm'
import { safeParseResults } from '../utils/parse'

const getListContents =
  ({
    username,
    password,
    site,
    serverRelativeUrl,
    protocol = 'https',
    domain = '',
    hostname = os.hostname(),
  }: ConnectionOptions) =>
  async (
    listName: string,
    params?: URLSearchParams
  ): Promise<Result<unknown[]>> => {
    const baseUrl = `${protocol}://${
      site + serverRelativeUrl
    }/_api/web/lists/GetByTitle('${listName}')/items`
    const query = params?.toString()
    const url = query && query.length > 0 ? baseUrl + '?' + query : baseUrl

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
        error: `Error in getListContents: ${error}`,
      }
    }
  }

export default getListContents
