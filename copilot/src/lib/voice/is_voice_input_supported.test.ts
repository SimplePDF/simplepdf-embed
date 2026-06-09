import { afterEach, describe, expect, it, vi } from 'vitest'
import { isVoiceInputSupported } from './is_voice_input_supported'

afterEach(() => {
  vi.unstubAllGlobals()
})

const stubSupported = (): void => {
  vi.stubGlobal('window', { isSecureContext: true })
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: () => undefined } })
  vi.stubGlobal('MediaRecorder', { isTypeSupported: () => true })
}

describe('isVoiceInputSupported', () => {
  it('false when window is absent (SSR)', () => {
    vi.stubGlobal('window', undefined)
    expect(isVoiceInputSupported()).toBe(false)
  })

  it('false in an insecure context', () => {
    vi.stubGlobal('window', { isSecureContext: false })
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: () => undefined } })
    vi.stubGlobal('MediaRecorder', { isTypeSupported: () => true })
    expect(isVoiceInputSupported()).toBe(false)
  })

  it('false when mediaDevices is unavailable', () => {
    vi.stubGlobal('window', { isSecureContext: true })
    vi.stubGlobal('navigator', {})
    vi.stubGlobal('MediaRecorder', { isTypeSupported: () => true })
    expect(isVoiceInputSupported()).toBe(false)
  })

  it('false when no recordable MIME type exists', () => {
    vi.stubGlobal('window', { isSecureContext: true })
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: () => undefined } })
    vi.stubGlobal('MediaRecorder', { isTypeSupported: () => false })
    expect(isVoiceInputSupported()).toBe(false)
  })

  it('true only when every condition holds', () => {
    stubSupported()
    expect(isVoiceInputSupported()).toBe(true)
  })
})
