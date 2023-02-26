import os from 'os'

const addDocumentToLibrary =
  (
    siteUrl: string,
    protocol: string = 'https',
    domain: string = '',
    hostname: string = os.hostname()
  ) =>
  async (folder: string, fileName: string, payload: Buffer) => {
    const route = `${
      protocol ?? 'https'
    }//${siteUrl}/_api/web/GetFolderByServerRelativeUrl('${folder}')/Files/add(url='${fileName}',overwrite=true)`
    return [] as unknown[]
  }

export default addDocumentToLibrary
