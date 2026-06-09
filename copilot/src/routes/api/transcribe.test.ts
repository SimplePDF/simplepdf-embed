import {
  APICallError,
  type Experimental_TranscriptionResult,
  experimental_transcribe,
  NoTranscriptGeneratedError,
} from 'ai'
import { afterEach, beforeAll, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest'
import { markMisbehavior } from '../../server/demo/misbehavior'
import * as httpModule from '../../server/http'
import { hashIp, rateLimiter } from '../../server/rate_limit'
import { transcribePostHandler } from './transcribe'

// Only the paid network call is faked; every gate (preflight, key, limiter,
// body parsing, container allowlist) runs for real so the security matrix
// exercises the true route order.
vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>()
  return { ...actual, experimental_transcribe: vi.fn() }
})

const VALID_SHARE = 'validshare'
// EBML/WebM magic + padding — passes the container allowlist.
const VALID_WEBM = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x02, 0x03, 0x04])

const fakeTranscription = (over: { text: string; language?: string }): Experimental_TranscriptionResult => ({
  text: over.text,
  segments: [],
  language: over.language,
  durationInSeconds: undefined,
  warnings: [],
  responses: [],
  providerMetadata: {},
})

const makeRequest = (opts: {
  ip: string
  share?: string | null
  browser?: boolean
  body?: BodyInit | null
  signal?: AbortSignal
}): Request => {
  const url = new URL('http://localhost/api/transcribe')
  if (opts.share !== undefined && opts.share !== null) {
    url.searchParams.set('share', opts.share)
  }
  const headers = new Headers({ host: 'localhost', 'x-real-ip': opts.ip, 'content-type': 'audio/webm' })
  if (opts.browser ?? true) {
    headers.set('origin', 'http://localhost')
    headers.set('sec-fetch-site', 'same-origin')
    headers.set('sec-fetch-mode', 'cors')
  }
  const body = Object.hasOwn(opts, 'body') ? opts.body : VALID_WEBM
  return new Request(url, { method: 'POST', headers, body, signal: opts.signal })
}

const transcribeMock = vi.mocked(experimental_transcribe)

beforeAll(() => {
  process.env.SHARED_API_KEYS = JSON.stringify({
    [VALID_SHARE]: { api_key: 'sk-share', rate_limit_turns_lifetime: 1000, model: 'anthropic_haiku_4_5' },
  })
  process.env.TRANSCRIPTION_OPENAI_API_KEY = 'sk-transcribe-test'
})

let checkSpy: MockInstance<typeof rateLimiter.check>
let readySpy: MockInstance<typeof rateLimiter.isReady>
let bodySpy: MockInstance<typeof httpModule.parseBinaryBody>

beforeEach(() => {
  process.env.TRANSCRIPTION_OPENAI_API_KEY = 'sk-transcribe-test'
  transcribeMock.mockReset()
  checkSpy = vi.spyOn(rateLimiter, 'check').mockResolvedValue({ allowed: true, remaining: 999 })
  readySpy = vi.spyOn(rateLimiter, 'isReady').mockReturnValue(true)
  bodySpy = vi.spyOn(httpModule, 'parseBinaryBody')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('transcribe preflight (defense-in-depth order preserved)', () => {
  it('valid same-origin browser request with no ?share= → 401 share_required, no charge / body / OpenAI call', async () => {
    const response = await transcribePostHandler({ request: makeRequest({ ip: '10.0.0.1' }) })
    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'share_required' })
    expect(checkSpy).not.toHaveBeenCalled()
    expect(bodySpy).not.toHaveBeenCalled()
    expect(transcribeMock).not.toHaveBeenCalled()
  })

  it('non-browser request (no Origin / Sec-Fetch) → 403 forbidden_origin and marks misbehavior', async () => {
    const ip = '10.0.0.2'
    const response = await transcribePostHandler({
      request: makeRequest({ ip, share: VALID_SHARE, browser: false }),
    })
    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'forbidden_origin' })
    expect(checkSpy).not.toHaveBeenCalled()
    expect(transcribeMock).not.toHaveBeenCalled()
    // Marked → the same IP is now short-circuited as forbidden_blocked.
    const followUp = await transcribePostHandler({ request: makeRequest({ ip, share: VALID_SHARE }) })
    expect(followUp.status).toBe(403)
    await expect(followUp.json()).resolves.toEqual({ error: 'forbidden_blocked' })
  })

  it('already-misbehaving IP → 403 forbidden_blocked before any work', async () => {
    const ip = '10.0.0.3'
    markMisbehavior(await hashIp(ip), 'non_browser_origin')
    const response = await transcribePostHandler({ request: makeRequest({ ip, share: VALID_SHARE }) })
    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'forbidden_blocked' })
    expect(checkSpy).not.toHaveBeenCalled()
    expect(bodySpy).not.toHaveBeenCalled()
    expect(transcribeMock).not.toHaveBeenCalled()
  })
})

describe('transcribe fail-closed config (no charge, no body read)', () => {
  it('missing TRANSCRIPTION_OPENAI_API_KEY → 503, no charge, no OpenAI call', async () => {
    process.env.TRANSCRIPTION_OPENAI_API_KEY = ''
    const response = await transcribePostHandler({
      request: makeRequest({ ip: '10.1.0.1', share: VALID_SHARE }),
    })
    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: 'service_unavailable',
      reason: 'transcription_unavailable',
    })
    expect(checkSpy).not.toHaveBeenCalled()
    expect(bodySpy).not.toHaveBeenCalled()
    expect(transcribeMock).not.toHaveBeenCalled()
  })

  it('rateLimiter.isReady() === false → 503, no charge, request body NOT consumed', async () => {
    readySpy.mockReturnValue(false)
    const response = await transcribePostHandler({
      request: makeRequest({ ip: '10.1.0.2', share: VALID_SHARE }),
    })
    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: 'service_unavailable',
      reason: 'rate_limit_unavailable',
    })
    expect(checkSpy).not.toHaveBeenCalled()
    expect(bodySpy).not.toHaveBeenCalled()
    expect(transcribeMock).not.toHaveBeenCalled()
  })
})

describe('transcribe rate limiting', () => {
  it('lifetime exhausted → 429, no OpenAI call', async () => {
    checkSpy.mockResolvedValue({ allowed: false, reason: 'lifetime' })
    const response = await transcribePostHandler({
      request: makeRequest({ ip: '10.2.0.1', share: VALID_SHARE }),
    })
    expect(response.status).toBe(429)
    await expect(response.json()).resolves.toEqual({ error: 'rate_limited', reason: 'lifetime' })
    expect(transcribeMock).not.toHaveBeenCalled()
  })

  it('limiter check throws → 503 service_unavailable', async () => {
    checkSpy.mockRejectedValue(new Error('redis down'))
    const response = await transcribePostHandler({
      request: makeRequest({ ip: '10.2.0.2', share: VALID_SHARE }),
    })
    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: 'service_unavailable',
      reason: 'rate_limit_unavailable',
    })
    expect(transcribeMock).not.toHaveBeenCalled()
  })
})

describe('transcribe body validation (metered before validation)', () => {
  it('empty body → 400 bad_request, charged exactly once, no OpenAI call', async () => {
    const response = await transcribePostHandler({
      request: makeRequest({ ip: '10.3.0.1', share: VALID_SHARE, body: null }),
    })
    expect(response.status).toBe(400)
    expect(checkSpy).toHaveBeenCalledTimes(1)
    expect(transcribeMock).not.toHaveBeenCalled()
  })

  it('over maxBytes (streaming, ignores Content-Length) → 413, charged once, no OpenAI call', async () => {
    const oversize = new Uint8Array(5 * 1024 * 1024 + 16)
    oversize.set([0x1a, 0x45, 0xdf, 0xa3], 0)
    const response = await transcribePostHandler({
      request: makeRequest({ ip: '10.3.0.2', share: VALID_SHARE, body: oversize }),
    })
    expect(response.status).toBe(413)
    expect(checkSpy).toHaveBeenCalledTimes(1)
    expect(transcribeMock).not.toHaveBeenCalled()
  })

  it('container not in allowlist → 415, charged once, no OpenAI call', async () => {
    const notAudio = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07])
    const response = await transcribePostHandler({
      request: makeRequest({ ip: '10.3.0.3', share: VALID_SHARE, body: notAudio }),
    })
    expect(response.status).toBe(415)
    expect(checkSpy).toHaveBeenCalledTimes(1)
    expect(transcribeMock).not.toHaveBeenCalled()
  })

  it('repeated malformed attempts are each metered and eventually 429', async () => {
    checkSpy
      .mockResolvedValueOnce({ allowed: true, remaining: 2 })
      .mockResolvedValueOnce({ allowed: true, remaining: 1 })
      .mockResolvedValueOnce({ allowed: false, reason: 'lifetime' })
    const bad = { ip: '10.3.0.4', share: VALID_SHARE, body: null }
    const first = await transcribePostHandler({ request: makeRequest(bad) })
    const second = await transcribePostHandler({ request: makeRequest(bad) })
    const third = await transcribePostHandler({ request: makeRequest(bad) })
    expect(first.status).toBe(400)
    expect(second.status).toBe(400)
    expect(third.status).toBe(429)
    expect(checkSpy).toHaveBeenCalledTimes(3)
  })
})

describe('transcribe upstream outcomes (sanitized, no raw provider strings)', () => {
  it('valid container wrapping non-audio → upstream 400 → sanitized 400 bad_request', async () => {
    transcribeMock.mockRejectedValue(
      new APICallError({
        message: 'RAW_PROVIDER_LEAK invalid file format',
        url: 'https://api.openai.com',
        requestBodyValues: {},
        statusCode: 400,
      }),
    )
    const response = await transcribePostHandler({
      request: makeRequest({ ip: '10.4.0.1', share: VALID_SHARE }),
    })
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json).toEqual({ error: 'bad_request', message: 'Could not transcribe the audio' })
    expect(JSON.stringify(json)).not.toContain('RAW_PROVIDER_LEAK')
  })

  it('upstream timeout (TimeoutError) → 503 service_unavailable', async () => {
    transcribeMock.mockRejectedValue(Object.assign(new Error('timed out'), { name: 'TimeoutError' }))
    const response = await transcribePostHandler({
      request: makeRequest({ ip: '10.4.0.2', share: VALID_SHARE }),
    })
    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: 'service_unavailable',
      reason: 'upstream_timeout',
    })
  })

  it('provider 5xx → 503 service_unavailable', async () => {
    transcribeMock.mockRejectedValue(
      new APICallError({
        message: 'upstream boom',
        url: 'https://api.openai.com',
        requestBodyValues: {},
        statusCode: 503,
      }),
    )
    const response = await transcribePostHandler({
      request: makeRequest({ ip: '10.4.0.3', share: VALID_SHARE }),
    })
    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({ error: 'service_unavailable', reason: 'upstream_error' })
  })

  it('NoTranscriptGeneratedError → 400 bad_request (no speech)', async () => {
    transcribeMock.mockRejectedValue(new NoTranscriptGeneratedError({ responses: [] }))
    const response = await transcribePostHandler({
      request: makeRequest({ ip: '10.4.0.4', share: VALID_SHARE }),
    })
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'bad_request',
      message: 'No speech detected in the audio',
    })
  })

  it('empty transcript text → 400 bad_request (no speech)', async () => {
    transcribeMock.mockResolvedValue(fakeTranscription({ text: '   ' }))
    const response = await transcribePostHandler({
      request: makeRequest({ ip: '10.4.0.5', share: VALID_SHARE }),
    })
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'bad_request',
      message: 'No speech detected in the audio',
    })
  })

  it('client disconnect during upstream call → 503 client_aborted and the upstream signal is aborted', async () => {
    const controller = new AbortController()
    const request = makeRequest({ ip: '10.4.0.6', share: VALID_SHARE, signal: controller.signal })
    transcribeMock.mockImplementation(async () => {
      controller.abort()
      throw Object.assign(new Error('aborted'), { name: 'AbortError' })
    })
    const response = await transcribePostHandler({ request })
    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({ error: 'service_unavailable', reason: 'client_aborted' })
    const callArg = transcribeMock.mock.calls[0]?.[0]
    expect(callArg?.abortSignal?.aborted).toBe(true)
  })
})

describe('transcribe happy path', () => {
  it('valid request → 200 { text }, charged exactly once, body parsed once', async () => {
    transcribeMock.mockResolvedValue(fakeTranscription({ text: 'hello world', language: 'en' }))
    const response = await transcribePostHandler({
      request: makeRequest({ ip: '10.5.0.1', share: VALID_SHARE }),
    })
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ text: 'hello world' })
    expect(checkSpy).toHaveBeenCalledTimes(1)
    expect(bodySpy).toHaveBeenCalledTimes(1)
    expect(transcribeMock).toHaveBeenCalledTimes(1)
  })
})
