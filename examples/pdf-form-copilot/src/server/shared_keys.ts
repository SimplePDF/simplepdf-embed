import { z } from 'zod'

// Invite-link BYOK is the only server-paid path. SHARED_API_KEYS is a
// stringified JSON map of share-id -> { api_key, rate_limit_turns_lifetime }.
// Each share carries its own lifetime cap so different invites have
// independent budgets. Share-id values are never logged.
//
// There is NO default / open / hybrid mode. Requests without a valid ?share=
// return 401. Anyone who wants to run the demo without an invite link brings
// their own key via the Model Picker; BYOK is browser-direct and never hits
// this server.

const ShareConfigSchema = z.object({
  api_key: z.string().min(1),
  rate_limit_turns_lifetime: z.number().int().positive(),
})

const SharedKeysSchema = z.record(z.string(), ShareConfigSchema)

type ShareConfig = z.infer<typeof ShareConfigSchema>

// Reserved sentinel for the default-key bucket in the rate-limit state.
// Share ids equal to this string are rejected at parse time to prevent
// accidental collisions with legacy persisted blobs.
const DEFAULT_BUCKET = '__default__'

export type SharedKeyResolution =
  | { kind: 'shared'; apiKey: string; lifetime: number; bucket: string }
  | { kind: 'share_required' }

type Config = {
  sharedKeys: ReadonlyMap<string, ShareConfig>
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

// Memoised config. Parsed + validated on first call; subsequent calls are
// free. Throws once if SHARED_API_KEYS is empty (nothing to serve).
let cachedConfig: Config | null = null

const getConfig = (): Config => {
  if (cachedConfig !== null) {
    return cachedConfig
  }
  const sharedKeys = parseSharedKeys()
  if (sharedKeys.size === 0) {
    throw new Error('SHARED_API_KEYS is required and must contain at least one valid invite')
  }
  cachedConfig = { sharedKeys }
  return cachedConfig
}

export const resolveApiKey = (shareId: string | null): SharedKeyResolution => {
  if (shareId === null) {
    return { kind: 'share_required' }
  }
  const { sharedKeys } = getConfig()
  const mapped = sharedKeys.get(shareId)
  if (mapped === undefined) {
    return { kind: 'share_required' }
  }
  return {
    kind: 'shared',
    apiKey: mapped.api_key,
    lifetime: mapped.rate_limit_turns_lifetime,
    bucket: shareId,
  }
}

export const isShareValid = (shareId: string | null): boolean => {
  if (shareId === null) {
    return false
  }
  return getConfig().sharedKeys.has(shareId)
}
