import { type PersistedState, persistence } from './rate_limit_persistence'

type BucketState = {
  hits: number
}

export type RateLimitDecision =
  | { allowed: true; remaining: number }
  | { allowed: false; reason: 'lifetime' }
  | { allowed: false; reason: 'system_failure'; detail: string }

export type RateLimitInput = {
  bucket: string
  ipHash: string
  lifetime: number
}

// Fail-closed hydration state. Persistence-enabled deployments must complete
// the S3 load before the limiter accepts traffic; otherwise a returning
// visitor with an exhausted budget would see their counter reset on every
// cold start. Tracked as a tagged union so the check() call site can fail
// loudly with context.
type HydrationState = { kind: 'pending' } | { kind: 'ready' } | { kind: 'failed'; detail: string }

// Nested map: bucketName -> ipHash -> BucketState. Each share id owns its own
// per-IP counters so different invites track independently.
const createEmptyBuckets = (): Map<string, Map<string, BucketState>> => new Map()

export const createRateLimiter = () => {
  const buckets = createEmptyBuckets()

  const getOrCreate = (bucket: string, ipHash: string): BucketState => {
    const innerMap = ((): Map<string, BucketState> => {
      const existing = buckets.get(bucket)
      if (existing !== undefined) {
        return existing
      }
      const fresh = new Map<string, BucketState>()
      buckets.set(bucket, fresh)
      return fresh
    })()
    const existingState = innerMap.get(ipHash)
    if (existingState !== undefined) {
      return existingState
    }
    const freshState: BucketState = { hits: 0 }
    innerMap.set(ipHash, freshState)
    return freshState
  }

  // Hydrate from persisted state (DO Spaces) in the background. Until
  // hydration completes, the limiter rejects requests with `system_failure`
  // so a returning visitor with an exhausted budget doesn't get a free cold
  // counter. If the S3 load itself fails, the limiter stays in the failed
  // state until the process restarts; the operator must fix the config (or
  // disable persistence) rather than silently accept degraded correctness.
  let hydration: HydrationState = persistence.enabled ? { kind: 'pending' } : { kind: 'ready' }
  if (persistence.enabled) {
    void persistence
      .load()
      .then((state) => {
        if (state !== null) {
          for (const entry of state.entries) {
            const current = getOrCreate(entry.bucket, entry.ipHash)
            current.hits = Math.max(current.hits, entry.hits)
          }
        }
        hydration = { kind: 'ready' }
        console.info('[copilot] rate_limit.hydrated', { entries: state?.entries.length ?? 0 })
      })
      .catch((error: unknown) => {
        const detail = error instanceof Error ? error.message : String(error)
        hydration = { kind: 'failed', detail }
        console.error('[copilot] rate_limit.hydration_failed', { detail })
      })
  }

  const snapshotState = (): PersistedState => {
    const entries: PersistedState['entries'] = []
    for (const [bucket, inner] of buckets) {
      for (const [ipHash, { hits }] of inner) {
        entries.push({ bucket, ipHash, hits })
      }
    }
    return { version: 1, updatedAt: Date.now(), entries }
  }

  const check = ({ bucket, ipHash, lifetime }: RateLimitInput): RateLimitDecision => {
    switch (hydration.kind) {
      case 'pending':
        return { allowed: false, reason: 'system_failure', detail: 'hydration_pending' }
      case 'failed':
        return { allowed: false, reason: 'system_failure', detail: `hydration_failed:${hydration.detail}` }
      case 'ready':
        break
      default:
        hydration satisfies never
        return { allowed: false, reason: 'system_failure', detail: 'unreachable' }
    }
    if (!Number.isFinite(lifetime) || lifetime <= 0) {
      return {
        allowed: false,
        reason: 'system_failure',
        detail: `invalid_lifetime:${String(lifetime)}`,
      }
    }

    const state = getOrCreate(bucket, ipHash)

    if (state.hits >= lifetime) {
      return { allowed: false, reason: 'lifetime' }
    }

    state.hits += 1

    if (persistence.enabled) {
      persistence.scheduleWrite(snapshotState())
    }

    return {
      allowed: true,
      remaining: lifetime - state.hits,
    }
  }

  const isReady = (): boolean => hydration.kind === 'ready'

  const statusDetail = (): string => {
    switch (hydration.kind) {
      case 'pending':
        return 'hydration_pending'
      case 'failed':
        return `hydration_failed:${hydration.detail}`
      case 'ready':
        return 'ready'
      default:
        hydration satisfies never
        return 'unreachable'
    }
  }

  return { check, isReady, statusDetail }
}

export const getClientIp = (request: Request): string => {
  const headerNames = ['do-connecting-ip', 'cf-connecting-ip', 'x-forwarded-for', 'x-real-ip']
  for (const name of headerNames) {
    const raw = request.headers.get(name)
    if (raw === null || raw === '') {
      continue
    }
    const first = raw.split(',')[0]?.trim()
    if (first !== undefined && first !== '') {
      return first
    }
  }
  return 'unknown'
}

// Same-origin enforcement for every browser-facing server route. The Origin /
// Referer headers are trivially spoofable from curl, so this is not the last
// line of defense (that is the per-IP rate limit + invite gate); it is an
// extra barrier that keeps the legitimate browser path constrained to the
// hosting origin. Requests with a mismatched or missing Origin/Referer are
// rejected with 403.
const hostMatches = (candidate: string, host: string): boolean => {
  if (!candidate.startsWith('http://') && !candidate.startsWith('https://')) {
    return false
  }
  const withoutScheme = candidate.replace(/^https?:\/\//, '')
  // Extract the authority (host + optional port) from either an origin (no
  // path) or a referer URL (has a path).
  const authority = withoutScheme.split('/')[0] ?? ''
  return authority === host
}

export const isSameOrigin = (request: Request): boolean => {
  const host = request.headers.get('host')
  if (host === null || host === '') {
    return false
  }
  const origin = request.headers.get('origin')
  if (origin !== null && origin !== '') {
    return hostMatches(origin, host)
  }
  const referer = request.headers.get('referer')
  if (referer !== null && referer !== '') {
    return hostMatches(referer, host)
  }
  return false
}

// Salts the SHA-256 IP hash with a server-side secret. Without a salt, a leak
// of the persisted S3 object would let anyone brute-force the 2^32 IPv4 space
// in minutes. The salt stays in the server's env and is never persisted with
// the entries.
const IP_HASH_SALT = process.env.IP_HASH_SALT ?? ''

export const hashIp = async (ip: string): Promise<string> => {
  const encoder = new TextEncoder()
  const data = encoder.encode(`${IP_HASH_SALT}:${ip}`)
  const buffer = await crypto.subtle.digest('SHA-256', data)
  const bytes = new Uint8Array(buffer)
  let hex = ''
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0')
  }
  return hex.slice(0, 16)
}

export const rateLimiter = createRateLimiter()
