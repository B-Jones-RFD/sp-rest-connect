import type { Failure, FailureCode, SharePointError } from './types'

/**
 * Thrown by the internal transport when SharePoint answers with a non-2xx
 * status. Actions convert it into a {@link Failure}; it is exported so the
 * `details` shape can be reused, not because user code should catch it.
 */
export class SpRestError extends Error {
  readonly name = 'SpRestError'
  readonly status: number
  readonly body: string
  readonly details: SharePointError | undefined

  constructor(status: number, body: string) {
    const details = parseSharePointError(body)
    super(details?.message ?? body)
    this.status = status
    this.body = body
    this.details = details
  }
}

/**
 * Extracts SharePoint's error object from a response body. Handles both the
 * `odata=verbose` shape (`{ error: { code, message: { value } } }`) and the
 * `odata=nometadata` / `minimalmetadata` shape (`{ 'odata.error': ... }`).
 * Returns `undefined` for anything else.
 */
export function parseSharePointError(
  body: unknown
): SharePointError | undefined {
  if (typeof body !== 'string' || body.length === 0) return undefined
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return undefined
  }
  if (typeof parsed !== 'object' || parsed === null) return undefined
  const record = parsed as Record<string, unknown>
  const err = (record['odata.error'] ?? record.error) as
    Record<string, unknown> | undefined
  if (typeof err !== 'object' || err === null) return undefined

  const details: SharePointError = {}
  if (typeof err.code === 'string') details.code = err.code
  const message = err.message
  if (typeof message === 'string') details.message = message
  else if (
    typeof message === 'object' &&
    message !== null &&
    typeof (message as Record<string, unknown>).value === 'string'
  ) {
    details.message = (message as Record<string, string>).value
  }
  return details
}

const NETWORK_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EPIPE',
  'ERR_TLS_CERT_ALTNAME_INVALID',
])

function classify(error: unknown): FailureCode {
  if (error instanceof SpRestError) {
    return error.status === 401 || error.status === 403 ? 'AUTH' : 'HTTP'
  }
  if (typeof error !== 'object' || error === null) return 'UNKNOWN'
  const { name, code } = error as { name?: unknown; code?: unknown }
  if (name === 'AbortError' || code === 'ABORT_ERR') return 'ABORTED'
  if (code === 'ETIMEDOUT' || name === 'TimeoutError') return 'TIMEOUT'
  if (typeof code === 'string') {
    if (NETWORK_CODES.has(code)) return 'NETWORK'
    // OpenSSL / TLS failures surface as string codes from node:tls.
    if (
      /^(ERR_TLS_|ERR_SSL_|UNABLE_TO_|SELF_SIGNED|CERT_|DEPTH_ZERO)/.test(code)
    )
      return 'NETWORK'
  }
  return 'UNKNOWN'
}

function describe(error: unknown): string {
  if (error instanceof SpRestError) {
    return error.details?.message
      ? `HTTP ${error.status}: ${error.details.message}`
      : `HTTP ${error.status}: ${error.body}`
  }
  if (error instanceof Error) return error.message
  return String(error)
}

/**
 * Converts anything thrown inside an action into a {@link Failure}, prefixed
 * with the action name and classified by {@link FailureCode}.
 */
export function toFailure(action: string, error: unknown): Failure {
  const failure: Failure = {
    success: false,
    error: `Error in ${action}: ${describe(error)}`,
    code: classify(error),
  }
  if (error instanceof SpRestError) {
    failure.status = error.status
    if (error.details) failure.details = error.details
  }
  return failure
}
