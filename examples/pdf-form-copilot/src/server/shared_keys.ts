import { z } from 'zod'

// Invite-link BYOK path. SHARED_API_KEYS is a stringified JSON map of
// share-id -> { api_key, rate_limit_turns_lifetime }. Each share carries its
// own lifetime cap so different invites can have different budgets. Share-id
// values are never logged.
//
// Deployment modes:
//   1. Open demo       : ANTHROPIC_API_KEY set, SHARED_API_KEYS unset. The
//                        default-key path is UNLIMITED; the operator pays
//                        for their own API usage so there is no demo cap.
//   2. Hybrid          : both set. ?share= picks a dedicated key + its own
//                        lifetime cap. No ?share= falls back to the default
//                        (unlimited) path.
//   3. Invite-only     : SHARED_API_KEYS set, ANTHROPIC_API_KEY unset. A
//                        missing / invalid ?share= returns 401 share_required.
//                        Rate limit only applies to invite paths.

const ShareConfigSchema = z.object({
  api_key: z.string().min(1),
  rate_limit_turns_lifetime: z.number().int().positive(),
})

const SharedKeysSchema = z.record(z.string(), ShareConfigSchema)

type ShareConfig = z.infer<typeof ShareConfigSchema>

// Reserved sentinel for the default-key bucket in the rate-limit state. Share
// ids may not equal this string (see parseSharedKeys).
const DEFAULT_BUCKET = '__default__'

// Discriminated union. `default` carries no lifetime / bucket because the
// default-key path is never rate-limited; `shared` always does.
export type SharedKeyResolution =
  | { kind: 'shared'; apiKey: string; lifetime: number; bucket: string }
  | { kind: 'default'; apiKey: string }
  | { kind: 'share_required' }

type Config = {
  sharedKeys: ReadonlyMap<string, ShareConfig>
  defaultKey: string | null
}

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
  const entries: Array<[string, ShareConfig]> = []
  for (const [shareId, config] of Object.entries(schemaParsed.data)) {
    if (shareId === DEFAULT_BUCKET) {
      console.warn('[copilot] shared_keys.reserved_id_rejected', { share_id: DEFAULT_BUCKET })
      continue
    }
    entries.push([shareId, config])
  }
  return new Map(entries)
}

const readDefaultKey = (): string | null => {
  const raw = process.env.ANTHROPIC_API_KEY
  if (raw === undefined || raw === '') {
    return null
  }
  return raw
}

// Memoised config. Parsed + validated on first call; subsequent calls are
// free. Throws once if neither access path is configured — the throw
// propagates up to whatever request triggered it (or to the health check in
// the case of explicit boot-time validation).
let cachedConfig: Config | null = null

const getConfig = (): Config => {
  if (cachedConfig !== null) {
    return cachedConfig
  }
  const sharedKeys = parseSharedKeys()
  const defaultKey = readDefaultKey()
  if (defaultKey === null && sharedKeys.size === 0) {
    throw new Error('Neither ANTHROPIC_API_KEY nor SHARED_API_KEYS is set')
  }
  cachedConfig = { sharedKeys, defaultKey }
  return cachedConfig
}

// Explicit bootstrap hook for a health check or server entry to pre-validate
// at boot rather than waiting for the first request. Safe to call repeatedly.
export const assertConfig = (): void => {
  getConfig()
}

export const isShareRequired = (): boolean => {
  const { sharedKeys, defaultKey } = getConfig()
  return sharedKeys.size > 0 && defaultKey === null
}

export const getShareParam = (request: Request): string | null => {
  const url = new URL(request.url)
  const raw = url.searchParams.get('share')
  if (raw === null || raw === '') {
    return null
  }
  return raw
}

export const resolveApiKey = (shareId: string | null): SharedKeyResolution => {
  const { sharedKeys, defaultKey } = getConfig()
  if (shareId !== null) {
    const mapped = sharedKeys.get(shareId)
    if (mapped !== undefined) {
      return {
        kind: 'shared',
        apiKey: mapped.api_key,
        lifetime: mapped.rate_limit_turns_lifetime,
        bucket: shareId,
      }
    }
  }
  if (defaultKey !== null) {
    return { kind: 'default', apiKey: defaultKey }
  }
  // Reachable only in invite-only mode with a missing / unknown share id.
  return { kind: 'share_required' }
}

export const isShareValid = (shareId: string | null): boolean => {
  if (shareId === null) {
    return false
  }
  return getConfig().sharedKeys.has(shareId)
}
