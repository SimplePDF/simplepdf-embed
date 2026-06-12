import { describe, expect, it } from 'vitest'
import {
  isAcceptedRecordingMime,
  RECORDING_CONTAINER_SIGNATURES,
  RECORDING_MAX_BYTES,
  RECORDING_MIME_CANDIDATES,
} from './recording_format'

describe('recording_format (single owner)', () => {
  it('exposes the client probe order (webm/opus first, mp4 last)', () => {
    expect(RECORDING_MIME_CANDIDATES).toEqual(['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'])
  })

  it('exposes the server container signatures (EBML @0, ftyp @4)', () => {
    expect(RECORDING_CONTAINER_SIGNATURES).toEqual([
      { offset: 0, magic: [0x1a, 0x45, 0xdf, 0xa3] },
      { offset: 4, magic: [0x66, 0x74, 0x79, 0x70] },
    ])
  })

  it('caps uploads at 5 MiB', () => {
    expect(RECORDING_MAX_BYTES).toBe(5 * 1024 * 1024)
  })

  it('accepts recorded MIME types (incl. codecs= suffix), rejects others', () => {
    expect(isAcceptedRecordingMime('audio/webm;codecs=opus')).toBe(true)
    expect(isAcceptedRecordingMime('audio/webm')).toBe(true)
    expect(isAcceptedRecordingMime('audio/mp4')).toBe(true)
    expect(isAcceptedRecordingMime('AUDIO/WEBM')).toBe(true)
    expect(isAcceptedRecordingMime('audio/wav')).toBe(false)
    expect(isAcceptedRecordingMime('video/webm')).toBe(false)
    expect(isAcceptedRecordingMime('')).toBe(false)
  })
})
