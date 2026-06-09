import { afterEach, describe, expect, it, vi } from 'vitest'
import { selectRecordingMimeType } from './select_recording_mime_type'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('selectRecordingMimeType', () => {
  it('returns null when MediaRecorder is unavailable', () => {
    expect(selectRecordingMimeType()).toBeNull()
  })

  it('prefers webm/opus when everything is supported', () => {
    vi.stubGlobal('MediaRecorder', { isTypeSupported: () => true })
    expect(selectRecordingMimeType()).toBe('audio/webm;codecs=opus')
  })

  it('falls back to the first supported candidate (Safari → audio/mp4)', () => {
    vi.stubGlobal('MediaRecorder', { isTypeSupported: (type: string) => type === 'audio/mp4' })
    expect(selectRecordingMimeType()).toBe('audio/mp4')
  })

  it('returns null when no candidate is supported', () => {
    vi.stubGlobal('MediaRecorder', { isTypeSupported: () => false })
    expect(selectRecordingMimeType()).toBeNull()
  })
})
