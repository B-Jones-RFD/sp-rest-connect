import os from 'os'

const addAttachmentToListItem =
  (
    siteUrl: string,
    protocol: string = 'https',
    domain: string = '',
    hostname: string = os.hostname()
  ) =>
  async (listName: string, spId: number, fileName: string, payload: Buffer) => {
    const route = `${
      protocol ?? 'https'
    }//${siteUrl}/_api/web/lists/GetByTitle('${listName}')/items('${spId}')/AttachmentFiles/add(FileName='${fileName}')`
    return [] as unknown[]
  }

export default addAttachmentToListItem
