// Error classification for the chat-level error banner. Works off HTTP status
// codes (recovered from the error object or from a JSON envelope we inject on
// the server side when the SDK rebuilds stream errors without a status code).

export type KnownErrorKind = 'authentication' | 'server' | 'demo_rate_limited'

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
    }
    return null
  } catch {
    return null
  }
}

export const getErrorStatusCode = (error: Error): number | null => {
  const direct = getDirectStatusCode(error)
  if (direct !== null) {
    return direct
  }
  const envelope = parseStreamErrorMessage(error.message)
  return envelope?.statusCode ?? null
}

export const getErrorDisplayMessage = (error: Error): string => {
  const envelope = parseStreamErrorMessage(error.message)
  return envelope?.message ?? error.message
}

export const classifyError = (error: Error): KnownErrorKind | null => {
  const status = getErrorStatusCode(error)
  if (status === 401) {
    return 'authentication'
  }
  if (status === 429) {
    return 'demo_rate_limited'
  }
  if (status !== null && status >= 500 && status < 600) {
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
