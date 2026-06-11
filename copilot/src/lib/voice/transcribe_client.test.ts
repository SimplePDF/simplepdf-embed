// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ServerErrorBody } from '../api_envelope'
import type { TranscribeErrorCode } from './error_codes'
import { mapServerErrorBodyToTranscribeErrorCode, transcribeClient } from './transcribe_client'

const blob = new Blob(['audio-bytes'], { type: 'audio/webm' })
const noop = (): void => {}

// 200 `text/event-stream` of transcript SSE lines (P070-02 Phase 5), mirroring
// what /api/transcribe's relay re-emits.
const sseResponse = (lines: string[]): Response => {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(encoder.encode(line))
      }
      controller.close()
    },
  })
  return new Response(stream, { status: 200 })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('transcribeClient request shape', () => {
  it('POSTs the blob with ?share, content-type, the abort signal, and streams deltas into the final text', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        sseResponse([
          'data: {"type":"transcript.text.delta","delta":"hel"}\n\n',
          'data: {"type":"transcript.text.delta","delta":"lo"}\n\n',
          'data: {"type":"transcript.text.done","text":"hello"}\n\n',
          'data: [DONE]\n\n',
        ]),
      )
    vi.stubGlobal('fetch', fetchMock)
    const controller = new AbortController()
    const deltas: string[] = []
    const result = await transcribeClient({
      blob,
      shareId: 'share-123',
      signal: controller.signal,
      onDelta: (text) => deltas.push(text),
    })
    expect(result).toEqual({ success: true, data: { text: 'hello' } })
    expect(deltas).toEqual(['hel', 'hello'])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url.toString()).toContain('/api/transcribe?share=share-123')
    expect(init.method).toBe('POST')
    expect(init.body).toBe(blob)
    expect(init.headers).toEqual({ 'content-type': 'audio/webm' })
    expect(init.signal).toBe(controller.signal)
  })

  it('maps a fetch AbortError to the cancelled code (silent discard)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' })),
    )
    const result = await transcribeClient({
      blob,
      shareId: 's',
      signal: new AbortController().signal,
      onDelta: noop,
    })
    expect(result).toEqual({ success: false, error: { code: 'cancelled', message: expect.any(String) } })
  })

  it('maps a non-abort network error to service_unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const result = await transcribeClient({
      blob,
      shareId: 's',
      signal: new AbortController().signal,
      onDelta: noop,
    })
    expect(result).toMatchObject({ success: false, error: { code: 'service_unavailable' } })
  })

  it('maps a non-2xx ServerErrorBody to its UI code', async () => {
    const body = JSON.stringify({ error: 'rate_limited', reason: 'lifetime' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status: 429 })))
    const result = await transcribeClient({
      blob,
      shareId: 's',
      signal: new AbortController().signal,
      onDelta: noop,
    })
    expect(result).toMatchObject({ success: false, error: { code: 'rate_limited' } })
  })

  it('an empty stream (no speech) maps to bad_request', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse(['data: [DONE]\n\n'])))
    const result = await transcribeClient({
      blob,
      shareId: 's',
      signal: new AbortController().signal,
      onDelta: noop,
    })
    expect(result).toMatchObject({ success: false, error: { code: 'bad_request' } })
  })
})

describe('mapServerErrorBodyToTranscribeErrorCode (exhaustive)', () => {
  const cases: Array<[ServerErrorBody, TranscribeErrorCode]> = [
    [{ error: 'forbidden_blocked' }, 'unauthorized'],
    [{ error: 'forbidden_origin' }, 'unauthorized'],
    [{ error: 'share_required' }, 'unauthorized'],
    [{ error: 'misconfigured_environment', message: 'x' }, 'service_unavailable'],
    [{ error: 'rate_limited', reason: 'lifetime' }, 'rate_limited'],
    [{ error: 'payload_too_large', message: 'x' }, 'too_large'],
    [{ error: 'unsupported_media_type', message: 'x' }, 'unsupported_media_type'],
    [{ error: 'bad_request', message: 'x' }, 'bad_request'],
    [{ error: 'service_unavailable', reason: 'x' }, 'service_unavailable'],
  ]

  it.each(cases)('maps %o → %s', (body, expected) => {
    expect(mapServerErrorBodyToTranscribeErrorCode(body)).toBe(expected)
  })
})
