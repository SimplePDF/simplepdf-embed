// Lives in src/server/ (not src/lib/) so server-only env/secret reads stay out
// of the client bundle, mirroring language_model.ts. /api/transcribe (via
// transcribe_stream.ts) is the only consumer.
//
// The transcription secret is deliberately separate from the chat/share
// keys: share keys are Anthropic/DeepSeek (neither transcribes) and BYOK
// keys live in the user's tab and never reach the server. Voice
// transcription is a SimplePDF-paid OpenAI call gated behind a valid share.

// Fixed model, no fallback. The whisper-1 auto-fallback was removed per the
// repo fallback policy: a silent model swap would change cost / accuracy /
// language behaviour without a product decision. `gpt-4o-transcribe` also
// supports `stream: true`, which the relay (transcribe_stream.ts) requires
// (whisper-1 does not stream).
export const TRANSCRIPTION_MODEL_ID = 'gpt-4o-transcribe'

type ReadTranscriptionKeyResult =
  | { success: true; data: string }
  | { success: false; error: { code: 'missing_key'; message: string } }

// Route-scoped env read — NOT a module-init throw. A missing voice-only
// secret must let /api/transcribe fail closed with 503 while the rest of
// Copilot keeps working, so importing this module must never throw.
export const readTranscriptionKey = (): ReadTranscriptionKeyResult => {
  const apiKey = process.env.TRANSCRIPTION_OPENAI_API_KEY
  if (apiKey === undefined || apiKey.trim() === '') {
    return {
      success: false,
      error: { code: 'missing_key', message: 'TRANSCRIPTION_OPENAI_API_KEY is not set' },
    }
  }
  return { success: true, data: apiKey }
}
