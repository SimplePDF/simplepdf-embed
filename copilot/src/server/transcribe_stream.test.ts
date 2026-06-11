import { afterEach, describe, expect, it, vi } from 'vitest'
import { drainTranscriptSse, MAX_TRANSCRIPT_CHARS } from '../lib/voice/transcript_sse'
import { streamTranscription } from './transcribe_stream'

const bytes = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x02])
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
  return new Response(stream, { status, headers: { 'content-type': 'text/event-stream' } })
}

// Drains the relayed body to its raw re-emitted SSE wire text (how the real
// client reads it). Avoids Response.text(), which stalls over a custom
// pull-driven stream in this Node version.
const readWire = async (body: ReadableStream<Uint8Array>): Promise<string> => {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let wire = ''
  while (true) {
    const chunk = await reader.read()
    if (chunk.done) {
      break
    }
    wire += decoder.decode(chunk.value, { stream: true })
  }
  return wire
}

const call = (over?: { signal?: AbortSignal; timeoutMs?: number }) =>
  streamTranscription({
    apiKey: 'sk-demo',
    bytes,
    requestSignal: over?.signal ?? fresh(),
    timeoutMs: over?.timeoutMs ?? 30_000,
    ipHash: 'iphash',
    startedAt: 0,
  })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('streamTranscription upstream request shape', () => {
  it('POSTs a stream:true multipart form with the model + bearer key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(sseResponse(['data: [DONE]\n\n']))
    vi.stubGlobal('fetch', fetchMock)
    await call()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.openai.com/v1/audio/transcriptions')
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({ authorization: 'Bearer sk-demo' })
    expect(init.body).toBeInstanceOf(FormData)
    expect(init.body.get('model')).toBe('gpt-4o-transcribe')
    expect(init.body.get('stream')).toBe('true')
  })
})

describe('streamTranscription relay (sanitized re-emission)', () => {
  it('re-emits only delta/done events, and a client consumer drains them to the final text', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          sseResponse([
            'data: {"type":"transcript.text.delta","delta":"Hel"}\n\n',
            'data: {"type":"transcript.text.delta","delta":"lo"}\n\n',
            'data: {"type":"transcript.text.done","text":"Hello"}\n\n',
          ]),
        ),
    )
    const result = await call()
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.response.status).toBe(200)
    expect(result.response.headers.get('content-type')).toContain('text/event-stream')
    const body = result.response.body
    expect(body).not.toBeNull()
    if (body === null) {
      return
    }
    const deltas: string[] = []
    const drained = await drainTranscriptSse({
      body,
      onDelta: (text) => deltas.push(text),
      isAborted: () => false,
    })
    expect(deltas).toEqual(['Hel', 'Hello'])
    expect(drained).toEqual({ ok: true, text: 'Hello' })
  })

  it('drops a provider error event mid-stream — no raw provider text reaches the wire', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          sseResponse([
            'data: {"type":"transcript.text.delta","delta":"Hi"}\n\n',
            'data: {"error":{"message":"RAW_PROVIDER_LEAK secret detail"}}\n\n',
            'data: {"type":"transcript.text.done","text":"Hi"}\n\n',
          ]),
        ),
    )
    const result = await call()
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    const body = result.response.body
    expect(body).not.toBeNull()
    if (body === null) {
      return
    }
    const wire = await readWire(body)
    expect(wire).not.toContain('RAW_PROVIDER_LEAK')
    expect(wire).toContain('transcript.text.delta')
    expect(wire).toContain('transcript.text.done')
  })

  it('caps an over-long transcript (defense-in-depth) — the client drains it to a sanitized failure', async () => {
    const huge = 'x'.repeat(MAX_TRANSCRIPT_CHARS + 1)
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(sseResponse([`data: {"type":"transcript.text.delta","delta":"${huge}"}\n\n`])),
    )
    const result = await call()
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    const body = result.response.body
    expect(body).not.toBeNull()
    if (body === null) {
      return
    }
    const drained = await drainTranscriptSse({ body, onDelta: () => {}, isAborted: () => false })
    expect(drained).toEqual({ ok: false, code: 'service_unavailable' })
  })
})

describe('streamTranscription pre-stream failures (sanitized, status-mapped)', () => {
  it('upstream 400 → bad_request 400 (sanitized, no raw body)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('RAW_PROVIDER_LEAK', { status: 400 })))
    const result = await call()
    expect(result).toEqual({
      ok: false,
      error: {
        status: 400,
        body: { error: 'bad_request', message: 'Could not transcribe the audio' },
        logReason: 'upstream_invalid_audio',
      },
    })
  })

  it('upstream 401 → service_unavailable 503 upstream_error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 401 })))
    const result = await call()
    expect(result).toMatchObject({
      ok: false,
      error: {
        status: 503,
        body: { error: 'service_unavailable', reason: 'upstream_error' },
        logReason: 'upstream_status_401',
      },
    })
  })

  it('upstream 503 → service_unavailable 503 upstream_error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('boom', { status: 503 })))
    const result = await call()
    expect(result).toMatchObject({
      ok: false,
      error: {
        status: 503,
        body: { error: 'service_unavailable', reason: 'upstream_error' },
        logReason: 'upstream_status_503',
      },
    })
  })

  it('network throw → service_unavailable 503 (upstream_unknown)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const result = await call()
    expect(result).toMatchObject({
      ok: false,
      error: { status: 503, body: { error: 'service_unavailable', reason: 'upstream_error' } },
    })
    if (!result.ok) {
      expect(result.error.logReason).toContain('upstream_unknown')
    }
  })

  it('upstream TimeoutError → service_unavailable 503 upstream_timeout', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(Object.assign(new Error('timed out'), { name: 'TimeoutError' })),
    )
    const result = await call()
    expect(result).toMatchObject({
      ok: false,
      error: {
        status: 503,
        body: { error: 'service_unavailable', reason: 'upstream_timeout' },
        logReason: 'upstream_timeout',
      },
    })
  })

  it('client-aborted (AbortError + aborted request signal) → 503 client_aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' })),
    )
    const result = await call({ signal: controller.signal })
    expect(result).toMatchObject({
      ok: false,
      error: {
        status: 503,
        body: { error: 'service_unavailable', reason: 'client_aborted' },
        logReason: 'client_aborted',
      },
    })
  })

  it('upstream 200 with no body → service_unavailable 503 upstream_no_body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 200 })))
    const result = await call()
    expect(result).toMatchObject({
      ok: false,
      error: {
        status: 503,
        body: { error: 'service_unavailable', reason: 'upstream_error' },
        logReason: 'upstream_no_body',
      },
    })
  })
})
