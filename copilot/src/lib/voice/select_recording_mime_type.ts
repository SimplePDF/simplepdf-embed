// Probes MediaRecorder for an audio container we can both RECORD in the
// browser and SNIFF server-side (must match parseBinaryBody's allowlist:
// WebM/EBML or MP4/ftyp). Returns the first supported MIME type, or null —
// never a bare "" default, which would yield a blob the server can't sniff.
// Order matters: webm/opus (Chrome, Firefox) first, audio/mp4 (Safari) last.
const CANDIDATE_MIME_TYPES: readonly string[] = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']

export const selectRecordingMimeType = (): string | null => {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return null
  }
  return CANDIDATE_MIME_TYPES.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? null
}
