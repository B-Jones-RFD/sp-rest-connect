import os from 'os'

const getDocumentFromLibrary =
  (
    siteUrl: string,
    protocol: string = 'https',
    domain: string = '',
    hostname: string = os.hostname()
  ) =>
  async (folder: string, fileName: string) => {
    const route = `${
      protocol ?? 'https'
    }//${siteUrl}/_api/web/GetFolderByServerRelativeUrl('${folder}')/Files('${fileName}')/$value`
    return [] as unknown[]
  }

export default getDocumentFromLibrary
