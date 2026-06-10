import { createFileRoute } from '@tanstack/react-router'
import { APICallError, experimental_transcribe, NoTranscriptGeneratedError } from 'ai'
import type { ServerErrorBody } from '../../lib/api_envelope'
import { monitoring, normalizeError } from '../../lib/monitoring'
import { RECORDING_CONTAINER_SIGNATURES, RECORDING_MAX_BYTES } from '../../lib/voice/recording_format'
import { applyDemoPreflight } from '../../server/demo/gate'
import { parseBinaryBody } from '../../server/http'
import { type RateLimitDecision, rateLimiter } from '../../server/rate_limit'
import { buildTranscriptionModel, readTranscriptionKey } from '../../server/transcription_model'

// Byte cap (RECORDING_MAX_BYTES) and container allowlist come from the single
// recording-format owner so client and server can't drift. Timeout bounds
// provider wall-clock per call.
const TRANSCRIBE_TIMEOUT_MS = 30_000

type TranscribeOutcome =
  | { ok: true; text: string; language: string | undefined }
  | { ok: false; error: unknown }

const isAbortLike = (error: unknown): boolean =>
  error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')

// Maps an upstream failure to a SANITIZED ServerErrorBody — never leaks a raw
// provider string. Reuses existing codes only (a new code would break
// SERVER_ERROR_TO_STATUS). `clientAborted` is checked first: a disconnected
// client never reads the response, but the combined abort signal already
// stopped the paid upstream call.
const mapTranscriptionError = ({
  error,
  clientAborted,
}: {
  error: unknown
  clientAborted: boolean
}): { status: number; body: ServerErrorBody; logReason: string } => {
  if (clientAborted) {
    return {
      status: 503,
      body: { error: 'service_unavailable', reason: 'client_aborted' },
      logReason: 'client_aborted',
    }
  }
  if (isAbortLike(error)) {
    return {
      status: 503,
      body: { error: 'service_unavailable', reason: 'upstream_timeout' },
      logReason: 'upstream_timeout',
    }
  }
  if (NoTranscriptGeneratedError.isInstance(error)) {
    return {
      status: 400,
      body: { error: 'bad_request', message: 'No speech detected in the audio' },
      logReason: 'no_transcript',
    }
  }
  if (APICallError.isInstance(error)) {
    if (error.statusCode === 400) {
      return {
        status: 400,
        body: { error: 'bad_request', message: 'Could not transcribe the audio' },
        logReason: 'upstream_invalid_audio',
      }
    }
    return {
      status: 503,
      body: { error: 'service_unavailable', reason: 'upstream_error' },
      logReason: `upstream_status_${error.statusCode ?? 'unknown'}`,
    }
  }
  return {
    status: 503,
    body: { error: 'service_unavailable', reason: 'upstream_error' },
    logReason: 'upstream_unknown',
  }
}

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

  const startedAt = Date.now()
  const outcome = await (async (): Promise<TranscribeOutcome> => {
    try {
      const transcription = await experimental_transcribe({
        model: buildTranscriptionModel({ apiKey: keyResult.data }),
        audio: body.bytes,
        abortSignal: AbortSignal.any([request.signal, AbortSignal.timeout(TRANSCRIBE_TIMEOUT_MS)]),
        maxRetries: 1,
      })
      return { ok: true, text: transcription.text, language: transcription.language }
    } catch (error) {
      return { ok: false, error }
    }
  })()

  if (!outcome.ok) {
    const mapped = mapTranscriptionError({
      error: outcome.error,
      clientAborted: request.signal.aborted,
    })
    monitoring.error('transcribe.failed', {
      ip_hash: ipHash,
      detail: `${mapped.logReason}:${normalizeError(outcome.error)}`,
    })
    return Response.json(mapped.body satisfies ServerErrorBody, { status: mapped.status })
  }

  if (outcome.text.trim() === '') {
    // Expected outcome (the user recorded silence), not a server fault — warn,
    // never error (error level is always-on in production).
    monitoring.warn('transcribe.empty', { ip_hash: ipHash, bytes: body.bytes.byteLength })
    return Response.json(
      { error: 'bad_request', message: 'No speech detected in the audio' } satisfies ServerErrorBody,
      { status: 400 },
    )
  }

  monitoring.info('transcribe.done', {
    ip_hash: ipHash,
    bytes: body.bytes.byteLength,
    elapsed_ms: Date.now() - startedAt,
    language: outcome.language ?? 'unknown',
  })
  return Response.json({ text: outcome.text })
}

export const Route = createFileRoute('/api/transcribe')({
  server: {
    handlers: {
      POST: transcribePostHandler,
    },
  },
})
