import type { ZodType, z } from 'zod'
import type { ServerErrorBody } from '../lib/api_envelope'
import type { ContainerSignature } from '../lib/voice/recording_format'

// The exact ServerErrorBody variants this module can produce. Extracting
// them by `error` keeps each variant's full shape (including `message`),
// so a route handler can pass `failure.body` straight to `Response.json`
// and the result is `satisfies ServerErrorBody`-checkable end to end.
// Adding a new failure here forces a matching variant in ServerErrorBody
// and a status entry in the classifier map.
type BodyReadErrorBody = Extract<
  ServerErrorBody,
  { error: 'bad_request' | 'payload_too_large' | 'unsupported_media_type' }
>

export type BodyReadFailure = {
  success: false
  status: number
  body: BodyReadErrorBody
}

export type BodyReadSuccess = { success: true; text: string }

// `bytes` is a freshly-allocated, ArrayBuffer-backed view (concatChunks), so
// it is precisely typed for callers that need a `BlobPart` (the streaming
// transcription relay builds a Blob from it).
export type BinaryBodySuccess = { success: true; bytes: Uint8Array<ArrayBuffer> }

const encoder = new TextEncoder()

// Byte-accurate body-size enforcement. `text.length` measures UTF-16 code
// units, which under-counts multi-byte UTF-8 codepoints (emoji, CJK). A
// 256 KiB body of 4-byte codepoints would measure ~256k JS chars despite
// being ~1 MiB on the wire. We charge the raw UTF-8 byte length.
export const readBodyText = async ({
  request,
  maxBytes,
}: {
  request: Request
  maxBytes: number
}): Promise<BodyReadSuccess | BodyReadFailure> => {
  const declaredLength = Number.parseInt(request.headers.get('content-length') ?? '', 10)
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return tooLarge(maxBytes)
  }
  const text = await request.text()
  if (encoder.encode(text).byteLength > maxBytes) {
    return tooLarge(maxBytes)
  }
  return { success: true, text }
}

const tooLarge = (maxBytes: number): BodyReadFailure => ({
  success: false,
  status: 413,
  body: { error: 'payload_too_large', message: `Request body exceeds ${maxBytes} bytes` },
})

export const isJsonRequest = (request: Request): boolean =>
  (request.headers.get('content-type') ?? '').startsWith('application/json')

export const parseJsonBody = async <TSchema extends ZodType>({
  request,
  maxBytes,
  schema,
  schemaErrorMessage,
}: {
  request: Request
  maxBytes: number
  schema: TSchema
  schemaErrorMessage: string
}): Promise<{ success: true; data: z.infer<TSchema> } | BodyReadFailure> => {
  if (!isJsonRequest(request)) {
    return {
      success: false,
      status: 415,
      body: { error: 'unsupported_media_type', message: 'Expected application/json' },
    }
  }
  const bodyRead = await readBodyText({ request, maxBytes })
  if (!bodyRead.success) {
    return bodyRead
  }
  if (bodyRead.text === '') {
    return { success: false, status: 400, body: { error: 'bad_request', message: 'Empty request body' } }
  }
  const jsonParsed = ((): unknown => {
    try {
      return JSON.parse(bodyRead.text)
    } catch {
      return null
    }
  })()
  if (jsonParsed === null) {
    return { success: false, status: 400, body: { error: 'bad_request', message: 'Invalid JSON body' } }
  }
  const schemaParsed = schema.safeParse(jsonParsed)
  if (!schemaParsed.success) {
    return {
      success: false,
      status: 400,
      body: { error: 'bad_request', message: schemaErrorMessage },
    }
  }
  return { success: true, data: schemaParsed.data }
}

const emptyBody = (): BodyReadFailure => ({
  success: false,
  status: 400,
  body: { error: 'bad_request', message: 'Empty request body' },
})

const matchesContainer = ({
  bytes,
  signature,
}: {
  bytes: Uint8Array
  signature: ContainerSignature
}): boolean =>
  // `bytes[outOfRange]` is `undefined`, which never equals a numeric byte, so
  // a too-short buffer fails the match without an explicit length guard.
  signature.magic.every((value, index) => bytes[signature.offset + index] === value)

const concatChunks = ({
  chunks,
  total,
}: {
  chunks: Uint8Array[]
  total: number
}): Uint8Array<ArrayBuffer> => {
  const out = new Uint8Array(total)
  // Plain offset-tracking copy (not `reduce`, whose accumulator we'd discard):
  // `let` is the natural form for a perf-path buffer fill.
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}

// Streaming capped read for raw binary uploads (used by /api/transcribe).
// Unlike readBodyText it NEVER trusts Content-Length and NEVER calls an
// unbounded `arrayBuffer()`: it drains `request.body` chunk by chunk and
// aborts the moment the running total exceeds `maxBytes`, so memory stays
// bounded even when a caller lies about the length. After a successful read
// it rejects an empty body and enforces the container allowlist on the
// leading bytes before the caller hands the audio to any paid provider.
export const parseBinaryBody = async ({
  request,
  maxBytes,
  allowedContainers,
}: {
  request: Request
  maxBytes: number
  allowedContainers: readonly ContainerSignature[]
}): Promise<BinaryBodySuccess | BodyReadFailure> => {
  if (request.body === null) {
    return emptyBody()
  }
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  const drained = await (async (): Promise<
    { ok: true; total: number } | { ok: false; failure: BodyReadFailure }
  > => {
    let total = 0
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          return { ok: true, total }
        }
        total += value.byteLength
        if (total > maxBytes) {
          await reader.cancel()
          return { ok: false, failure: tooLarge(maxBytes) }
        }
        chunks.push(value)
      }
    } catch {
      // Client disconnect or a torn stream mid-read. The response is moot if
      // the socket is gone; 400 is a safe, sanitized fallback otherwise.
      return {
        ok: false,
        failure: {
          success: false,
          status: 400,
          body: { error: 'bad_request', message: 'Failed to read request body' },
        },
      }
    }
  })()
  if (!drained.ok) {
    return drained.failure
  }
  if (drained.total === 0) {
    return emptyBody()
  }
  const bytes = concatChunks({ chunks, total: drained.total })
  const isAllowed = allowedContainers.some((signature) => matchesContainer({ bytes, signature }))
  if (!isAllowed) {
    return {
      success: false,
      status: 415,
      body: { error: 'unsupported_media_type', message: 'Unsupported audio container' },
    }
  }
  return { success: true, bytes }
}

// Abuse guard: an attacker can craft a messages array ending in a fake
// tool-result (role !== 'user') and get unlimited uncounted POSTs. Track how
// many non-user tail turns a given IP has chained; past the cap, treat the
// next request as fresh and charge it against the lifetime counter.
//
// The counter map is bounded by MAX_TRACKED_IPS; oldest inserted key is
// evicted on overflow to keep memory finite across unique-IP churn.
const MAX_CONSECUTIVE_NON_USER_TURNS = 10
const MAX_TRACKED_IPS = 10_000
const consecutiveNonUserTurns = new Map<string, number>()

const touch = (ipHash: string, value: number): void => {
  // Re-insert so LRU order reflects most recent activity. `Map` iteration
  // order is insertion order, so delete-then-set moves this key to the end.
  consecutiveNonUserTurns.delete(ipHash)
  consecutiveNonUserTurns.set(ipHash, value)
  if (consecutiveNonUserTurns.size > MAX_TRACKED_IPS) {
    const oldest = consecutiveNonUserTurns.keys().next().value
    if (oldest !== undefined) {
      consecutiveNonUserTurns.delete(oldest)
    }
  }
}

export const shouldChargeAgainstLimit = ({
  ipHash,
  freshUserTurn,
}: {
  ipHash: string
  freshUserTurn: boolean
}): boolean => {
  if (freshUserTurn) {
    touch(ipHash, 0)
    return true
  }
  const current = consecutiveNonUserTurns.get(ipHash) ?? 0
  const next = current + 1
  if (next >= MAX_CONSECUTIVE_NON_USER_TURNS) {
    touch(ipHash, 0)
    return true
  }
  touch(ipHash, next)
  return false
}
