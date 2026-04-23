import { z } from 'zod'

// Invite-link BYOK path. SHARED_API_KEYS is a stringified JSON map of
// share-id -> { api_key, rate_limit_turns_lifetime }. Each share carries its
// own lifetime cap so different invites can have different budgets. Share-id
// values are never logged.
//
// Deployment modes:
//   1. Open demo       : ANTHROPIC_API_KEY set, SHARED_API_KEYS unset. The
//                        RATE_LIMIT_LIFETIME env caps the default bucket.
//   2. Hybrid          : both set. ?share= picks a dedicated key + its own
//                        lifetime cap. No ?share= falls back to the default.
//   3. Invite-only     : SHARED_API_KEYS set, ANTHROPIC_API_KEY unset. A
//                        missing / invalid ?share= returns 401 share_required.

const ShareConfigSchema = z.object({
  api_key: z.string().min(1),
  rate_limit_turns_lifetime: z.number().int().positive(),
})

const SharedKeysSchema = z.record(z.string(), ShareConfigSchema)

type ShareConfig = z.infer<typeof ShareConfigSchema>

const DEFAULT_BUCKET = '__default__'

export type SharedKeyResolution =
  | { kind: 'shared'; apiKey: string; lifetime: number; bucket: string }
  | { kind: 'default'; apiKey: string; lifetime: number; bucket: string }
  | { kind: 'share_required' }
  | { kind: 'server_misconfigured' }

const parseSharedKeys = (): ReadonlyMap<string, ShareConfig> => {
  const raw = process.env.SHARED_API_KEYS
  if (raw === undefined || raw.trim() === '') {
    return new Map()
  }
  const jsonParsed = ((): unknown => {
    try {
      return JSON.parse(raw)
    } catch {
      console.warn('[copilot] shared_keys.parse_failed', { reason: 'invalid_json' })
      return null
    }
  })()
  if (jsonParsed === null) {
    return new Map()
  }
  const schemaParsed = SharedKeysSchema.safeParse(jsonParsed)
  if (!schemaParsed.success) {
    console.warn('[copilot] shared_keys.parse_failed', { reason: 'schema_mismatch' })
    return new Map()
  }
  return new Map(Object.entries(schemaParsed.data))
}

const parseRequiredPositiveInt = (raw: string | undefined, name: string): number => {
  if (raw === undefined || raw.trim() === '') {
    throw new Error(`${name} is required but not set`)
  }
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer, got "${raw}"`)
  }
  return parsed
}

const SHARED_KEYS = parseSharedKeys()
const DEFAULT_KEY = ((): string | null => {
  const raw = process.env.ANTHROPIC_API_KEY
  if (raw === undefined || raw === '') {
    return null
  }
  return raw
})()

// RATE_LIMIT_LIFETIME is only required when the default access path is
// enabled; invite-only deployments carry per-share lifetimes inside
// SHARED_API_KEYS and have no use for it.
const DEFAULT_LIFETIME = DEFAULT_KEY === null
  ? null
  : parseRequiredPositiveInt(process.env.RATE_LIMIT_LIFETIME, 'RATE_LIMIT_LIFETIME')

// Fail fast if neither access path is available.
if (DEFAULT_KEY === null && SHARED_KEYS.size === 0) {
  throw new Error('Neither ANTHROPIC_API_KEY nor SHARED_API_KEYS is set')
}

export const isShareRequired = (): boolean => SHARED_KEYS.size > 0 && DEFAULT_KEY === null

export const getShareParam = (request: Request): string | null => {
  const url = new URL(request.url)
  const raw = url.searchParams.get('share')
  if (raw === null || raw === '') {
    return null
  }
  return raw
}

export const resolveApiKey = (shareId: string | null): SharedKeyResolution => {
  if (shareId !== null) {
    const mapped = SHARED_KEYS.get(shareId)
    if (mapped !== undefined) {
      return {
        kind: 'shared',
        apiKey: mapped.api_key,
        lifetime: mapped.rate_limit_turns_lifetime,
        bucket: shareId,
      }
    }
  }
  if (DEFAULT_KEY !== null && DEFAULT_LIFETIME !== null) {
    return { kind: 'default', apiKey: DEFAULT_KEY, lifetime: DEFAULT_LIFETIME, bucket: DEFAULT_BUCKET }
  }
  if (SHARED_KEYS.size > 0) {
    return { kind: 'share_required' }
  }
  return { kind: 'server_misconfigured' }
}

export const isShareValid = (shareId: string | null): boolean => {
  if (shareId === null) {
    return false
  }
  return SHARED_KEYS.has(shareId)
}
