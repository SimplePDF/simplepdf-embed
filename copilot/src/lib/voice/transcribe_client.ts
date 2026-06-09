import { z } from 'zod'
import type { ServerErrorBody } from '../api_envelope'
import type { TranscribeClientErrorCode, TranscribeErrorCode, TranscribeFnResult } from './error_codes'
import { parseServerErrorResponse } from './parse_server_error_response'

const TranscribeResponse = z.object({ text: z.string() })

// Exhaustive map of every ServerErrorBody variant /api/transcribe (including
// applyDemoPreflight) can return → the small UI-facing TranscribeErrorCode.
// `misconfigured_environment` is an operator/server fault, not an entitlement
// problem, so it maps to service_unavailable (never auth copy that blames the
// invite). `default: body.error satisfies never` forces this to stay total.
export const mapServerErrorBodyToTranscribeErrorCode = (body: ServerErrorBody): TranscribeErrorCode => {
  switch (body.error) {
    case 'forbidden_blocked':
    case 'forbidden_origin':
    case 'share_required':
      return 'unauthorized'
    case 'misconfigured_environment':
      return 'service_unavailable'
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

const parseSuccessBody = async (response: Response): Promise<TranscribeFnResult> => {
  const text = await response.text()
  const json = ((): unknown => {
    try {
      return JSON.parse(text)
    } catch {
      return null
    }
  })()
  const parsed = TranscribeResponse.safeParse(json)
  if (!parsed.success) {
    return failure('service_unavailable', 'transcribe response body was not { text }')
  }
  return { success: true, data: { text: parsed.data.text } }
}

// The injected transcribe implementation. Explicit args (no shareIdRef
// reach-in) — `shareId` is a known-valid demo share captured by chat_pane.
// POST the raw Blob with `?share=` and its content-type, mirroring the chat
// transport. AbortError → 'cancelled' (the hook treats it as a silent
// discard); every other failure routes through the sanitized server-error
// parser + exhaustive code map.
export const transcribeClient = async ({
  blob,
  shareId,
  signal,
}: {
  blob: Blob
  shareId: string
  signal: AbortSignal
}): Promise<TranscribeFnResult> => {
  const url = new URL('/api/transcribe', window.location.origin)
  url.searchParams.set('share', shareId)
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
      if (error instanceof Error && error.name === 'AbortError') {
        return { ok: false, code: 'cancelled' }
      }
      return { ok: false, code: 'service_unavailable' }
    }
  })()
  if (!fetched.ok) {
    return failure(fetched.code, `transcribe fetch failed: ${fetched.code}`)
  }
  if (fetched.response.ok) {
    return parseSuccessBody(fetched.response)
  }
  const errorBody = await parseServerErrorResponse(fetched.response)
  return failure(
    mapServerErrorBodyToTranscribeErrorCode(errorBody),
    `transcribe rejected: ${errorBody.error}`,
  )
}
