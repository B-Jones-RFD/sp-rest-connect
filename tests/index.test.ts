import { describe, it, expect } from 'vitest'
import * as pkg from '../src'

describe('public API', () => {
  it('exports the connection factory and helpers, not the NTLM transport', () => {
    expect(typeof pkg.createSiteConnection).toBe('function')
    expect(typeof pkg.createConnectionContext).toBe('function')
    expect(typeof pkg.validateSiteConnectionOptions).toBe('function')
    expect(typeof pkg.SpRestError).toBe('function')
    expect(typeof pkg.parseSharePointError).toBe('function')
    expect(typeof pkg.isTransientFailure).toBe('function')
    const internal = pkg as Record<string, unknown>
    for (const name of ['get', 'post', 'auth', 'request', 'createType1Message'])
      expect(internal[name]).toBeUndefined()
  })

  it('exports every standalone method factory', () => {
    const factories = [
      'addAttachmentToListItem',
      'addDocumentToLibrary',
      'addListItem',
      'batch',
      'checkFolderExistsInLibrary',
      'createFolderInLibrary',
      'deleteDocumentFromLibrary',
      'deleteListItem',
      'getAuthToken',
      'getDocumentFromLibrary',
      'getAllFolderContents',
      'getAllListContents',
      'getFolderContents',
      'getFormDigestValue',
      'getListContents',
      'getNextPage',
      'iterateFolderContents',
      'iterateListContents',
      'queryListItems',
      'getListItem',
      'getListItemType',
      'updateListItem',
    ] as const
    for (const name of factories) expect(typeof pkg[name]).toBe('function')
  })
})
