import { createOpenAI } from '@ai-sdk/openai'
import { APICallError, experimental_transcribe, NoTranscriptGeneratedError } from 'ai'
import type { ByokSttConfig } from '../byok/providers'
import type { TranscribeClientErrorCode, TranscribeFnResult } from './error_codes'

// Browser-direct BYOK transcription (P070-02). Audio goes from the browser to
// the user's configured OpenAI(-compatible) endpoint and NEVER transits
// SimplePDF's server. `maxRetries: 0` + a combined abort/timeout means exactly
// one provider request per recording (no duplicated paid egress). Errors are
// mapped to the same sanitized VoiceInputErrorCode surface as the demo path —
// no raw provider text reaches the UI. Phase 0 proved the SDK's multipart POST
// passes CORS from the Copilot origin.

const TRANSCRIBE_TIMEOUT_MS = 30_000

const buildTranscriptionModel = (config: ByokSttConfig) => {
  if (config.provider === 'custom') {
    // Local endpoints (Whisper/Ollama) often need no key; the SDK still wants a
    // non-empty value, which such endpoints ignore.
    const provider = createOpenAI({
      apiKey: config.apiKey === '' ? 'no-key' : config.apiKey,
      baseURL: config.baseUrl,
    })
    return provider.transcription(config.model)
  }
  return createOpenAI({ apiKey: config.apiKey }).transcription(config.model)
}

// Maps SDK / network failures to a sanitized client code. Never returns a raw
// provider message.
const mapByokError = (error: unknown, clientAborted: boolean): TranscribeClientErrorCode => {
  if (clientAborted || (error instanceof Error && error.name === 'AbortError')) {
    return 'cancelled'
  }
  if (error instanceof Error && error.name === 'TimeoutError') {
    return 'service_unavailable'
  }
  if (NoTranscriptGeneratedError.isInstance(error)) {
    return 'bad_request'
  }
  if (APICallError.isInstance(error)) {
    const status = error.statusCode
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
  // Network / CORS / mixed-content / unknown — never surface the raw reason.
  return 'service_unavailable'
}

const failure = (code: TranscribeClientErrorCode): TranscribeFnResult => ({
  success: false,
  error: { code, message: `byok transcription failed: ${code}` },
})

export const transcribeByok = async ({
  audioBytes,
  signal,
  config,
}: {
  audioBytes: Uint8Array
  signal: AbortSignal
  config: ByokSttConfig
}): Promise<TranscribeFnResult> => {
  const outcome = await (async (): Promise<{ ok: true; text: string } | { ok: false; error: unknown }> => {
    try {
      const transcription = await experimental_transcribe({
        model: buildTranscriptionModel(config),
        audio: audioBytes,
        maxRetries: 0,
        abortSignal: AbortSignal.any([signal, AbortSignal.timeout(TRANSCRIBE_TIMEOUT_MS)]),
      })
      return { ok: true, text: transcription.text }
    } catch (error) {
      return { ok: false, error }
    }
  })()
  if (!outcome.ok) {
    return failure(mapByokError(outcome.error, signal.aborted))
  }
  if (outcome.text.trim() === '') {
    return failure('bad_request')
  }
  return { success: true, data: { text: outcome.text } }
}
