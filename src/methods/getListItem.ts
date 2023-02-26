import os from 'os'

const getListItem =
  (
    siteUrl: string,
    protocol: string = 'https',
    domain: string = '',
    hostname: string = os.hostname()
  ) =>
  async (accessToken: string, listName: string, spId: number) => {
    const route = `${
      protocol ?? 'https'
    }//${siteUrl}/_api/web/lists/GetByTitle('${listName}')/items('${spId}')`
    return [] as unknown[]
  }

export default getListItem
