import type { SiteConnectionFactory } from './types'
import * as methods from './methods'

/**
 * Binds every action to one SharePoint site.
 *
 * Credentials are captured in closures and reused for each call; nothing is
 * sent to the server until an action is invoked, so creating a connection
 * never fails and never performs network I/O.
 *
 * @param options Site location and NTLM credentials.
 * @returns A {@link SiteConnection} whose methods each resolve to a
 *   {@link Result} and never throw.
 * @example
 * import { createSiteConnection } from '@b-jones-rfd/sp-rest-connect'
 *
 * const connection = createSiteConnection({
 *   username: 'jsmith',
 *   password: process.env.SP_PASSWORD!,
 *   domain: 'CONTOSO',
 *   site: 'sharepoint.contoso.local',
 *   serverRelativeUrl: '/sites/finance',
 * })
 *
 * const res = await connection.getListContents({ listName: 'Invoices' })
 * if (res.success) console.log(res.data)
 */
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
