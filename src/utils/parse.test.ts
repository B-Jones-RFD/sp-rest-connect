import { describe, it, expect } from 'vitest'
import { safeParseAuthToken } from './parse'

describe('parse utils', () => {
  it('safeParseAuthToken', () => {
    const res = JSON.stringify({
      d: {
        GetContextWebInformation: {
          FormDigestValue: 'testtokenvalue',
        },
      },
    })
    const expected = {
      success: true,
      data: 'testtokenvalue',
    }
    const parsed = safeParseAuthToken(res)

    expect(parsed).toStrictEqual(expected)
  })
})
