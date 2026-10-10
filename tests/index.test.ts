import { describe, it, expect } from 'vitest'
import * as pkg from '../src'

describe('public API', () => {
  it('exports the connection factory and the NTLM transport', () => {
    expect(typeof pkg.createSiteConnection).toBe('function')
    expect(typeof pkg.get).toBe('function')
    expect(typeof pkg.post).toBe('function')
    expect(typeof pkg.auth).toBe('function')
  })

  it('exports every standalone method factory', () => {
    const factories = [
      'addAttachmentToListItem',
      'addDocumentToLibrary',
      'addListItem',
      'checkFolderExistsInLibrary',
      'createFolderInLibrary',
      'deleteDocumentFromLibrary',
      'deleteListItem',
      'getAuthToken',
      'getDocumentFromLibrary',
      'getFolderContents',
      'getFormDigestValue',
      'getListContents',
      'getListItem',
      'getListItemType',
      'updateListItem',
    ] as const
    for (const name of factories) expect(typeof pkg[name]).toBe('function')
  })
})
