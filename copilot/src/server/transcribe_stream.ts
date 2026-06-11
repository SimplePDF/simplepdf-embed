import type { ServerErrorBody } from '../lib/api_envelope'
import { monitoring, normalizeError } from '../lib/monitoring'
import { recordingUploadFor } from '../lib/voice/recording_format'
import {
  MAX_TRANSCRIPT_CHARS,
  parseTranscriptDataLine,
  TRANSCRIPT_DELTA_EVENT,
  TRANSCRIPT_DONE_EVENT,
} from '../lib/voice/transcript_sse'
import { TRANSCRIPTION_MODEL_ID } from './transcription_model'

// Server-side streaming relay for the demo (SimplePDF-paid) transcription path
// (P070-02 Phase 5). The AI SDK's experimental_transcribe returns a complete
// result, so streaming bypasses it with a direct multipart POST + `stream: true`
// to OpenAI. The upstream SSE is PARSED and RE-EMITTED as sanitized
// `transcript.text.delta` / `.done` events carrying ONLY the transcript text —
// provider error events and unknown shapes are dropped, so no raw provider
// string ever reaches the browser (the same no-raw-provider-text contract the
// JSON route enforced via mapTranscriptionError). The wire shape is identical
// to the BYOK path, so the client consumer (`drainTranscriptSse`) is shared.
//
// Metering / auth / body validation all run in the route BEFORE this is called;
// this function owns only the paid upstream call + sanitized relay.

const OPENAI_TRANSCRIBE_URL = 'https://api.openai.com/v1/audio/transcriptions'

// A failure observed BEFORE the relay stream starts (non-OK upstream status,
// network error, timeout/abort to first byte). The route turns this into a
// sanitized JSON response with the right status — exactly as the old one-shot
// route did. Mid-stream failures can't become a JSON body (status 200 is
// already committed); they close the stream and the client maps the missing
// `done` event to a no-speech / service failure.
type PreStreamError = { status: number; body: ServerErrorBody; logReason: string }

export type StreamTranscriptionResult =
  | { ok: true; response: Response }
  | { ok: false; error: PreStreamError }

const mapPreStreamThrow = ({
  error,
  clientAborted,
}: {
  error: unknown
  clientAborted: boolean
}): PreStreamError => {
  if (clientAborted) {
    return {
      status: 503,
      body: { error: 'service_unavailable', reason: 'client_aborted' },
      logReason: 'client_aborted',
    }
  }
  if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
    return {
      status: 503,
      body: { error: 'service_unavailable', reason: 'upstream_timeout' },
      logReason: 'upstream_timeout',
    }
  }
  return {
    status: 503,
    body: { error: 'service_unavailable', reason: 'upstream_error' },
    logReason: `upstream_unknown:${normalizeError(error)}`,
  }
}

// Mirrors the old APICallError mapping: a provider 400 is the user's audio
// (sanitized bad_request); every other non-OK status is an upstream fault.
const mapUpstreamStatus = (status: number): PreStreamError => {
  if (status === 400) {
    return {
      status: 400,
      body: { error: 'bad_request', message: 'Could not transcribe the audio' },
      logReason: 'upstream_invalid_audio',
    }
  }
  return {
    status: 503,
    body: { error: 'service_unavailable', reason: 'upstream_error' },
    logReason: `upstream_status_${status}`,
  }
}

const sanitizedSse = (event: { delta: string } | { done: string }): string => {
  const payload =
    'delta' in event
      ? { type: TRANSCRIPT_DELTA_EVENT, delta: event.delta }
      : { type: TRANSCRIPT_DONE_EVENT, text: event.done }
  return `data: ${JSON.stringify(payload)}\n\n`
}

const buildSanitizedRelay = ({
  upstream,
  ipHash,
  bytes,
  startedAt,
}: {
  upstream: ReadableStream<Uint8Array>
  ipHash: string
  bytes: Uint8Array<ArrayBuffer>
  startedAt: number
}): ReadableStream<Uint8Array> => {
  const reader = upstream.getReader()
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  let buffer = ''
  let accumulated = ''
  let done: string | null = null
  return new ReadableStream<Uint8Array>({
    // Each pull reads upstream until it has at least one sanitized event to
    // enqueue, or the upstream closes — never resolving empty (dropped events
    // alone would otherwise stall the stream). Closing logs done/empty.
    async pull(controller) {
      try {
        while (true) {
          const chunk = await reader.read()
          if (chunk.done) {
            const finalText = done ?? accumulated
            if (finalText.trim() === '') {
              monitoring.warn('transcribe.empty', { ip_hash: ipHash, bytes: bytes.byteLength })
            } else {
              monitoring.info('transcribe.done', {
                ip_hash: ipHash,
                bytes: bytes.byteLength,
                elapsed_ms: Date.now() - startedAt,
                // Streaming's transcript.text.done event carries no language
                // field (the old one-shot SDK result did) — accepted telemetry
                // loss in exchange for progressive transcripts.
                language: 'unknown',
              })
            }
            controller.close()
            return
          }
          buffer += decoder.decode(chunk.value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''
          let enqueuedAny = false
          for (const line of lines) {
            const event = parseTranscriptDataLine(line)
            if (event === null) {
              // Dropped (provider error event / unknown shape) — never relayed.
              continue
            }
            if ('delta' in event) {
              accumulated += event.delta
            } else {
              done = event.done
            }
            controller.enqueue(encoder.encode(sanitizedSse(event)))
            enqueuedAny = true
          }
          if (accumulated.length > MAX_TRANSCRIPT_CHARS || (done?.length ?? 0) > MAX_TRANSCRIPT_CHARS) {
            // Defense-in-depth: an upstream that never stops streaming would
            // otherwise grow the buffer unbounded. Truncate cleanly; the client
            // caps too and surfaces a sanitized failure.
            monitoring.error('transcribe.failed', { ip_hash: ipHash, detail: 'transcript_cap_exceeded' })
            controller.close()
            return
          }
          if (enqueuedAny) {
            return
          }
        }
      } catch (error) {
        // Mid-stream upstream fault: close cleanly (200 + partial deltas were
        // already committed). The client sees no `done` and surfaces it; no raw
        // provider text is enqueued.
        monitoring.error('transcribe.failed', { ip_hash: ipHash, detail: `stream:${normalizeError(error)}` })
        controller.close()
      }
    },
    cancel() {
      void reader.cancel()
    },
  })
}

export const streamTranscription = async ({
  apiKey,
  bytes,
  mimeType,
  requestSignal,
  timeoutMs,
  ipHash,
  startedAt,
}: {
  apiKey: string
  bytes: Uint8Array<ArrayBuffer>
  // The recorded container's mime (from the request content-type) so the
  // upstream upload is named for its real format — Safari MP4 must not be sent
  // as `.webm`. Derived to a filename + Blob type via the recording-format owner.
  mimeType: string
  requestSignal: AbortSignal
  timeoutMs: number
  ipHash: string
  startedAt: number
}): Promise<StreamTranscriptionResult> => {
  const combined = AbortSignal.any([requestSignal, AbortSignal.timeout(timeoutMs)])
  const upload = recordingUploadFor(mimeType)
  const form = new FormData()
  form.append('model', TRANSCRIPTION_MODEL_ID)
  form.append('file', new Blob([bytes], { type: upload.type }), upload.fileName)
  form.append('stream', 'true')

  const opened = await (async (): Promise<
    { ok: true; response: Response } | { ok: false; error: unknown }
  > => {
    try {
      const response = await fetch(OPENAI_TRANSCRIBE_URL, {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}` },
        body: form,
        signal: combined,
      })
      return { ok: true, response }
    } catch (error) {
      return { ok: false, error }
    }
  })()
  if (!opened.ok) {
    return {
      ok: false,
      error: mapPreStreamThrow({ error: opened.error, clientAborted: requestSignal.aborted }),
    }
  }
  if (!opened.response.ok) {
    return { ok: false, error: mapUpstreamStatus(opened.response.status) }
  }
  if (opened.response.body === null) {
    return {
      ok: false,
      error: {
        status: 503,
        body: { error: 'service_unavailable', reason: 'upstream_error' },
        logReason: 'upstream_no_body',
      },
    }
  }
  return {
    ok: true,
    response: new Response(
      buildSanitizedRelay({ upstream: opened.response.body, ipHash, bytes, startedAt }),
      {
        status: 200,
        headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store' },
      },
    ),
  }
}
