import { createFileRoute } from '@tanstack/react-router'
import type { ServerErrorBody } from '../../lib/api_envelope'
import { monitoring, normalizeError } from '../../lib/monitoring'
import { RECORDING_CONTAINER_SIGNATURES, RECORDING_MAX_BYTES } from '../../lib/voice/recording_format'
import { applyDemoPreflight } from '../../server/demo/gate'
import { parseBinaryBody } from '../../server/http'
import { type RateLimitDecision, rateLimiter } from '../../server/rate_limit'
import { streamTranscription } from '../../server/transcribe_stream'
import { readTranscriptionKey } from '../../server/transcription_model'

// Byte cap (RECORDING_MAX_BYTES) and container allowlist come from the single
// recording-format owner so client and server can't drift. Timeout bounds
// provider wall-clock per call.
const TRANSCRIBE_TIMEOUT_MS = 30_000

// Authoritative route order (D23): preflight -> key -> isReady -> check
// (charge every admitted attempt) -> body -> provider. Missing key and a
// down limiter fail closed (503) WITHOUT charging and WITHOUT reading the
// body; every other admitted attempt — including malformed/oversize/
// unsupported uploads — is metered, so a leaked share can't be an unmetered
// 5 MiB upload sink. Exported for the route security test matrix.
export const transcribePostHandler = async ({ request }: { request: Request }): Promise<Response> => {
  const preflight = await applyDemoPreflight(request)
  if (preflight.kind === 'response') {
    return preflight.response
  }
  const { ipHash, resolution } = preflight

  const keyResult = readTranscriptionKey()
  if (!keyResult.success) {
    monitoring.error('transcribe.missing_key', { ip_hash: ipHash })
    return Response.json(
      { error: 'service_unavailable', reason: 'transcription_unavailable' } satisfies ServerErrorBody,
      { status: 503 },
    )
  }

  if (!rateLimiter.isReady()) {
    monitoring.error('transcribe.blocked_system_failure', {
      ip_hash: null,
      detail: rateLimiter.statusDetail(),
    })
    return Response.json(
      { error: 'service_unavailable', reason: 'rate_limit_unavailable' } satisfies ServerErrorBody,
      { status: 503 },
    )
  }

  const decision = await (async (): Promise<RateLimitDecision> => {
    try {
      return await rateLimiter.check({
        bucket: resolution.bucket,
        ipHash,
        lifetime: resolution.lifetime,
      })
    } catch (error) {
      const detail = normalizeError(error)
      monitoring.error('transcribe.rate_limit_threw', { ip_hash: ipHash, detail })
      return { allowed: false, reason: 'system_failure', detail: `threw:${detail}` }
    }
  })()
  if (!decision.allowed) {
    if (decision.reason === 'system_failure') {
      monitoring.error('transcribe.blocked_system_failure', {
        ip_hash: ipHash,
        detail: decision.detail,
      })
      return Response.json(
        { error: 'service_unavailable', reason: 'rate_limit_unavailable' } satisfies ServerErrorBody,
        { status: 503 },
      )
    }
    return Response.json({ error: 'rate_limited', reason: decision.reason } satisfies ServerErrorBody, {
      status: 429,
    })
  }

  const body = await parseBinaryBody({
    request,
    maxBytes: RECORDING_MAX_BYTES,
    allowedContainers: RECORDING_CONTAINER_SIGNATURES,
  })
  if (!body.success) {
    return Response.json(body.body satisfies ServerErrorBody, { status: body.status })
  }

  // Stream the transcript as a sanitized `text/event-stream` (P070-02 Phase 5).
  // streamTranscription owns the paid upstream call + relay; a pre-stream
  // failure (auth/timeout/abort/upstream status) comes back as a sanitized JSON
  // error with the right status. The empty / no-speech case can no longer be a
  // 400 (status 200 is committed before the first byte), so the client maps an
  // empty stream to bad_request — the relay logs transcribe.empty / .done.
  const startedAt = Date.now()
  const streamed = await streamTranscription({
    apiKey: keyResult.data,
    bytes: body.bytes,
    // The client posts the recording with its container content-type; forward
    // it so the upstream upload is named for the real format (Safari MP4).
    mimeType: request.headers.get('content-type') ?? '',
    requestSignal: request.signal,
    timeoutMs: TRANSCRIBE_TIMEOUT_MS,
    ipHash,
    startedAt,
  })
  if (!streamed.ok) {
    monitoring.error('transcribe.failed', { ip_hash: ipHash, detail: streamed.error.logReason })
    return Response.json(streamed.error.body satisfies ServerErrorBody, { status: streamed.error.status })
  }
  return streamed.response
}

export const Route = createFileRoute('/api/transcribe')({
  server: {
    handlers: {
      POST: transcribePostHandler,
    },
  },
})
