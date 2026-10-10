import type { SiteConnectionFactory, SiteConnectionOptions } from './types'
import * as methods from './methods'

/**
 * Checks the shape of connection options and throws a `TypeError` describing
 * the first problem found. Catches the misconfigurations that would otherwise
 * surface later as an opaque 404 or connection error on the first request.
 */
export function validateSiteConnectionOptions(
  options: SiteConnectionOptions
): void {
  const { username, password, site, serverRelativeUrl, protocol } = options
  if (typeof username !== 'string' || username.length === 0)
    throw new TypeError(
      'SiteConnectionOptions.username must be a non-empty string'
    )
  if (typeof password !== 'string')
    throw new TypeError('SiteConnectionOptions.password must be a string')
  if (typeof site !== 'string' || site.length === 0)
    throw new TypeError('SiteConnectionOptions.site must be a non-empty string')
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(site))
    throw new TypeError(
      `SiteConnectionOptions.site must be a host name without a protocol (got '${site}'); set 'protocol' separately`
    )
  if (site.includes('/'))
    throw new TypeError(
      `SiteConnectionOptions.site must be a host name without a path (got '${site}'); put the path in 'serverRelativeUrl'`
    )
  if (typeof serverRelativeUrl !== 'string')
    throw new TypeError(
      'SiteConnectionOptions.serverRelativeUrl must be a string'
    )
  if (serverRelativeUrl.length > 0 && !serverRelativeUrl.startsWith('/'))
    throw new TypeError(
      `SiteConnectionOptions.serverRelativeUrl must start with '/' (got '${serverRelativeUrl}')`
    )
  if (serverRelativeUrl.length > 1 && serverRelativeUrl.endsWith('/'))
    throw new TypeError(
      `SiteConnectionOptions.serverRelativeUrl must not end with '/' (got '${serverRelativeUrl}')`
    )
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(serverRelativeUrl))
    throw new TypeError(
      `SiteConnectionOptions.serverRelativeUrl must be a server-relative path, not a full URL (got '${serverRelativeUrl}')`
    )
  if (protocol !== undefined && protocol !== 'http' && protocol !== 'https')
    throw new TypeError(
      `SiteConnectionOptions.protocol must be 'http' or 'https' (got '${String(protocol)}')`
    )
}

/**
 * Binds every action to one SharePoint site.
 *
 * Credentials are captured in closures and reused for each call; nothing is
 * sent to the server until an action is invoked, so creating a connection
 * never performs network I/O. It does validate the shape of `options` and
 * throws a `TypeError` for an obvious misconfiguration (a protocol inside
 * `site`, a `serverRelativeUrl` without a leading slash, and so on).
 *
 * @param options Site location and NTLM credentials.
 * @returns A {@link SiteConnection} whose methods each resolve to a
 *   {@link Result} and never throw.
 * @throws {TypeError} When `options` are malformed.
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
export const createSiteConnection: SiteConnectionFactory = (options) => {
  validateSiteConnectionOptions(options)
  return {
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
    getAllFolderContents: methods.getAllFolderContents(options),
    iterateFolderContents: methods.iterateFolderContents(options),
    getNextPage: methods.getNextPage(options),
    getListContents: methods.getListContents(options),
    getAllListContents: methods.getAllListContents(options),
    iterateListContents: methods.iterateListContents(options),
    getListItem: methods.getListItem(options),
    getListItemType: methods.getListItemType(options),
    updateListItem: methods.updateListItem(options),
  }
}
