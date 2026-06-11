import type { TranscribeClientErrorCode } from './error_codes'

// Single owner of the OpenAI-compatible transcription SSE contract (P070-02
// Phase 5). Both streaming paths return a `text/event-stream` of
// `transcript.text.delta` / `transcript.text.done` events:
//   - BYOK browser-direct: straight from the user's provider.
//   - Demo server: `/api/transcribe` relays OpenAI's stream, re-emitting these
//     EXACT event shapes after sanitizing them.
// Because the wire shape is identical, the client consumer (`drainTranscriptSse`)
// is shared by both, and the server relay reuses the same line parser to
// sanitize — so the two can never drift.

export const TRANSCRIPT_DELTA_EVENT = 'transcript.text.delta'
export const TRANSCRIPT_DONE_EVENT = 'transcript.text.done'

// Defense-in-depth cap on the accumulated transcript. A ~2-minute recording
// transcribes to a few thousand chars; this is far above any legitimate output
// but bounds heap if an upstream misbehaves — relevant on the BYOK path, where
// the upstream is a user-configured endpoint, not api.openai.com. Exceeding it
// degrades to a sanitized failure rather than unbounded growth.
export const MAX_TRANSCRIPT_CHARS = 200_000

// One parsed SSE JSON payload → the text it carries (or null for non-text
// events / unknown shapes). Matches the OpenAI-compatible event types EXACTLY
// (`transcript.text.delta` / `.done`): anything else — including a provider
// error event — returns null and is dropped, which is what keeps raw provider
// strings out of the relayed stream.
export const readTranscriptEvent = (json: unknown): { delta: string } | { done: string } | null => {
  if (typeof json !== 'object' || json === null) {
    return null
  }
  const type = 'type' in json && typeof json.type === 'string' ? json.type : ''
  if (type === TRANSCRIPT_DELTA_EVENT && 'delta' in json && typeof json.delta === 'string') {
    return { delta: json.delta }
  }
  if (type === TRANSCRIPT_DONE_EVENT && 'text' in json && typeof json.text === 'string') {
    return { done: json.text }
  }
  return null
}

// One raw SSE line → its transcript event, or null (non-`data:` line, `[DONE]`,
// empty payload, or unparseable JSON).
export const parseTranscriptDataLine = (line: string): { delta: string } | { done: string } | null => {
  const trimmed = line.trim()
  if (!trimmed.startsWith('data:')) {
    return null
  }
  const payload = trimmed.slice(5).trim()
  if (payload === '' || payload === '[DONE]') {
    return null
  }
  const parsed = ((): unknown => {
    try {
      return JSON.parse(payload)
    } catch {
      return null
    }
  })()
  return readTranscriptEvent(parsed)
}

// Drain a transcription SSE body to its final transcript, emitting the
// accumulated text on every delta. `isAborted` distinguishes a cancellation
// (caller signal / timeout) from a transport fault. An empty final transcript
// is reported as `bad_request` (no speech), matching the JSON route's old
// empty-text → 400, so both streaming callers surface "no speech" identically.
export const drainTranscriptSse = async ({
  body,
  onDelta,
  isAborted,
}: {
  body: ReadableStream<Uint8Array>
  onDelta: (textSoFar: string) => void
  isAborted: () => boolean
}): Promise<{ ok: true; text: string } | { ok: false; code: TranscribeClientErrorCode }> => {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  const drained = await (async (): Promise<
    { ok: true; text: string } | { ok: false; code: TranscribeClientErrorCode }
  > => {
    let buffer = ''
    let accumulated = ''
    let done: string | null = null
    try {
      while (true) {
        const chunk = await reader.read()
        if (chunk.done) {
          break
        }
        buffer += decoder.decode(chunk.value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          const event = parseTranscriptDataLine(line)
          if (event === null) {
            continue
          }
          if ('delta' in event) {
            accumulated += event.delta
            onDelta(accumulated)
          } else {
            done = event.done
          }
        }
        if (accumulated.length > MAX_TRANSCRIPT_CHARS || (done?.length ?? 0) > MAX_TRANSCRIPT_CHARS) {
          return { ok: false, code: 'service_unavailable' }
        }
      }
    } catch (error) {
      if (isAborted() || (error instanceof Error && error.name === 'AbortError')) {
        return { ok: false, code: 'cancelled' }
      }
      return { ok: false, code: 'service_unavailable' }
    }
    return { ok: true, text: done ?? accumulated }
  })()
  if (!drained.ok) {
    return drained
  }
  if (drained.text.trim() === '') {
    return { ok: false, code: 'bad_request' }
  }
  return { ok: true, text: drained.text }
}
