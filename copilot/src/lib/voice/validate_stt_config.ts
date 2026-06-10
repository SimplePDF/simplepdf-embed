import type { ByokSttConfig } from '../byok/providers'
import { transcribeByok } from './transcribe_byok'

// Save-time validation for a BYOK STT config (P070-02 V1 #8 / V2 #6 / V3 #5).
// It runs a REAL browser-direct transcription of a FORMAT-MATCHED speech
// fixture (the same container the browser records: WebM/Opus or MP4/AAC) and
// only passes on a non-empty normalized transcript — so it proves the exact
// transport/auth/model path a real recording will use, not a different media
// path. transcribeByok already enforces the non-empty predicate (an empty
// transcript maps to bad_request) and sanitizes provider errors.

export type SttValidationErrorCode = 'auth' | 'no_transcript' | 'reach' | 'unsupported'

export type SttValidationResult = { kind: 'valid' } | { kind: 'invalid'; code: SttValidationErrorCode }

export const validateSttConfig = async ({
  config,
  fixtureBytes,
  signal,
}: {
  config: ByokSttConfig
  fixtureBytes: Uint8Array
  signal: AbortSignal
}): Promise<SttValidationResult> => {
  const result = await transcribeByok({ audioBytes: fixtureBytes, signal, config })
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
