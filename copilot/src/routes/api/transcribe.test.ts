import { afterEach, beforeAll, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest'
import { markMisbehavior } from '../../server/demo/misbehavior'
import * as httpModule from '../../server/http'
import { hashIp, rateLimiter } from '../../server/rate_limit'
import * as transcribeStreamModule from '../../server/transcribe_stream'
import { transcribePostHandler } from './transcribe'

// Only the paid streaming call (streamTranscription) is faked; every gate
// (preflight, key, limiter, body parsing, container allowlist) runs for real so
// the security matrix exercises the true route order. The relay's own upstream
// fetch + SSE sanitization is unit-tested in transcribe_stream.test.ts.

const VALID_SHARE = 'validshare'
// EBML/WebM magic + padding — passes the container allowlist.
const VALID_WEBM = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x02, 0x03, 0x04])

// A 200 text/event-stream Response, what streamTranscription returns on success.
const sseOk = (text: string): Response =>
  new Response(`data: {"type":"transcript.text.done","text":${JSON.stringify(text)}}\n\n`, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
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

beforeAll(() => {
  process.env.SHARED_API_KEYS = JSON.stringify({
    [VALID_SHARE]: { api_key: 'sk-share', rate_limit_turns_lifetime: 1000, model: 'anthropic_haiku_4_5' },
  })
  process.env.TRANSCRIPTION_OPENAI_API_KEY = 'sk-transcribe-test'
})

let checkSpy: MockInstance<typeof rateLimiter.check>
let readySpy: MockInstance<typeof rateLimiter.isReady>
let bodySpy: MockInstance<typeof httpModule.parseBinaryBody>
let streamSpy: MockInstance<typeof transcribeStreamModule.streamTranscription>

beforeEach(() => {
  process.env.TRANSCRIPTION_OPENAI_API_KEY = 'sk-transcribe-test'
  checkSpy = vi.spyOn(rateLimiter, 'check').mockResolvedValue({ allowed: true, remaining: 999 })
  readySpy = vi.spyOn(rateLimiter, 'isReady').mockReturnValue(true)
  bodySpy = vi.spyOn(httpModule, 'parseBinaryBody')
  streamSpy = vi
    .spyOn(transcribeStreamModule, 'streamTranscription')
    .mockResolvedValue({ ok: true, response: sseOk('hello world') })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('transcribe preflight (defense-in-depth order preserved)', () => {
  it('valid same-origin browser request with no ?share= → 401 share_required, no charge / body / upstream call', async () => {
    const response = await transcribePostHandler({ request: makeRequest({ ip: '10.0.0.1' }) })
    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'share_required' })
    expect(checkSpy).not.toHaveBeenCalled()
    expect(bodySpy).not.toHaveBeenCalled()
    expect(streamSpy).not.toHaveBeenCalled()
  })

  it('non-browser request (no Origin / Sec-Fetch) → 403 forbidden_origin and marks misbehavior', async () => {
    const ip = '10.0.0.2'
    const response = await transcribePostHandler({
      request: makeRequest({ ip, share: VALID_SHARE, browser: false }),
    })
    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'forbidden_origin' })
    expect(checkSpy).not.toHaveBeenCalled()
    expect(streamSpy).not.toHaveBeenCalled()
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
    expect(streamSpy).not.toHaveBeenCalled()
  })
})

describe('transcribe fail-closed config (no charge, no body read)', () => {
  it('missing TRANSCRIPTION_OPENAI_API_KEY → 503, no charge, no upstream call', async () => {
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
    expect(streamSpy).not.toHaveBeenCalled()
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
    expect(streamSpy).not.toHaveBeenCalled()
  })
})

describe('transcribe rate limiting', () => {
  it('lifetime exhausted → 429, no upstream call', async () => {
    checkSpy.mockResolvedValue({ allowed: false, reason: 'lifetime' })
    const response = await transcribePostHandler({
      request: makeRequest({ ip: '10.2.0.1', share: VALID_SHARE }),
    })
    expect(response.status).toBe(429)
    await expect(response.json()).resolves.toEqual({ error: 'rate_limited', reason: 'lifetime' })
    expect(streamSpy).not.toHaveBeenCalled()
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
    expect(streamSpy).not.toHaveBeenCalled()
  })
})

describe('transcribe body validation (metered before validation)', () => {
  it('empty body → 400 bad_request, charged exactly once, no upstream call', async () => {
    const response = await transcribePostHandler({
      request: makeRequest({ ip: '10.3.0.1', share: VALID_SHARE, body: null }),
    })
    expect(response.status).toBe(400)
    expect(checkSpy).toHaveBeenCalledTimes(1)
    expect(streamSpy).not.toHaveBeenCalled()
  })

  it('over maxBytes (streaming, ignores Content-Length) → 413, charged once, no upstream call', async () => {
    const oversize = new Uint8Array(5 * 1024 * 1024 + 16)
    oversize.set([0x1a, 0x45, 0xdf, 0xa3], 0)
    const response = await transcribePostHandler({
      request: makeRequest({ ip: '10.3.0.2', share: VALID_SHARE, body: oversize }),
    })
    expect(response.status).toBe(413)
    expect(checkSpy).toHaveBeenCalledTimes(1)
    expect(streamSpy).not.toHaveBeenCalled()
  })

  it('container not in allowlist → 415, charged once, no upstream call', async () => {
    const notAudio = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07])
    const response = await transcribePostHandler({
      request: makeRequest({ ip: '10.3.0.3', share: VALID_SHARE, body: notAudio }),
    })
    expect(response.status).toBe(415)
    expect(checkSpy).toHaveBeenCalledTimes(1)
    expect(streamSpy).not.toHaveBeenCalled()
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

describe('transcribe upstream outcomes (sanitized pre-stream errors pass through)', () => {
  it('pre-stream upstream 400 → sanitized 400 bad_request', async () => {
    streamSpy.mockResolvedValue({
      ok: false,
      error: {
        status: 400,
        body: { error: 'bad_request', message: 'Could not transcribe the audio' },
        logReason: 'upstream_invalid_audio',
      },
    })
    const response = await transcribePostHandler({
      request: makeRequest({ ip: '10.4.0.1', share: VALID_SHARE }),
    })
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'bad_request',
      message: 'Could not transcribe the audio',
    })
  })

  it('pre-stream upstream timeout → 503 service_unavailable', async () => {
    streamSpy.mockResolvedValue({
      ok: false,
      error: {
        status: 503,
        body: { error: 'service_unavailable', reason: 'upstream_timeout' },
        logReason: 'upstream_timeout',
      },
    })
    const response = await transcribePostHandler({
      request: makeRequest({ ip: '10.4.0.2', share: VALID_SHARE }),
    })
    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: 'service_unavailable',
      reason: 'upstream_timeout',
    })
  })

  it('client disconnect → 503 client_aborted, the request signal is forwarded to the relay', async () => {
    const controller = new AbortController()
    const request = makeRequest({ ip: '10.4.0.6', share: VALID_SHARE, signal: controller.signal })
    streamSpy.mockImplementation(async () => {
      controller.abort()
      return {
        ok: false,
        error: {
          status: 503,
          body: { error: 'service_unavailable', reason: 'client_aborted' },
          logReason: 'client_aborted',
        },
      }
    })
    const response = await transcribePostHandler({ request })
    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({ error: 'service_unavailable', reason: 'client_aborted' })
    // The route forwards the request's own abort signal; after the disconnect
    // it is aborted (so the relay's combined signal cancels the paid call).
    expect(streamSpy.mock.calls[0]?.[0]?.requestSignal.aborted).toBe(true)
  })
})

describe('transcribe happy path', () => {
  it('valid request → 200 streamed relay, charged exactly once, body parsed once, bytes + key forwarded', async () => {
    const response = await transcribePostHandler({
      request: makeRequest({ ip: '10.5.0.1', share: VALID_SHARE }),
    })
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/event-stream')
    expect(checkSpy).toHaveBeenCalledTimes(1)
    expect(bodySpy).toHaveBeenCalledTimes(1)
    expect(streamSpy).toHaveBeenCalledTimes(1)
    const callArg = streamSpy.mock.calls[0]?.[0]
    expect(callArg?.bytes).toBeInstanceOf(Uint8Array)
    expect(callArg?.apiKey).toBe('sk-transcribe-test')
  })
})
