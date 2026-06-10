import { RECORDING_MIME_CANDIDATES } from './recording_format'

// Probes MediaRecorder for an audio container we can both RECORD in the
// browser and SNIFF server-side. The candidate order + the server's
// container allowlist share one owner (recording_format.ts) so they cannot
// drift. Returns the first supported MIME type, or null — never a bare ""
// default, which would yield a blob the server can't sniff.
export const selectRecordingMimeType = (): string | null => {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return null
  }
  return RECORDING_MIME_CANDIDATES.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? null
}
