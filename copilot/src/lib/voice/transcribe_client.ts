import type { ServerErrorBody } from '../api_envelope'
import {
  classifyFetchError,
  type TranscribeClientErrorCode,
  type TranscribeErrorCode,
  type TranscribeFnResult,
} from './error_codes'
import { parseServerErrorResponse } from './parse_server_error_response'
import { drainTranscriptSse } from './transcript_sse'

// Exhaustive map of every ServerErrorBody variant /api/transcribe (including
// applyDemoPreflight) can return → the small UI-facing TranscribeErrorCode.
// `default: body satisfies never` forces this to stay total.
export const mapServerErrorBodyToTranscribeErrorCode = (body: ServerErrorBody): TranscribeErrorCode => {
  switch (body.error) {
    case 'forbidden_blocked':
    case 'forbidden_origin':
      return 'unauthorized'
    case 'rate_limited':
      return 'rate_limited'
    case 'payload_too_large':
      return 'too_large'
    case 'unsupported_media_type':
      return 'unsupported_media_type'
    case 'bad_request':
      return 'bad_request'
    case 'service_unavailable':
      return 'service_unavailable'
    default:
      body satisfies never
      return 'service_unavailable'
  }
}

const failure = (code: TranscribeClientErrorCode, message: string): TranscribeFnResult => ({
  success: false,
  error: { code, message },
})

// The injected transcribe implementation. POST the raw Blob with its
// content-type, mirroring the chat transport (demo mode is config-gated
// server-side, so no entitlement token rides on the request). On success the
// route streams a `text/event-stream` of transcript deltas (P070-02 Phase 5)
// drained by the shared owner — `onDelta` fills the composer as text arrives,
// same as the BYOK path. AbortError → 'cancelled' (the hook treats it as a
// silent discard); every other failure routes through the sanitized
// server-error parser + exhaustive code map.
export const transcribeClient = async ({
  blob,
  signal,
  onDelta,
}: {
  blob: Blob
  signal: AbortSignal
  onDelta: (textSoFar: string) => void
}): Promise<TranscribeFnResult> => {
  const url = new URL('/api/transcribe', window.location.origin)
  const fetched = await (async (): Promise<
    { ok: true; response: Response } | { ok: false; code: TranscribeClientErrorCode }
  > => {
    try {
      const response = await window.fetch(url, {
        method: 'POST',
        body: blob,
        signal,
        headers: { 'content-type': blob.type },
      })
      return { ok: true, response }
    } catch (error) {
      return { ok: false, code: classifyFetchError(error) }
    }
  })()
  if (!fetched.ok) {
    return failure(fetched.code, `transcribe fetch failed: ${fetched.code}`)
  }
  if (fetched.response.ok) {
    if (fetched.response.body === null) {
      return failure('service_unavailable', 'transcribe response had no body')
    }
    const drained = await drainTranscriptSse({
      body: fetched.response.body,
      onDelta,
      isAborted: () => signal.aborted,
    })
    if (!drained.ok) {
      return failure(drained.code, `transcribe stream failed: ${drained.code}`)
    }
    return { success: true, data: { text: drained.text } }
  }
  const errorBody = await parseServerErrorResponse(fetched.response)
  return failure(
    mapServerErrorBodyToTranscribeErrorCode(errorBody),
    `transcribe rejected: ${errorBody.error}`,
  )
}
