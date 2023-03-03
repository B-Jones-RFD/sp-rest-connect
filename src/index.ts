import { methods } from './methods'

export type ConnectionOptions = {
  username: string
  password: string
  site: string
  serverRelativeUrl: string
  protocol?: 'https' | 'http'
  domain?: string | ''
  hostname?: string
}

export type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string }

export const createSiteConnection = (options: ConnectionOptions) => ({
  addAttachmentToListItem: methods.addAttachmentToListItem(options),
  addDocumentToLibrary: methods.addDocumentToLibrary(options),
  addListItem: methods.addListItem(options),
  deleteDocumentFromLibrary: methods.deleteDocumentFromLibrary(options),
  deleteListItem: methods.deleteListItem(options),
  getAuthToken: methods.getAuthToken(options),
  getDocumentFromLibrary: methods.getDocumentFromLibrary(options),
  getFolderContents: methods.getFolderContents(options),
  getListContents: methods.getListContents(options),
  getListItem: methods.getListItem(options),
  updateListItem: methods.updateListItem(options),
})

export default createSiteConnection
