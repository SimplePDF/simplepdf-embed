import type { ByokSttConfig } from '../byok/providers'
import { transcribeByokStreaming } from './transcribe_byok_streaming'

// Save-time validation for a BYOK STT config (P070-02 V1 #8 / V2 #6 / V3 #5).
// It runs a REAL browser-direct transcription of a FORMAT-MATCHED speech
// fixture (the same container the browser records: WebM/Opus or MP4/AAC) and
// only passes on a non-empty normalized transcript — so it proves the exact
// transport/auth/model path a real recording will use. It uses the SAME
// streaming path the runtime uses (transcribeByokStreaming, `stream: true`),
// not a separate one-shot probe: a custom endpoint that transcribes but does
// not support SSE streaming would fail at runtime, so validation must exercise
// streaming to catch that. Deltas are ignored here; the function already
// enforces the non-empty predicate (empty → bad_request) and sanitizes errors.

export type SttValidationErrorCode = 'auth' | 'no_transcript' | 'reach' | 'unsupported'

export type SttValidationResult = { kind: 'valid' } | { kind: 'invalid'; code: SttValidationErrorCode }

export const validateSttConfig = async ({
  config,
  fixtureBytes,
  signal,
}: {
  config: ByokSttConfig
  fixtureBytes: Uint8Array<ArrayBuffer>
  signal: AbortSignal
}): Promise<SttValidationResult> => {
  const result = await transcribeByokStreaming({
    audioBytes: fixtureBytes,
    signal,
    config,
    onDelta: () => {},
  })
  if (result.success) {
    return { kind: 'valid' }
  }
  switch (result.error.code) {
    case 'unauthorized':
      return { kind: 'invalid', code: 'auth' }
    case 'bad_request':
      // The fixture is real speech, so an empty/invalid-audio result means the
      // transcription path itself is broken (wrong model, bad endpoint shape).
      return { kind: 'invalid', code: 'no_transcript' }
    case 'unsupported_media_type':
    case 'too_large':
      return { kind: 'invalid', code: 'unsupported' }
    case 'rate_limited':
    case 'service_unavailable':
    case 'cancelled':
      return { kind: 'invalid', code: 'reach' }
    default:
      result.error.code satisfies never
      return { kind: 'invalid', code: 'reach' }
  }
}
