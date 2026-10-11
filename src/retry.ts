import type { Failure, Result, RetryOptions } from './types'

const DEFAULT_RETRIES = 2
const DEFAULT_BASE_DELAY_MS = 200
const DEFAULT_MAX_DELAY_MS = 5000
const RETRYABLE_STATUSES = new Set([429, 502, 503, 504])

/** Default {@link RetryOptions.retryOn}: transient transport and server errors. */
export function isTransientFailure(failure: Failure): boolean {
  switch (failure.code) {
    case 'NETWORK':
    case 'TIMEOUT':
      return true
    case 'HTTP':
      return (
        failure.status !== undefined && RETRYABLE_STATUSES.has(failure.status)
      )
    default:
      return false
  }
}

function delay(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve()
    const timer = setTimeout(done, ms)
    function done() {
      signal?.removeEventListener('abort', done)
      clearTimeout(timer)
      resolve()
    }
    signal?.addEventListener('abort', done, { once: true })
  })
}

/**
 * Runs `attempt` and, when `retry` is configured and the result is a
 * retryable {@link Failure}, runs it again with exponential backoff and full
 * jitter — or after the server's `Retry-After` when it sent one (a wait
 * longer than `maxDelayMs` ends retrying instead). Resolves with the last
 * result; never throws. `ABORTED` failures and an aborted `signal` end
 * retrying immediately.
 */
export async function withRetry<T>(
  retry: RetryOptions | undefined,
  signal: AbortSignal | undefined,
  attempt: () => Promise<Result<T>>
): Promise<Result<T>> {
  if (!retry) return attempt()

  const retries = Math.max(0, retry.retries ?? DEFAULT_RETRIES)
  const base = retry.baseDelayMs ?? DEFAULT_BASE_DELAY_MS
  const max = retry.maxDelayMs ?? DEFAULT_MAX_DELAY_MS
  const shouldRetry = retry.retryOn ?? isTransientFailure

  let result = await attempt()
  for (let n = 1; n <= retries; n++) {
    if (result.success) return result
    if (result.code === 'ABORTED' || signal?.aborted) return result
    if (!shouldRetry(result, n)) return result
    let wait: number
    if (result.retryAfterMs !== undefined) {
      // The server told us how long; obey it, or give up if it's too long.
      if (result.retryAfterMs > max) return result
      wait = result.retryAfterMs
    } else {
      const cap = Math.min(max, base * 2 ** (n - 1))
      wait = Math.random() * cap
    }
    await delay(wait, signal)
    if (signal?.aborted) return result
    result = await attempt()
  }
  return result
}
