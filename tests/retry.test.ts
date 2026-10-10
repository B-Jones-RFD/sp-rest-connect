import { describe, it, expect, vi } from 'vitest'
import { withRetry, isTransientFailure } from '../src/retry'
import { failure, success } from '../src/utils'
import type { Failure, Result } from '../src/types'

const f = (code: Failure['code'], status?: number): Failure => ({
  ...failure('x', code),
  ...(status === undefined ? {} : { status }),
})

/** Returns the queued results in order; repeats the last one. */
function script<T>(...results: Result<T>[]) {
  const calls: number[] = []
  let i = 0
  const attempt = async () => {
    calls.push(i)
    const r = results[Math.min(i, results.length - 1)]
    i++
    return r
  }
  return { attempt, calls }
}

describe('isTransientFailure', () => {
  it('matches network, timeout and 429/502/503/504', () => {
    expect(isTransientFailure(f('NETWORK'))).toBe(true)
    expect(isTransientFailure(f('TIMEOUT'))).toBe(true)
    for (const s of [429, 502, 503, 504])
      expect(isTransientFailure(f('HTTP', s))).toBe(true)
    expect(isTransientFailure(f('HTTP', 500))).toBe(false)
    expect(isTransientFailure(f('HTTP', 404))).toBe(false)
    expect(isTransientFailure(f('AUTH', 401))).toBe(false)
    expect(isTransientFailure(f('PARSE'))).toBe(false)
    expect(isTransientFailure(f('ABORTED'))).toBe(false)
  })
})

describe('withRetry', () => {
  it('passes through when retry is undefined', async () => {
    const s = script(f('NETWORK'), success(1))
    expect(await withRetry(undefined, undefined, s.attempt)).toEqual(
      f('NETWORK')
    )
    expect(s.calls).toHaveLength(1)
  })

  it('retries up to `retries` times with default predicate', async () => {
    const s = script(f('NETWORK'), f('HTTP', 503), success(1))
    expect(await withRetry({ baseDelayMs: 0 }, undefined, s.attempt)).toEqual(
      success(1)
    )
    expect(s.calls).toHaveLength(3)
  })

  it('returns the last failure once exhausted', async () => {
    const s = script(f('NETWORK'))
    expect(
      await withRetry({ retries: 3, baseDelayMs: 0 }, undefined, s.attempt)
    ).toEqual(f('NETWORK'))
    expect(s.calls).toHaveLength(4)
  })

  it('treats retries: 0 as a single attempt', async () => {
    const s = script(f('NETWORK'), success(1))
    await withRetry({ retries: 0 }, undefined, s.attempt)
    expect(s.calls).toHaveLength(1)
  })

  it('never retries ABORTED and stops when the signal aborts', async () => {
    const s = script(f('ABORTED'), success(1))
    await withRetry({ baseDelayMs: 0 }, undefined, s.attempt)
    expect(s.calls).toHaveLength(1)

    const controller = new AbortController()
    const t = script(f('NETWORK'), success(1))
    controller.abort()
    expect(
      await withRetry({ baseDelayMs: 0 }, controller.signal, t.attempt)
    ).toEqual(f('NETWORK'))
    expect(t.calls).toHaveLength(1)
  })

  it('applies capped exponential backoff with full jitter', async () => {
    vi.useFakeTimers()
    const spy = vi.spyOn(Math, 'random').mockReturnValue(1)
    try {
      const s = script(f('NETWORK'), f('NETWORK'), f('NETWORK'), success(1))
      const pending = withRetry(
        { retries: 3, baseDelayMs: 100, maxDelayMs: 250 },
        undefined,
        s.attempt
      )
      // delays: min(250,100)=100, min(250,200)=200, min(250,400)=250
      await vi.advanceTimersByTimeAsync(99)
      expect(s.calls).toHaveLength(1)
      await vi.advanceTimersByTimeAsync(1)
      expect(s.calls).toHaveLength(2)
      await vi.advanceTimersByTimeAsync(200)
      expect(s.calls).toHaveLength(3)
      await vi.advanceTimersByTimeAsync(250)
      expect(s.calls).toHaveLength(4)
      expect(await pending).toEqual(success(1))
    } finally {
      spy.mockRestore()
      vi.useRealTimers()
    }
  })

  it('consults retryOn with a 1-based attempt number', async () => {
    const seen: number[] = []
    const s = script(f('HTTP', 500))
    await withRetry(
      {
        retries: 2,
        baseDelayMs: 0,
        retryOn: (_f, n) => {
          seen.push(n)
          return true
        },
      },
      undefined,
      s.attempt
    )
    expect(seen).toEqual([1, 2])
    expect(s.calls).toHaveLength(3)
  })
})
