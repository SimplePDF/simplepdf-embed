// Serialises a stream-level error from the provider into a payload the client
// classifier will recognise. /api/chat is the only place that hits this — BYOK
// bypasses the server entirely — so an upstream auth / billing / quota refusal
// here is a "demo key is spent / disabled" signal from the user's
// perspective. Surface it as the demo_rate_limited banner instead of an auth
// error, so the UX reads the same whether we hit the per-share lifetime cap
// or Anthropic revoked our key.
//
// Narrow list of statuses that mean "the shared key can't serve this
// request": 401 auth, 402 payment required, 403 forbidden/quota, 429 rate
// limited. Any other 4xx (400 bad request, 404, 413, 422, ...) falls through
// so the generic panel can show the actual diagnostic instead of a misleading
// "demo is capped" banner. 5xx stays as a server error. Network/unknown
// errors with no status pass through as a bare string.
//
// No user-facing copy here — the client's RateLimitPanel renders the
// localised chat.errorRateLimited* strings on its own once the classifier
// tags this as demo_rate_limited.

const DEMO_KEY_REJECTED_STATUSES: ReadonlySet<number> = new Set([401, 402, 403, 429])

export const getUpstreamStatus = (error: unknown): number | null => {
  if (typeof error !== 'object' || error === null) {
    return null
  }
  if ('statusCode' in error && typeof error.statusCode === 'number') {
    return error.statusCode
  }
  if ('status' in error && typeof error.status === 'number') {
    return error.status
  }
  return null
}

export const serializeStreamError = (error: unknown): string => {
  const status = getUpstreamStatus(error)
  if (status !== null && DEMO_KEY_REJECTED_STATUSES.has(status)) {
    return JSON.stringify({
      error: 'rate_limited',
      reason: 'demo_key_rejected',
    })
  }
  return error instanceof Error ? error.message : String(error)
}
