import { persistence, type PersistedState } from './rate_limit_persistence'

type BucketState = {
  hits: number
}

export type RateLimitDecision =
  | { allowed: true; remaining: number }
  | { allowed: false; reason: 'lifetime' }

export type RateLimitInput = {
  bucket: string
  ipHash: string
  lifetime: number
}

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

  // Hydrate from persisted state (DO Spaces) in the background. Requests that
  // land before hydration completes start from an empty counter; this is a
  // small fairness loss at cold boot but avoids blocking every request on S3.
  let hydrated = false
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
        hydrated = true
      })
      .catch(() => {
        hydrated = true
      })
  } else {
    hydrated = true
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
    const state = getOrCreate(bucket, ipHash)

    if (state.hits >= lifetime) {
      return { allowed: false, reason: 'lifetime' }
    }

    state.hits += 1

    if (persistence.enabled && hydrated) {
      persistence.scheduleWrite(snapshotState())
    }

    return {
      allowed: true,
      remaining: lifetime - state.hits,
    }
  }

  return { check }
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
