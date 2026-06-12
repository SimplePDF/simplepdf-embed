import type { VoiceInputErrorCode } from './error_codes'

// Maps every composer-facing voice error to its localized copy key. Exhaustive
// (`default: code satisfies never`) so a new VoiceInputErrorCode cannot ship
// without a string.
export const voiceErrorTranslationKey = (code: VoiceInputErrorCode): string => {
  switch (code) {
    case 'permission_denied':
      return 'voice.errorPermissionDenied'
    case 'microphone_unavailable':
      return 'voice.errorMicrophoneUnavailable'
    case 'recording_failed':
      return 'voice.errorRecordingFailed'
    case 'encoding_failed':
      return 'voice.errorEncodingFailed'
    case 'unauthorized':
      return 'voice.errorUnauthorized'
    case 'rate_limited':
      return 'voice.errorRateLimited'
    case 'too_large':
      return 'voice.errorTooLarge'
    case 'unsupported_media_type':
      return 'voice.errorUnsupportedMediaType'
    case 'bad_request':
      return 'voice.errorBadRequest'
    case 'service_unavailable':
      return 'voice.errorServiceUnavailable'
    default:
      code satisfies never
      return 'voice.errorServiceUnavailable'
  }
}
