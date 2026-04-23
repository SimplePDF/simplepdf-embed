import { persistence, type PersistedState } from './rate_limit_persistence'

type BucketState = {
  hits: number
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

// Required env. The demo runs on a single instance; the lifetime cap is the
// load-bearing cost control, so we refuse to start without an explicit value
// rather than silently falling back to a permissive default.
const LIMITS = {
  lifetime: parseRequiredPositiveInt(process.env.RATE_LIMIT_LIFETIME, 'RATE_LIMIT_LIFETIME'),
} as const

export type RateLimitDecision =
  | { allowed: true; remaining: number }
  | { allowed: false; reason: 'lifetime' }

export const createRateLimiter = () => {
  const buckets = new Map<string, BucketState>()

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
            const existing = buckets.get(entry.ipHash)
            const hits = existing === undefined ? entry.hits : Math.max(existing.hits, entry.hits)
            buckets.set(entry.ipHash, { hits })
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

  const snapshotState = (): PersistedState => ({
    version: 1,
    updatedAt: Date.now(),
    entries: Array.from(buckets.entries()).map(([ipHash, { hits }]) => ({ ipHash, hits })),
  })

  const check = (ipHash: string): RateLimitDecision => {
    const existing = buckets.get(ipHash)
    const state: BucketState = existing ?? { hits: 0 }

    if (state.hits >= LIMITS.lifetime) {
      buckets.set(ipHash, state)
      return { allowed: false, reason: 'lifetime' }
    }

    state.hits += 1
    buckets.set(ipHash, state)

    if (persistence.enabled && hydrated) {
      persistence.scheduleWrite(snapshotState())
    }

    return {
      allowed: true,
      remaining: LIMITS.lifetime - state.hits,
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

// No server-side origin gate. The demo serves the client and the API from
// the same domain and sets no CORS response headers, so the browser's
// same-origin policy already blocks cross-origin reads. Defending against
// non-browser clients (curl / scripts) is not the job of an Origin header
// check since it is trivially forgeable; the per-IP rate limit and the
// SHARED_API_KEYS invite gate are the real cost controls.

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
