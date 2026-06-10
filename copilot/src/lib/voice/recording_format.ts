// Single owner of the recording-format contract (P070-02, V3 #4). The client
// recorder, the BYOK browser-direct conversion, and the server transcription
// route all derive their byte cap, MIME allowlist, and container signatures
// from this one tuple — so client and server can never drift on what audio is
// accepted. Pure constants/types: safe to import from both client and server.

// Bounds upload size / memory per request (NOT duration — see P070 D10). The
// server route and the BYOK conversion both enforce it.
export const RECORDING_MAX_BYTES = 5 * 1024 * 1024

// Leading-bytes signature of an accepted container (EBML for WebM at 0, MP4
// `ftyp` at 4). An allowlist, not proof of an audio track.
export type ContainerSignature = { offset: number; magic: readonly number[] }

type RecordingFormat = {
  container: 'mp4' | 'webm'
  // Probed in order by selectRecordingMimeType(); most specific first.
  mimeCandidates: readonly string[]
  signature: ContainerSignature
}

const RECORDING_FORMATS: readonly RecordingFormat[] = [
  {
    container: 'webm',
    mimeCandidates: ['audio/webm;codecs=opus', 'audio/webm'],
    signature: { offset: 0, magic: [0x1a, 0x45, 0xdf, 0xa3] },
  },
  {
    container: 'mp4',
    mimeCandidates: ['audio/mp4'],
    signature: { offset: 4, magic: [0x66, 0x74, 0x79, 0x70] },
  },
]

// Client probe order (selectRecordingMimeType): webm/opus → webm → mp4.
export const RECORDING_MIME_CANDIDATES: readonly string[] = RECORDING_FORMATS.flatMap(
  (format) => format.mimeCandidates,
)

// Server container allowlist (parseBinaryBody).
export const RECORDING_CONTAINER_SIGNATURES: readonly ContainerSignature[] = RECORDING_FORMATS.map(
  (format) => format.signature,
)

// Accepted container base MIME types (no codecs= suffix). The BYOK conversion
// checks a recorded blob's type against this before sending it browser-direct.
const ACCEPTED_BASE_MIME_TYPES: readonly string[] = RECORDING_FORMATS.map(
  (format) => `audio/${format.container}`,
)

export const isAcceptedRecordingMime = (mimeType: string): boolean => {
  const base = mimeType.split(';')[0]?.trim().toLowerCase() ?? ''
  return ACCEPTED_BASE_MIME_TYPES.includes(base)
}
