import { selectRecordingMimeType } from './select_recording_mime_type'

// SSR-crash-safe capability probe. Returns false outside a secure browser
// context, or when no recordable+sniffable MIME type exists, so the mic stays
// hidden wherever voice can't work. Pure (no React) — render-path code must
// read it through the hydration-safe useVoiceInputSupport(), never inline.
export const isVoiceInputSupported = (): boolean => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false
  }
  if (!window.isSecureContext) {
    return false
  }
  if (navigator.mediaDevices === undefined || typeof navigator.mediaDevices.getUserMedia !== 'function') {
    return false
  }
  return selectRecordingMimeType() !== null
}
