// Error classification for the chat-level error banner. Works off HTTP status
// codes (recovered from the error object or from a JSON envelope we inject on
// the server side when the SDK rebuilds stream errors without a status code).

export type KnownErrorKind = 'authentication' | 'server' | 'demo_rate_limited' | 'service_unavailable'

// Detects upstream / infra error pages (DO App Platform 503, generic load
// balancer HTML, etc.) where `error.message` is the raw HTML response body.
// These payloads have no useful content for the user and must NEVER be
// rendered as-is — show a clean "service unavailable" panel instead.
export const isUpstreamHtmlError = (message: string): boolean => {
  const trimmed = message.trim().toLowerCase()
  if (trimmed.startsWith('<!doctype html') || trimmed.startsWith('<html')) {
    return true
  }
  // DO App Platform's "failed to forward" 503 page — the canonical case
  // when the App container is unreachable (Valkey timeout cascade,
  // health-check failure, deploy in progress, etc.).
  return trimmed.includes('via_upstream') || trimmed.includes('app platform failed to forward')
}

export type StreamErrorEnvelope = { statusCode: number; message: string }

const getDirectStatusCode = (value: unknown): number | null => {
  if (typeof value !== 'object' || value === null) {
    return null
  }
  if ('statusCode' in value && typeof value.statusCode === 'number') {
    return value.statusCode
  }
  if ('status' in value && typeof value.status === 'number') {
    return value.status
  }
  if ('cause' in value) {
    return getDirectStatusCode(value.cause)
  }
  return null
}

export const parseStreamErrorMessage = (message: string): StreamErrorEnvelope | null => {
  try {
    const parsed: unknown = JSON.parse(message)
    if (typeof parsed !== 'object' || parsed === null) {
      return null
    }
    if (
      'statusCode' in parsed &&
      typeof parsed.statusCode === 'number' &&
      'message' in parsed &&
      typeof parsed.message === 'string'
    ) {
      return { statusCode: parsed.statusCode, message: parsed.message }
    }
    // /api/chat 4xx bodies use { error, message } with the status on the HTTP
    // response itself; the AI SDK sometimes serializes only the body into the
    // thrown Error. Recognise the known error tokens so classifyError can pick
    // up the right kind even when statusCode is missing from the envelope.
    if ('error' in parsed && typeof parsed.error === 'string') {
      const messageField = 'message' in parsed && typeof parsed.message === 'string' ? parsed.message : ''
      if (parsed.error === 'rate_limited') {
        return { statusCode: 429, message: messageField }
      }
      if (parsed.error === 'share_required') {
        return { statusCode: 401, message: messageField }
      }
      if (parsed.error === 'misconfigured_environment') {
        return { statusCode: 500, message: messageField }
      }
    }
    return null
  } catch {
    return null
  }
}

export const getErrorDisplayMessage = (error: Error): string => {
  const envelope = parseStreamErrorMessage(error.message)
  return envelope?.message ?? error.message
}

export const classifyError = (error: Error): KnownErrorKind | null => {
  // Upstream HTML check first — these are infra errors where the App
  // container itself is unreachable, so neither the JSON envelope nor the
  // direct status path applies. Routing to `service_unavailable` keeps the
  // raw HTML out of the UI entirely.
  if (isUpstreamHtmlError(error.message)) {
    return 'service_unavailable'
  }
  // Envelope first. An envelope-shaped message means the error went through
  // /api/chat — the server-paid demo path. BYOK never reaches that endpoint,
  // so envelope-sourced 429 / auth failures are unambiguously demo-side and
  // earn the amber "Thanks for trying the demo!" panel.
  const envelope = parseStreamErrorMessage(error.message)
  if (envelope !== null) {
    if (envelope.statusCode === 429) {
      return 'demo_rate_limited'
    }
    if (envelope.statusCode === 401) {
      return 'authentication'
    }
    if (envelope.statusCode >= 500 && envelope.statusCode < 600) {
      return 'server'
    }
    return null
  }
  // Fall-through: the status came directly off an AI SDK APICallError.
  // That's the BYOK path (stream runs browser-to-provider). 401 = user's
  // own key was rejected -> auth panel. 5xx = infra. A raw 429 here means
  // the user's own provider is throttling their key, not that the demo is
  // capped -- let it drop to the generic panel so the raw provider message
  // is shown. We never blame the demo for a BYOK user's rate limit.
  const status = getDirectStatusCode(error)
  if (status === null) {
    return null
  }
  if (status === 401) {
    return 'authentication'
  }
  if (status >= 500 && status < 600) {
    return 'server'
  }
  return null
}

// Called server-side by the BYOK transport to serialize a stream-level error
// with its upstream HTTP status so the client can still recover the status
// after the AI SDK rebuilds the error as a plain Error.
export const formatStreamError = (error: unknown): string => {
  const status = getDirectStatusCode(error)
  const message = error instanceof Error ? error.message : String(error)
  if (status !== null) {
    return JSON.stringify({ statusCode: status, message })
  }
  return message
}
