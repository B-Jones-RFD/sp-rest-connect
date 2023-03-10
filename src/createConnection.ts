import type { SiteConnection } from './types'
import * as methods from './methods'

export const createSiteConnection: SiteConnection = (options) => ({
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
  getListItemType: methods.getListItemType(options),
  updateListItem: methods.updateListItem(options),
})
