// Single owner of the voice-input error-code unions, shared by the recorder
// hook (lastError), the transcribe client (transport result), and the
// composer (inline error copy). Kept here at lib/voice/ — the lowest common
// ancestor of all three consumers — so no layer re-declares them.

// Server / transport failures, mapped exhaustively from ServerErrorBody by
// mapServerErrorBodyToTranscribeErrorCode. Each has localized composer copy.
export type TranscribeErrorCode =
  | 'bad_request'
  | 'rate_limited'
  | 'service_unavailable'
  | 'too_large'
  | 'unauthorized'
  | 'unsupported_media_type'

// The transcribe client's full result-error union. `cancelled` is a
// client-only outcome (fetch AbortError) and is deliberately NOT a
// ServerErrorBody code, so it must be modelled explicitly rather than cast.
export type TranscribeClientErrorCode = TranscribeErrorCode | 'cancelled'

// What the composer renders inline via `lastError`. Adds the local
// mic/recorder failures, which are not server codes and must not be forced
// through transcription error copy.
export type VoiceInputErrorCode =
  | TranscribeErrorCode
  | 'encoding_failed'
  | 'microphone_unavailable'
  | 'permission_denied'
  | 'recording_failed'

// The injected transcribe function's result (the global Result shape).
export type TranscribeFnResult =
  | { success: true; data: { text: string } }
  | { success: false; error: { code: TranscribeClientErrorCode; message: string } }
