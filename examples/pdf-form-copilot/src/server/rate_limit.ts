import { persistence, type PersistedState } from './rate_limit_persistence'

type BucketState = {
  hits: number
}

const parsePositiveInt = (raw: string | undefined, fallback: number): number => {
  if (raw === undefined || raw.trim() === '') {
    return fallback
  }
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }
  return parsed
}

const LIMITS = {
  lifetime: parsePositiveInt(process.env.RATE_LIMIT_LIFETIME, 10),
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

// Origin allow-list: when ALLOWED_ORIGINS is set (comma-separated), only
// requests whose Origin or Referer header starts with one of those origins
// are accepted. Defeats drive-by curl / scraper traffic that doesn't bother
// to set a browser-style Origin.
const parseAllowedOrigins = (): string[] | null => {
  const raw = process.env.ALLOWED_ORIGINS
  if (raw === undefined || raw.trim() === '') {
    return null
  }
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '')
}

export const isOriginAllowed = (request: Request): boolean => {
  const allowed = parseAllowedOrigins()
  if (allowed === null) {
    return true
  }
  const origin = request.headers.get('origin')
  if (origin !== null && allowed.some((entry) => origin === entry)) {
    return true
  }
  const referer = request.headers.get('referer')
  if (referer !== null && allowed.some((entry) => referer.startsWith(entry))) {
    return true
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
