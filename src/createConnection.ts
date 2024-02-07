import type { SiteConnectionFactory } from './types'
import * as methods from './methods'

export const createSiteConnection: SiteConnectionFactory = (options) => ({
  addAttachmentToListItem: methods.addAttachmentToListItem(options),
  addDocumentToLibrary: methods.addDocumentToLibrary(options),
  addListItem: methods.addListItem(options),
  checkFolderExistsInLibrary: methods.checkFolderExistsInLibrary(options),
  createFolderInLibrary: methods.createFolderInLibrary(options),
  deleteDocumentFromLibrary: methods.deleteDocumentFromLibrary(options),
  deleteListItem: methods.deleteListItem(options),
  getAuthToken: methods.getAuthToken(options),
  getFormDigestValue: methods.getFormDigestValue(options),
  getDocumentFromLibrary: methods.getDocumentFromLibrary(options),
  getFolderContents: methods.getFolderContents(options),
  getListContents: methods.getListContents(options),
  getListItem: methods.getListItem(options),
  getListItemType: methods.getListItemType(options),
  updateListItem: methods.updateListItem(options),
})
