import os from 'os'

const updateListItem =
  (
    siteUrl: string,
    protocol: string = 'https',
    domain: string = '',
    hostname: string = os.hostname()
  ) =>
  async (
    accessToken: string,
    listName: string,
    spId: number,
    patch: string
  ) => {
    const route = `${
      protocol ?? 'https'
    }//${siteUrl}/_api/web/lists/GetByTitle('${listName}')/items('${spId}')`

    const headers = {
      Authorization: 'Bearer ' + accessToken,
      Accept: 'application/json;odata=verbose',
      'Content-Type': 'application/json',
      'Content-Length': patch.length,
      'If-Match': '*',
      'X-HTTP-Method': 'MERGE',
      'X-RequestDigest': accessToken,
    }
    return [] as unknown[]
  }

export default updateListItem
