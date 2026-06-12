// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ByokSttConfig } from '../byok/providers'
import { transcribeByokStreaming } from './transcribe_byok_streaming'

const openai: ByokSttConfig = { provider: 'openai', model: 'gpt-4o-mini-transcribe', apiKey: 'sk-test' }
const bytes = new Uint8Array([1, 2, 3])
const fresh = (): AbortSignal => new AbortController().signal

const sseResponse = (lines: string[], status = 200): Response => {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(encoder.encode(line))
      }
      controller.close()
    },
  })
  return new Response(stream, { status })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('transcribeByokStreaming', () => {
  it('parses SSE deltas, emits accumulated text, and returns the final transcript', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          sseResponse([
            'data: {"type":"transcript.text.delta","delta":"Hello"}\n\n',
            'data: {"type":"transcript.text.delta","delta":" world"}\n\n',
            'data: {"type":"transcript.text.done","text":"Hello world"}\n\n',
            'data: [DONE]\n\n',
          ]),
        ),
    )
    const deltas: string[] = []
    const result = await transcribeByokStreaming({
      audioBytes: bytes,
      mimeType: 'audio/webm',
      signal: fresh(),
      config: openai,
      onDelta: (text) => deltas.push(text),
    })
    expect(deltas).toEqual(['Hello', 'Hello world'])
    expect(result).toEqual({ success: true, data: { text: 'Hello world' } })
  })

  it('names the multipart upload for the recorded container (Safari MP4, not .webm)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(sseResponse(['data: [DONE]\n\n']))
    vi.stubGlobal('fetch', fetchMock)
    await transcribeByokStreaming({
      audioBytes: bytes,
      mimeType: 'audio/mp4',
      signal: fresh(),
      config: openai,
      onDelta: () => {},
    })
    const file = fetchMock.mock.calls[0][1].body.get('file')
    expect(file.name).toBe('audio.mp4')
    expect(file.type).toBe('audio/mp4')
  })

  it('falls back to the accumulated deltas when no done event arrives', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(sseResponse(['data: {"type":"transcript.text.delta","delta":"partial"}\n\n'])),
    )
    const result = await transcribeByokStreaming({
      audioBytes: bytes,
      mimeType: 'audio/webm',
      signal: fresh(),
      config: openai,
      onDelta: () => {},
    })
    expect(result).toEqual({ success: true, data: { text: 'partial' } })
  })

  it('maps a 401 to a sanitized unauthorized failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('RAW', { status: 401 })))
    const result = await transcribeByokStreaming({
      audioBytes: bytes,
      mimeType: 'audio/webm',
      signal: fresh(),
      config: openai,
      onDelta: () => {},
    })
    expect(result).toMatchObject({ success: false, error: { code: 'unauthorized' } })
    expect(JSON.stringify(result)).not.toContain('RAW')
  })

  it('maps a network error to service_unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const result = await transcribeByokStreaming({
      audioBytes: bytes,
      mimeType: 'audio/webm',
      signal: fresh(),
      config: openai,
      onDelta: () => {},
    })
    expect(result).toMatchObject({ success: false, error: { code: 'service_unavailable' } })
  })

  it('empty stream → bad_request (no speech)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse(['data: [DONE]\n\n'])))
    const result = await transcribeByokStreaming({
      audioBytes: bytes,
      mimeType: 'audio/webm',
      signal: fresh(),
      config: openai,
      onDelta: () => {},
    })
    expect(result).toMatchObject({ success: false, error: { code: 'bad_request' } })
  })
})
