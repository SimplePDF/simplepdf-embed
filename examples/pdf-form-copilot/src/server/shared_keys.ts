// Invite-link BYOK path. SHARED_API_KEYS is a stringified JSON map of
// share-id -> Anthropic API key. When a request carries `?share=<id>` and the
// id exists in the map, that key is used for the request; the id itself is
// never logged.
//
// Deployment modes:
//   1. Open demo       : ANTHROPIC_API_KEY set, SHARED_API_KEYS unset (today)
//   2. Hybrid          : both set — ?share= picks a dedicated key, everyone
//                        else falls back to ANTHROPIC_API_KEY
//   3. Invite-only     : SHARED_API_KEYS set, ANTHROPIC_API_KEY unset —
//                        requests without a valid ?share= are rejected

type SharedKeyResolution =
  | { kind: 'shared'; apiKey: string }
  | { kind: 'default'; apiKey: string }
  | { kind: 'share_required' }
  | { kind: 'server_misconfigured' }

const parseSharedKeys = (): ReadonlyMap<string, string> => {
  const raw = process.env.SHARED_API_KEYS
  if (raw === undefined || raw.trim() === '') {
    return new Map()
  }
  const parsed = ((): unknown => {
    try {
      return JSON.parse(raw)
    } catch {
      console.warn('[copilot] shared_keys.parse_failed', { reason: 'invalid_json' })
      return null
    }
  })()
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return new Map()
  }
  const entries: Array<[string, string]> = []
  for (const [shareId, apiKey] of Object.entries(parsed)) {
    if (typeof shareId !== 'string' || shareId === '') {
      continue
    }
    if (typeof apiKey !== 'string' || apiKey === '') {
      continue
    }
    entries.push([shareId, apiKey])
  }
  return new Map(entries)
}

const SHARED_KEYS = parseSharedKeys()
const DEFAULT_KEY = ((): string | null => {
  const raw = process.env.ANTHROPIC_API_KEY
  if (raw === undefined || raw === '') {
    return null
  }
  return raw
})()

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
      return { kind: 'shared', apiKey: mapped }
    }
  }
  if (DEFAULT_KEY !== null) {
    return { kind: 'default', apiKey: DEFAULT_KEY }
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
