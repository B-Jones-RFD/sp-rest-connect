import { describe, it, expect } from 'vitest'
import { resultSuccess, resultFailure, formatError } from './test-utils'
import {
  safeParseAuthToken,
  safeParseResults,
  safeParseResult,
  safeParseDocument,
  safeParseId,
  safeParseServerUrl,
} from '../src/utils'

describe('safeParseAuthToken', () => {
  const fixture = {
    d: {
      GetContextWebInformation: {
        FormDigestValue: 'testtokenvalue',
      },
    },
  }

  it('should pass with correct data', () => {
    const res = JSON.stringify(fixture)
    const expected = resultSuccess('testtokenvalue')
    const parsed = safeParseAuthToken(res)
    expect(parsed).toStrictEqual(expected)
  })

  it('should fail with invalid response type', () => {
    const res = fixture
    const expected = formatError
    const parsed = safeParseAuthToken(res)
    expect(parsed).toStrictEqual(expected)
  })

  it('should fail when GetContextWebInformation missing', () => {
    const res = JSON.stringify({ d: { someprop: 'value' } })
    const expected = resultFailure('GetContextWebInformation not in response')
    const parsed = safeParseAuthToken(res)
    expect(parsed).toStrictEqual(expected)
  })

  it('should fail when FormDigestValue missing', () => {
    const res = JSON.stringify({
      d: {
        GetContextWebInformation: {
          value: 'value',
        },
      },
    })
    const expected = resultFailure('FormDigestValue not in response')
    const parsed = safeParseAuthToken(res)
    expect(parsed).toStrictEqual(expected)
  })

  it('should fail when token is incorrect type', () => {
    const res = JSON.stringify({
      d: {
        GetContextWebInformation: {
          FormDigestValue: 1,
        },
      },
    })
    const expected = resultFailure('Access token not in response')
    const parsed = safeParseAuthToken(res)
    expect(parsed).toStrictEqual(expected)
  })

  it('should fail with invalid JSON', () => {
    const res = '{d: 1'
    const expected = resultFailure('Unable to parse {d: 1')
    const parsed = safeParseAuthToken(res)
    expect(parsed).toStrictEqual(expected)
  })
})

describe('safeParseResults', () => {
  const fixture = {
    value: ['result 1', 'result 2'],
  }

  it('should pass with correct data', () => {
    const res = JSON.stringify(fixture)
    const expected = resultSuccess(['result 1', 'result 2'])
    const parsed = safeParseResults(res)
    expect(parsed).toStrictEqual(expected)
  })

  it('should fail with invalid response type', () => {
    const res = fixture
    const expected = formatError
    const parsed = safeParseResults(res)
    expect(parsed).toStrictEqual(expected)
  })

  it('should fail value not in response', () => {
    const res = JSON.stringify({ prop: 'value' })
    const expected = resultFailure('Results not in response')
    const parsed = safeParseResults(res)
    expect(parsed).toStrictEqual(expected)
  })

  it('should fail value is not an array', () => {
    const res = JSON.stringify({ value: 'value' })
    const expected = resultFailure('No results returned')
    const parsed = safeParseResults(res)
    expect(parsed).toStrictEqual(expected)
  })

  it('should fail with invalid JSON', () => {
    const res = '{d: 1'
    const expected = resultFailure('Unable to parse {d: 1')
    const parsed = safeParseResults(res)
    expect(parsed).toStrictEqual(expected)
  })
})

describe('safeParseResult', () => {
  const fixture = {
    result: 'pass',
  }

  it('should pass with correct data', () => {
    const res = JSON.stringify(fixture)
    const expected = resultSuccess({
      result: 'pass',
    })
    const parsed = safeParseResult(res)
    expect(parsed).toStrictEqual(expected)
  })

  it('should fail with invalid response type', () => {
    const res = fixture
    const expected = formatError
    const parsed = safeParseResult(res)
    expect(parsed).toStrictEqual(expected)
  })

  it('should fail with invalid JSON', () => {
    const res = '{d: 1'
    const expected = resultFailure('Unable to parse {d: 1')
    const parsed = safeParseResult(res)
    expect(parsed).toStrictEqual(expected)
  })
})

describe('safeParseDocument', () => {
  const fixture = 'file content'

  it('should pass with correct data', () => {
    const res = fixture
    const expected = resultSuccess(fixture)
    const parsed = safeParseDocument(res)
    expect(parsed).toStrictEqual(expected)
  })

  it('should fail with invalid response type', () => {
    const res = { fixture }
    const expected = formatError
    const parsed = safeParseDocument(res)
    expect(parsed).toStrictEqual(expected)
  })
})

describe('safeParseId', () => {
  const fixture = {
    d: {
      ID: 1,
    },
  }

  it('should pass with correct data', () => {
    const res = JSON.stringify(fixture)
    const expected = resultSuccess(1)
    const parsed = safeParseId(res)
    expect(parsed).toStrictEqual(expected)
  })

  it('should fail with invalid response type', () => {
    const res = fixture
    const expected = formatError
    const parsed = safeParseId(res)
    expect(parsed).toStrictEqual(expected)
  })

  it('should fail when ID is not in response', () => {
    const res = JSON.stringify({
      d: {
        prop: 1,
      },
    })
    const expected = resultFailure('ID not in response')
    const parsed = safeParseId(res)
    expect(parsed).toStrictEqual(expected)
  })

  it('should fail with invalid JSON', () => {
    const res = '{d: 1'
    const expected = resultFailure('Unable to parse {d: 1')
    const parsed = safeParseId(res)
    expect(parsed).toStrictEqual(expected)
  })
})

describe('safeParseServerUrl', () => {
  const fixture = {
    d: {
      ServerRelativeUrl: '/path/to/site',
    },
  }

  it('should pass with correct data', () => {
    const res = JSON.stringify(fixture)
    const expected = resultSuccess('/path/to/site')
    const parsed = safeParseServerUrl(res)
    expect(parsed).toStrictEqual(expected)
  })

  it('should fail with invalid response type', () => {
    const res = fixture
    const expected = formatError
    const parsed = safeParseServerUrl(res)
    expect(parsed).toStrictEqual(expected)
  })

  it('should fail when ServerRelativeUrl is missing', () => {
    const res = JSON.stringify({
      d: {
        prop: 'value',
      },
    })
    const expected = resultFailure('ServerRelativeUrl not in response')
    const parsed = safeParseServerUrl(res)
    expect(parsed).toStrictEqual(expected)
  })

  it('should fail when ServerRelativeUrl is not string', () => {
    const res = JSON.stringify({
      d: {
        ServerRelativeUrl: 1,
      },
    })
    const expected = resultFailure('Invalid ServerRelativeUrl type returned')
    const parsed = safeParseServerUrl(res)
    expect(parsed).toStrictEqual(expected)
  })

  it('should fail with invalid JSON', () => {
    const res = '{d: 1'
    const expected = resultFailure('Unable to parse {d: 1')
    const parsed = safeParseServerUrl(res)
    expect(parsed).toStrictEqual(expected)
  })
})
