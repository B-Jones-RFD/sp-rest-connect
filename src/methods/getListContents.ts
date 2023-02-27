import type { ConnectionOptions, Result } from '..'
import os from 'os'
import { get } from '../ntlm'
import { safeParseResults } from '../utils/parse'

const getListContents =
  ({
    username,
    password,
    siteUrl,
    protocol = 'https',
    domain = '',
    hostname = os.hostname(),
  }: ConnectionOptions) =>
  async (
    listName: string,
    params?: URLSearchParams
  ): Promise<Result<unknown[]>> => {
    let url = `${protocol}//${siteUrl}}/_api/web/lists/GetByTitle('${listName}')/items`

    if (params) {
      url + '?' + params.toString()
    }
    const config = {
      url,
      username,
      password,
      workstation: hostname,
      domain,
      headers: {
        Accept: 'application/json; odata=verbose',
      },
    }

    try {
      const res = get(config)
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
