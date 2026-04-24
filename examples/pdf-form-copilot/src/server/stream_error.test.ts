import { describe, expect, it } from 'vitest'
import { getUpstreamStatus, serializeStreamError } from './stream_error'

// Real shapes captured from `@ai-sdk/anthropic` and `@ai-sdk/deepseek`
// `APICallError` instances so the tests track what the runtime actually
// feeds into toUIMessageStreamResponse({ onError }).
const buildApiCallError = ({
  statusCode,
  message,
  useStatus,
}: {
  statusCode: number
  message: string
  useStatus?: boolean
}): Error => {
  const err = new Error(message)
  // AI SDK errors expose statusCode by default; some providers ship with a
  // status property instead. Cover both.
  Object.assign(err, useStatus === true ? { status: statusCode } : { statusCode })
  return err
}

describe(getUpstreamStatus.name, () => {
  it('reads statusCode from the AI SDK APICallError shape', () => {
    expect(getUpstreamStatus(buildApiCallError({ statusCode: 401, message: 'x' }))).toBe(401)
  })

  it('falls back to status when statusCode is absent', () => {
    expect(getUpstreamStatus(buildApiCallError({ statusCode: 500, message: 'x', useStatus: true }))).toBe(500)
  })

  it('returns null when neither field is present', () => {
    expect(getUpstreamStatus(new Error('plain'))).toBeNull()
  })

  it('returns null for non-object inputs', () => {
    expect(getUpstreamStatus('boom')).toBeNull()
    expect(getUpstreamStatus(null)).toBeNull()
    expect(getUpstreamStatus(undefined)).toBeNull()
    expect(getUpstreamStatus(42)).toBeNull()
  })

  it('returns null when statusCode is not a number', () => {
    const err = Object.assign(new Error('x'), { statusCode: '401' })
    expect(getUpstreamStatus(err)).toBeNull()
  })
})

describe(serializeStreamError.name, () => {
  // The four statuses that unambiguously mean "the shared demo key can't
  // serve this request". Each one should translate into the rate-limited
  // envelope so the client classifier fires the amber RateLimitPanel /
  // BYOK-activated swap flow instead of the auth-failed banner that would
  // tell the user to "verify your API key" (they never typed one).
  it.each([401, 402, 403, 429])('rewrites upstream %s as the demo_key_rejected envelope', (status) => {
    const serialized = serializeStreamError(
      buildApiCallError({ statusCode: status, message: 'upstream said no' }),
    )
    expect(JSON.parse(serialized)).toEqual({
      error: 'rate_limited',
      reason: 'demo_key_rejected',
    })
  })

  // Other 4xx codes are real client errors (malformed prompt, unsupported
  // media type, payload too large, etc.) that the user's BYOK key could hit
  // too — they deserve the actual diagnostic, not a misleading "demo is
  // capped" banner. Guard the narrow allow-list.
  it.each([400, 404, 408, 413, 422, 451])('passes upstream %s through unchanged', (status) => {
    const err = buildApiCallError({ statusCode: status, message: 'client error' })
    expect(serializeStreamError(err)).toBe('client error')
  })

  // 5xx = infrastructure failure; the ServerPanel shows the raw text.
  it.each([500, 502, 503, 504])('passes upstream %s through unchanged', (status) => {
    const err = buildApiCallError({ statusCode: status, message: 'upstream exploded' })
    expect(serializeStreamError(err)).toBe('upstream exploded')
  })

  it('passes plain Error messages through when no status is recoverable', () => {
    expect(serializeStreamError(new Error('network glitch'))).toBe('network glitch')
  })

  it('stringifies non-Error values', () => {
    expect(serializeStreamError('boom')).toBe('boom')
    expect(serializeStreamError(42)).toBe('42')
    expect(serializeStreamError(null)).toBe('null')
  })

  it('also matches the status field form (not just statusCode)', () => {
    const serialized = serializeStreamError(
      buildApiCallError({ statusCode: 401, message: 'x', useStatus: true }),
    )
    expect(JSON.parse(serialized)).toEqual({
      error: 'rate_limited',
      reason: 'demo_key_rejected',
    })
  })
})
