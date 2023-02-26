import os from 'os'

const getListContents =
  (
    siteUrl: string,
    protocol: string = 'https',
    domain: string = '',
    hostname: string = os.hostname()
  ) =>
  async (accessToken: string, listName: string) => {
    const route = `${
      protocol ?? 'https'
    }//${siteUrl}}/_api/web/lists/GetByTitle('${listName}')/items`

    const headers = {
      Authorization: 'Bearer ' + accessToken,
      Accept: 'application/json;odata=verbose',
    }
    return [] as unknown[]
  }

export default getListContents
