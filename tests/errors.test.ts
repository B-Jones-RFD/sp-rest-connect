import { describe, it, expect } from 'vitest'
import { SpRestError, parseSharePointError, toFailure } from '../src/errors'
import { TimeoutError } from '../src/ntlm/request'

describe('parseSharePointError', () => {
  it('reads the odata=verbose shape', () => {
    const body = JSON.stringify({
      error: {
        code: '-2130575338, Microsoft.SharePoint.SPException',
        message: { lang: 'en-US', value: 'The file is locked.' },
      },
    })
    expect(parseSharePointError(body)).toStrictEqual({
      code: '-2130575338, Microsoft.SharePoint.SPException',
      message: 'The file is locked.',
    })
  })

  it('reads the odata=nometadata shape', () => {
    const body = JSON.stringify({
      'odata.error': {
        code: '-1, X',
        message: { lang: 'en-US', value: 'Nope' },
      },
    })
    expect(parseSharePointError(body)).toStrictEqual({
      code: '-1, X',
      message: 'Nope',
    })
  })

  it('accepts a plain string message', () => {
    expect(parseSharePointError('{"error":{"message":"flat"}}')).toStrictEqual({
      message: 'flat',
    })
  })

  it('returns undefined for non-error bodies', () => {
    expect(parseSharePointError('')).toBeUndefined()
    expect(parseSharePointError('<html>IIS</html>')).toBeUndefined()
    expect(parseSharePointError('{"value":[]}')).toBeUndefined()
    expect(parseSharePointError('{"error":"string"}')).toBeUndefined()
    expect(parseSharePointError(Buffer.from('x'))).toBeUndefined()
  })
})

describe('SpRestError', () => {
  it('uses the SharePoint message when present, else the raw body', () => {
    const rich = new SpRestError(
      400,
      '{"error":{"message":{"value":"Bad field"}}}'
    )
    expect(rich.message).toBe('Bad field')
    expect(rich.status).toBe(400)
    expect(rich.details).toStrictEqual({ message: 'Bad field' })

    const raw = new SpRestError(502, 'Bad Gateway')
    expect(raw.message).toBe('Bad Gateway')
    expect(raw.details).toBeUndefined()
    expect(raw).toBeInstanceOf(Error)
    expect(raw.name).toBe('SpRestError')
  })
})

describe('toFailure', () => {
  const withCode = (code: string, message = 'boom') =>
    Object.assign(new Error(message), { code })

  it('classifies SpRestError by status', () => {
    expect(toFailure('a', new SpRestError(401, ''))).toMatchObject({
      code: 'AUTH',
      status: 401,
    })
    expect(toFailure('a', new SpRestError(403, ''))).toMatchObject({
      code: 'AUTH',
    })
    expect(toFailure('a', new SpRestError(500, 'x'))).toStrictEqual({
      success: false,
      code: 'HTTP',
      status: 500,
      error: 'Error in a: HTTP 500: x',
    })
  })

  it('classifies timeouts, aborts and network errors', () => {
    expect(toFailure('a', new TimeoutError('slow')).code).toBe('TIMEOUT')
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' })
    expect(toFailure('a', abort).code).toBe('ABORTED')
    expect(toFailure('a', withCode('ABORT_ERR')).code).toBe('ABORTED')
    expect(toFailure('a', withCode('ECONNRESET')).code).toBe('NETWORK')
    expect(toFailure('a', withCode('ENOTFOUND')).code).toBe('NETWORK')
    expect(toFailure('a', withCode('SELF_SIGNED_CERT_IN_CHAIN')).code).toBe(
      'NETWORK'
    )
    expect(toFailure('a', withCode('DEPTH_ZERO_SELF_SIGNED_CERT')).code).toBe(
      'NETWORK'
    )
  })

  it('falls back to UNKNOWN and stringifies non-Error throwables', () => {
    expect(toFailure('a', new Error('eh'))).toStrictEqual({
      success: false,
      code: 'UNKNOWN',
      error: 'Error in a: eh',
    })
    expect(toFailure('a', 'oops')).toStrictEqual({
      success: false,
      code: 'UNKNOWN',
      error: 'Error in a: oops',
    })
  })
})
