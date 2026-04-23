import type { ZodError, ZodType, z } from 'zod'

export type BodyReadFailure = {
  success: false
  status: number
  error: string
  message: string
}

export type BodyReadSuccess = { success: true; text: string }

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
  error: 'payload_too_large',
  message: `Request body exceeds ${maxBytes} bytes`,
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
}): Promise<
  | { success: true; data: z.infer<TSchema> }
  | BodyReadFailure
  | { success: false; status: number; error: string; message: string; issues?: ZodError['issues'] }
> => {
  if (!isJsonRequest(request)) {
    return {
      success: false,
      status: 415,
      error: 'unsupported_media_type',
      message: 'Expected application/json',
    }
  }
  const bodyRead = await readBodyText({ request, maxBytes })
  if (!bodyRead.success) {
    return bodyRead
  }
  if (bodyRead.text === '') {
    return { success: false, status: 400, error: 'bad_request', message: 'Empty request body' }
  }
  const jsonParsed = ((): unknown => {
    try {
      return JSON.parse(bodyRead.text)
    } catch {
      return null
    }
  })()
  if (jsonParsed === null) {
    return { success: false, status: 400, error: 'bad_request', message: 'Invalid JSON body' }
  }
  const schemaParsed = schema.safeParse(jsonParsed)
  if (!schemaParsed.success) {
    return {
      success: false,
      status: 400,
      error: 'bad_request',
      message: schemaErrorMessage,
      issues: schemaParsed.error.issues,
    }
  }
  return { success: true, data: schemaParsed.data }
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
