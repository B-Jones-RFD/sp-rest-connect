import type {
  ActionFactory,
  BatchOptions,
  BatchResponse,
  SiteConnection,
  SiteConnectionOptions,
} from '../types'
import os from 'os'
import { request } from '../ntlm/request'
import { encodePath, failure, success } from '../utils'
import { SpRestError, toFailure } from '../errors'
import { createConnectionContext, withDigest } from '../context'
import {
  buildBatchBody,
  newBoundary,
  parseBatchResponse,
  type ResolvedBatchRequest,
} from '../batch'

/**
 * Sends several REST requests as one `/_api/$batch` call (SharePoint 2016+).
 *
 * Factory form of {@link SiteConnection.batch}: call with your
 * {@link SiteConnectionOptions} to get a reusable action. See the
 * `SiteConnection` member for full parameter and return documentation.
 */
export const batch: ActionFactory<BatchOptions, BatchResponse[]> = (
  options,
  context = createConnectionContext(options)
) => {
  const {
    site,
    serverRelativeUrl,
    username,
    password,
    protocol = 'https',
    domain = '',
    agentOptions,
    hostname = os.hostname(),
  } = options
  const origin = `${protocol}://${site}`
  const siteUrl = `${origin}${encodePath(serverRelativeUrl)}`

  return async ({ requestDigest, requests, ...optional }) => {
    if (requests.length === 0) return success([])

    const resolved: ResolvedBatchRequest[] = []
    for (const req of requests) {
      if (/^[a-z][a-z0-9+.-]*:\/\//i.test(req.path)) {
        let target: URL
        try {
          target = new URL(req.path)
        } catch {
          return failure(
            `Error in batch: invalid sub-request URL ${req.path}`,
            'UNKNOWN'
          )
        }
        if (target.origin !== new URL(origin).origin)
          return failure(
            `Error in batch: sub-request must be on ${origin} (got ${req.path})`,
            'UNKNOWN'
          )
        resolved.push({ ...req, url: req.path })
      } else {
        resolved.push({
          ...req,
          url: `${siteUrl}/${req.path.replace(/^\//, '')}`,
        })
      }
    }

    return withDigest(
      'batch',
      context,
      requestDigest,
      optional,
      async (digest) => {
        const boundary = newBoundary('batch')
        const body = buildBatchBody(resolved, boundary)
        try {
          const res = await request('POST', {
            url: `${siteUrl}/_api/$batch`,
            username,
            password,
            workstation: hostname,
            domain,
            agentOptions,
            headers: {
              Accept: 'application/json;odata=nometadata',
              'Content-Type': `multipart/mixed; boundary=${boundary}`,
              'Content-Length': Buffer.byteLength(body),
              'X-RequestDigest': digest,
            },
            body,
            ...optional,
          })
          if (res.statusCode < 200 || res.statusCode > 299)
            throw new SpRestError(res.statusCode, String(res.body), res.headers)

          const responses = parseBatchResponse(
            String(res.body),
            res.headers['content-type']
          )
          if (responses.length !== requests.length)
            return failure(
              `Error in batch: expected ${requests.length} responses, received ${responses.length}`,
              'PARSE'
            )
          return success(responses)
        } catch (error) {
          return toFailure('batch', error)
        }
      }
    )
  }
}
