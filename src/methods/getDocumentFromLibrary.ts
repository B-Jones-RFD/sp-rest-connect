import type { ConnectionOptions, Result } from '..'
import os from 'os'
import { get } from '../ntlm'
import { safeParseResults } from '../utils/parse'

const getDocumentFromLibrary =
  ({
    siteUrl,
    username,
    password,
    protocol = 'https',
    domain = '',
    hostname = os.hostname(),
  }: ConnectionOptions) =>
  async (folder: string, fileName: string) => {
    const url = `${protocol}//${siteUrl}/_api/web/GetFolderByServerRelativeUrl('${folder}')/Files('${fileName}')/$value`

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
      const res = await get(config)
      // TODO:Remove logging after testing
      console.log('🚀 ~ file: getDocumentFromLibrary.ts:31 ~ res:', res)
    } catch (error) {
      throw new Error(`Error in getDocumentFromLibrary: ${error}`)
    }
  }

export default getDocumentFromLibrary
