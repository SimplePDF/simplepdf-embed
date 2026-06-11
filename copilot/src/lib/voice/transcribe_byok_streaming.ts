import type { ByokSttConfig } from '../byok/providers'
import type { TranscribeClientErrorCode, TranscribeFnResult } from './error_codes'
import { drainTranscriptSse } from './transcript_sse'

// Streaming browser-direct BYOK transcription (P070-02 Phase 5). The AI SDK's
// experimental_transcribe returns a complete result, so streaming bypasses it
// with a direct multipart POST + `stream: true`; the SSE body is drained by the
// shared `drainTranscriptSse` owner (same parser the demo-server relay uses).
// Audio still goes browser-direct to the user's endpoint; `maxRetries` does not
// apply (one fetch); errors stay sanitized (no raw provider text).

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

  const drained = await drainTranscriptSse({
    body: fetched.response.body,
    onDelta,
    isAborted: () => combined.aborted,
  })
  if (!drained.ok) {
    return failure(drained.code)
  }
  return { success: true, data: { text: drained.text } }
}
