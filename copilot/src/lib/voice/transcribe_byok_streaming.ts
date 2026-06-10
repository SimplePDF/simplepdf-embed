import type { ByokSttConfig } from '../byok/providers'
import type { TranscribeClientErrorCode, TranscribeFnResult } from './error_codes'

// Streaming browser-direct BYOK transcription (P070-02 Phase 5). The AI SDK's
// experimental_transcribe returns a complete result, so streaming bypasses it
// with a direct multipart POST + `stream: true`, parsing the OpenAI SSE
// `transcript.text.delta` / `transcript.text.done` events and emitting deltas
// so the transcript fills the composer as it is produced. Audio still goes
// browser-direct to the user's endpoint; `maxRetries` does not apply (one
// fetch); errors stay sanitized (no raw provider text).

const OPENAI_DEFAULT_BASE_URL = 'https://api.openai.com/v1'
const TRANSCRIBE_TIMEOUT_MS = 60_000

const baseUrlFor = (config: ByokSttConfig): string =>
  config.provider === 'custom' ? config.baseUrl : OPENAI_DEFAULT_BASE_URL

const failure = (code: TranscribeClientErrorCode): TranscribeFnResult => ({
  success: false,
  error: { code, message: `byok streaming transcription failed: ${code}` },
})

const statusToCode = (status: number): TranscribeClientErrorCode => {
  if (status === 401 || status === 403) {
    return 'unauthorized'
  }
  if (status === 429) {
    return 'rate_limited'
  }
  if (status === 400) {
    return 'bad_request'
  }
  return 'service_unavailable'
}

// One SSE `data:` line → the text delta it carries (or null for non-text
// events / `[DONE]`). Tolerant of provider field shapes: prefers an explicit
// `delta`, falls back to a `text` on a done event.
const readDelta = (json: unknown): { delta: string } | { done: string } | null => {
  if (typeof json !== 'object' || json === null) {
    return null
  }
  const type = 'type' in json && typeof json.type === 'string' ? json.type : ''
  if (type.endsWith('delta') && 'delta' in json && typeof json.delta === 'string') {
    return { delta: json.delta }
  }
  if (type.endsWith('done') && 'text' in json && typeof json.text === 'string') {
    return { done: json.text }
  }
  return null
}

export const transcribeByokStreaming = async ({
  audioBytes,
  signal,
  config,
  onDelta,
}: {
  audioBytes: Uint8Array<ArrayBuffer>
  signal: AbortSignal
  config: ByokSttConfig
  onDelta: (textSoFar: string) => void
}): Promise<TranscribeFnResult> => {
  const url = `${baseUrlFor(config).replace(/\/$/, '')}/audio/transcriptions`
  const form = new FormData()
  form.append('model', config.model)
  form.append('file', new Blob([audioBytes]), 'audio.webm')
  form.append('stream', 'true')
  const headers: Record<string, string> = {}
  if (config.apiKey !== '') {
    headers.authorization = `Bearer ${config.apiKey}`
  }

  const combined = AbortSignal.any([signal, AbortSignal.timeout(TRANSCRIBE_TIMEOUT_MS)])
  const fetched = await (async (): Promise<
    { ok: true; response: Response } | { ok: false; code: TranscribeClientErrorCode }
  > => {
    try {
      return {
        ok: true,
        response: await window.fetch(url, { method: 'POST', body: form, headers, signal: combined }),
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return { ok: false, code: 'cancelled' }
      }
      return { ok: false, code: 'service_unavailable' }
    }
  })()
  if (!fetched.ok) {
    return failure(fetched.code)
  }
  if (!fetched.response.ok) {
    return failure(statusToCode(fetched.response.status))
  }
  if (fetched.response.body === null) {
    return failure('service_unavailable')
  }

  const reader = fetched.response.body.getReader()
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
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) {
            continue
          }
          const payload = trimmed.slice(5).trim()
          if (payload === '' || payload === '[DONE]') {
            continue
          }
          const parsed = ((): unknown => {
            try {
              return JSON.parse(payload)
            } catch {
              return null
            }
          })()
          const event = readDelta(parsed)
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
      }
    } catch (error) {
      if (combined.aborted || (error instanceof Error && error.name === 'AbortError')) {
        return { ok: false, code: 'cancelled' }
      }
      return { ok: false, code: 'service_unavailable' }
    }
    return { ok: true, text: done ?? accumulated }
  })()
  if (!drained.ok) {
    return failure(drained.code)
  }
  if (drained.text.trim() === '') {
    return failure('bad_request')
  }
  return { success: true, data: { text: drained.text } }
}
