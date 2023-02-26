import { methods } from './methods'

export type ConnectionOptions = {
  username: string
  password: string
  siteUrl: string
  protocol?: 'https' | 'http'
  domain?: string | ''
  hostname?: string
}

export const createSiteConnection = (options: ConnectionOptions) => {
  const { username, password, siteUrl, protocol, domain, hostname } = options
  return {
    addAttachmentToListItem: methods.addAttachmentToListItem(
      siteUrl,
      protocol,
      domain,
      hostname
    ),
    addDocumentToLibrary: methods.addDocumentToLibrary(
      siteUrl,
      protocol,
      domain,
      hostname
    ),
    addListItem: methods.addListItem(siteUrl, protocol, domain, hostname),
    getAuthToken: methods.getAuthToken(
      username,
      password,
      siteUrl,
      protocol,
      domain,
      hostname
    ),
    getDocumentFromLibrary: methods.getDocumentFromLibrary(
      siteUrl,
      protocol,
      domain,
      hostname
    ),
    getFolderContents: methods.getFolderContents(
      siteUrl,
      protocol,
      domain,
      hostname
    ),
    getListContents: methods.getListContents(
      siteUrl,
      protocol,
      domain,
      hostname
    ),
    getListItem: methods.getListItem(siteUrl, protocol, domain, hostname),
    updateListItem: methods.updateListItem(siteUrl, protocol, domain, hostname),
  }
}

export default createSiteConnection
