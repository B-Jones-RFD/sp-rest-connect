import os from 'os'

const getFolderContents =
  (
    siteUrl: string,
    protocol: string = 'https',
    domain: string = '',
    hostname: string = os.hostname()
  ) =>
  async (folder: string) => {
    const route = `${
      protocol ?? 'https'
    }//${siteUrl}/_api/web/GetFolderByServerRelativeUrl('${folder}')/Files`
    return [] as unknown[]
  }

export default getFolderContents
