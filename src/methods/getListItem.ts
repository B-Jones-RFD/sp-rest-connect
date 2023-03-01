import type { ConnectionOptions, Result } from '..'
import os from 'os'
import { get } from '../ntlm'
import { safeParseResults } from '../utils/parse'

const getListItem =
  ({
    siteUrl,
    username,
    password,
    protocol = 'https',
    domain = '',
    hostname = os.hostname(),
  }: ConnectionOptions) =>
  async (listName: string, spId: number): Promise<Result<unknown[]>> => {
    const url = `${protocol}://${siteUrl}/_api/web/lists/GetByTitle('${listName}')/items('${spId}')`

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
        error: `Error in getListItem: ${error}`,
      }
    }
  }

export default getListItem
