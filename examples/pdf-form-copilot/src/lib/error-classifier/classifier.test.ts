import { describe, expect, it } from 'vitest'
import {
  classifyError,
  formatStreamError,
  getErrorDisplayMessage,
  getErrorStatusCode,
  parseStreamErrorMessage,
} from './classifier'

// Real-world APICallError payload emitted by `@ai-sdk/anthropic` when
// Anthropic returns a 401 `authentication_error` during BYOK streaming.
// Captured verbatim from the BYOK transport's onError log so the test
// tracks the actual shape the runtime produces.
const ANTHROPIC_401_PAYLOAD = {
  name: 'AI_APICallError',
  url: 'https://api.anthropic.com/v1/messages',
  requestBodyValues: {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    stream: true,
    tool_choice: { type: 'auto' },
  },
  statusCode: 401,
  responseHeaders: {
    'access-control-allow-origin': '*',
    'cf-ray': '9f0c8fce1a08fb9d-AMS',
    'content-length': '130',
    'content-type': 'application/json',
    date: 'Thu, 23 Apr 2026 11:34:54 GMT',
    server: 'cloudflare',
    'x-envoy-upstream-service-time': '25',
    'x-should-retry': 'false',
  },
  responseBody:
    '{"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"},"request_id":"req_011CaLdeBZ4x5jBKYgHHDjYD"}',
  isRetryable: false,
  data: {
    type: 'error',
    error: { type: 'authentication_error', message: 'invalid x-api-key' },
  },
}

const buildAnthropic401Error = (): Error => {
  const error = new Error('invalid x-api-key')
  Object.assign(error, ANTHROPIC_401_PAYLOAD)
  return error
}

describe(formatStreamError.name, () => {
  it('wraps the Anthropic 401 APICallError into a JSON envelope with statusCode', () => {
    const serialized = formatStreamError(buildAnthropic401Error())
    const parsed = JSON.parse(serialized)
    expect(parsed).toEqual({ statusCode: 401, message: 'invalid x-api-key' })
  })

  it('wraps a 500 error exposed via `status` (not `statusCode`)', () => {
    const error = Object.assign(new Error('upstream exploded'), { status: 500 })
    expect(JSON.parse(formatStreamError(error))).toEqual({
      statusCode: 500,
      message: 'upstream exploded',
    })
  })

  it('walks into `cause` when the status is nested', () => {
    const inner = Object.assign(new Error('forbidden'), { statusCode: 403 })
    const outer = new Error('request failed')
    Object.assign(outer, { cause: inner })
    expect(JSON.parse(formatStreamError(outer))).toEqual({
      statusCode: 403,
      message: 'request failed',
    })
  })

  it('returns the bare message when no status can be recovered', () => {
    expect(formatStreamError(new Error('something else'))).toBe('something else')
  })

  it('stringifies non-Error values', () => {
    expect(formatStreamError('boom')).toBe('boom')
  })
})

describe(parseStreamErrorMessage.name, () => {
  it('parses a valid envelope', () => {
    expect(parseStreamErrorMessage('{"statusCode":401,"message":"invalid x-api-key"}')).toEqual({
      statusCode: 401,
      message: 'invalid x-api-key',
    })
  })

  it('returns null for non-JSON', () => {
    expect(parseStreamErrorMessage('boom')).toBeNull()
  })

  it('returns null when statusCode is not a number', () => {
    expect(parseStreamErrorMessage('{"statusCode":"401","message":"x"}')).toBeNull()
  })

  it('returns null when message is missing', () => {
    expect(parseStreamErrorMessage('{"statusCode":401}')).toBeNull()
  })

  it('returns null for JSON that is not an object', () => {
    expect(parseStreamErrorMessage('["statusCode",401]')).toBeNull()
    expect(parseStreamErrorMessage('42')).toBeNull()
    expect(parseStreamErrorMessage('null')).toBeNull()
  })
})

describe(getErrorStatusCode.name, () => {
  it('reads statusCode directly from the AI SDK APICallError', () => {
    expect(getErrorStatusCode(buildAnthropic401Error())).toBe(401)
  })

  it('reads statusCode from the JSON envelope we injected server-side', () => {
    const error = new Error(JSON.stringify({ statusCode: 401, message: 'invalid x-api-key' }))
    expect(getErrorStatusCode(error)).toBe(401)
  })

  it('returns null when the error has neither a property nor a valid envelope', () => {
    expect(getErrorStatusCode(new Error('plain text error'))).toBeNull()
  })

  it('returns the direct property when both direct and envelope would resolve', () => {
    const error = new Error(JSON.stringify({ statusCode: 500, message: 'ignored' }))
    Object.assign(error, { statusCode: 401 })
    expect(getErrorStatusCode(error)).toBe(401)
  })
})

describe(getErrorDisplayMessage.name, () => {
  it('unwraps the human-readable message from the envelope', () => {
    const error = new Error(JSON.stringify({ statusCode: 401, message: 'invalid x-api-key' }))
    expect(getErrorDisplayMessage(error)).toBe('invalid x-api-key')
  })

  it('falls back to the raw error message when it is not an envelope', () => {
    expect(getErrorDisplayMessage(new Error('boom'))).toBe('boom')
  })

  it('preserves the original message when the error exposes statusCode directly but the message is plain text', () => {
    expect(getErrorDisplayMessage(buildAnthropic401Error())).toBe('invalid x-api-key')
  })
})

describe(classifyError.name, () => {
  it('classifies the real Anthropic 401 payload as "authentication"', () => {
    expect(classifyError(buildAnthropic401Error())).toBe('authentication')
  })

  it('classifies a 401 envelope as "authentication"', () => {
    const error = new Error(JSON.stringify({ statusCode: 401, message: 'invalid x-api-key' }))
    expect(classifyError(error)).toBe('authentication')
  })

  it('classifies any 5xx status as "server"', () => {
    for (const status of [500, 502, 503, 504, 599]) {
      const error = Object.assign(new Error('upstream exploded'), { statusCode: status })
      expect(classifyError(error)).toBe('server')
    }
  })

  it('classifies an envelope-wrapped 500 as "server"', () => {
    const error = new Error(JSON.stringify({ statusCode: 500, message: 'upstream exploded' }))
    expect(classifyError(error)).toBe('server')
  })

  it('classifies a 429 status as "demo_rate_limited"', () => {
    const error = Object.assign(new Error('rate limited'), { statusCode: 429 })
    expect(classifyError(error)).toBe('demo_rate_limited')
  })

  it('classifies a { error: "rate_limited" } body (no statusCode) as "demo_rate_limited"', () => {
    const error = new Error(
      JSON.stringify({ error: 'rate_limited', reason: 'lifetime', message: 'Thanks for trying the demo!' }),
    )
    expect(classifyError(error)).toBe('demo_rate_limited')
  })

  it('classifies a { error: "share_required" } body as "authentication"', () => {
    const error = new Error(JSON.stringify({ error: 'share_required', message: 'Invite link required' }))
    expect(classifyError(error)).toBe('authentication')
  })

  it('returns null for statuses we do not handle explicitly', () => {
    for (const status of [400, 403, 404]) {
      const error = Object.assign(new Error('x'), { statusCode: status })
      expect(classifyError(error)).toBeNull()
    }
  })

  it('returns null when no status can be recovered', () => {
    expect(classifyError(new Error('mysterious failure'))).toBeNull()
  })
})
