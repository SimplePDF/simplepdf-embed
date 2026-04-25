import Redis from 'ioredis'
import { z } from 'zod'
import { monitoring, normalizeError } from '../lib/monitoring'

// Trim incoming env strings, treat empty as missing (some hosts inject empty
// strings instead of leaving the key unset). Outputs `string | undefined`.
const TrimmedOptionalString = z.preprocess((val) => {
  if (typeof val !== 'string') {
    return undefined
  }
  const trimmed = val.trim()
  return trimmed === '' ? undefined : trimmed
}, z.string().min(1).optional())

// REDIS_URL is the standard ecosystem name (Heroku, ioredis docs, every
// Redis-compatible service). Works as-is with Valkey on DO Managed Caching
// because Valkey is protocol-compatible. The URL contains the password
// inline (e.g. `rediss://default:<password>@host:25061/0`) so it must be
// stored as a secret.
const ServerRateLimitEnvSchema = z
  .object({
    REDIS_URL: TrimmedOptionalString,
    IP_HASH_SALT: TrimmedOptionalString,
  })
  .superRefine((data, ctx) => {
    if (data.REDIS_URL !== undefined && data.IP_HASH_SALT === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['IP_HASH_SALT'],
        message:
          'IP_HASH_SALT is required when REDIS_URL is set. Without a salt, the ' +
          'per-IP rate-limit keys in Redis (rl:<share>:<hash>) are crackable ' +
          'against a leaked snapshot. Generate one with `openssl rand -hex 32` ' +
          'and redeploy.',
      })
    }
  })

const rateLimitEnv = ((): z.infer<typeof ServerRateLimitEnvSchema> => {
  const result = ServerRateLimitEnvSchema.safeParse({
    REDIS_URL: process.env.REDIS_URL,
    IP_HASH_SALT: process.env.IP_HASH_SALT,
  })
  if (!result.success) {
    throw new Error(`Rate-limit env invalid:\n${z.prettifyError(result.error)}`)
  }
  return result.data
})()

export type RateLimitDecision =
  | { allowed: true; remaining: number }
  | { allowed: false; reason: 'lifetime' }
  | { allowed: false; reason: 'system_failure'; detail: string }

export type RateLimitInput = {
  bucket: string
  ipHash: string
  lifetime: number
}

export type RateLimiter = {
  check: (input: RateLimitInput) => Promise<RateLimitDecision>
  isReady: () => boolean
  statusDetail: () => string
}

const validateLifetime = (lifetime: number): { ok: true } | { ok: false; detail: string } => {
  if (!Number.isFinite(lifetime) || lifetime <= 0) {
    return { ok: false, detail: `invalid_lifetime:${String(lifetime)}` }
  }
  return { ok: true }
}

// In-memory limiter for deployments without REDIS_URL (BYOK-only mode, local
// dev, single-instance hosts that don't justify a managed cache). Counters
// reset on every restart, which is fine because there is no shared-key
// traffic in this mode.
const createInMemoryLimiter = (): RateLimiter => {
  const buckets = new Map<string, Map<string, number>>()

  const getOrCreateInner = (bucket: string): Map<string, number> => {
    const existing = buckets.get(bucket)
    if (existing !== undefined) {
      return existing
    }
    const fresh = new Map<string, number>()
    buckets.set(bucket, fresh)
    return fresh
  }

  return {
    check: async ({ bucket, ipHash, lifetime }) => {
      const validated = validateLifetime(lifetime)
      if (!validated.ok) {
        return { allowed: false, reason: 'system_failure', detail: validated.detail }
      }
      const inner = getOrCreateInner(bucket)
      // Check before increment so a rate-limited IP doesn't bloat its counter
      // unbounded on retry; if the operator later raises the lifetime cap,
      // the IP unlocks at the new threshold instead of staying stuck.
      const current = inner.get(ipHash) ?? 0
      if (current >= lifetime) {
        return { allowed: false, reason: 'lifetime' }
      }
      const next = current + 1
      inner.set(ipHash, next)
      return { allowed: true, remaining: lifetime - next }
    },
    isReady: () => true,
    statusDetail: () => 'ready:in_memory',
  }
}

// Redis-protocol limiter (Valkey, Redis, KeyDB, anything compatible). Atomic
// INCR per `(bucket, ipHash)` with no TTL — lifetime caps are persistent by
// design and don't reset until the operator clears them out of band. On a
// connection loss, check() returns system_failure and the chat handler's
// fail-closed guard returns 503.
const createRedisLimiter = (url: string): RateLimiter => {
  const client = new Redis(url, {
    // Fail fast on transient errors so the fail-closed guard kicks in
    // quickly rather than queuing chat requests behind a long retry chain.
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    // Don't crash the process on disconnect; the limiter surfaces unready
    // state via isReady() and check() returns system_failure.
    lazyConnect: false,
  })

  let lastError: string | null = null

  client.on('error', (error) => {
    lastError = normalizeError(error)
    monitoring.error('rate_limit.redis_error', { detail: lastError })
  })

  client.on('ready', () => {
    lastError = null
    monitoring.info('rate_limit.redis_ready', {})
  })

  const buildKey = (bucket: string, ipHash: string): string => `rl:${bucket}:${ipHash}`

  return {
    check: async ({ bucket, ipHash, lifetime }) => {
      const validated = validateLifetime(lifetime)
      if (!validated.ok) {
        return { allowed: false, reason: 'system_failure', detail: validated.detail }
      }
      if (client.status !== 'ready') {
        return {
          allowed: false,
          reason: 'system_failure',
          detail: `redis_not_ready:${client.status}`,
        }
      }
      const incrResult = await (async (): Promise<
        { ok: true; next: number } | { ok: false; detail: string }
      > => {
        try {
          return { ok: true, next: await client.incr(buildKey(bucket, ipHash)) }
        } catch (error) {
          return { ok: false, detail: `redis_incr_failed:${normalizeError(error)}` }
        }
      })()
      if (!incrResult.ok) {
        return { allowed: false, reason: 'system_failure', detail: incrResult.detail }
      }
      if (incrResult.next > lifetime) {
        // Best-effort DECR rollback so a rate-limited IP doesn't grow its
        // counter unbounded on retry. If the rollback fails (e.g. transient
        // disconnect mid-decision), don't downgrade the lifetime decision to
        // a 503: the user is genuinely over the cap regardless. The counter
        // will self-heal on the next successful operation.
        try {
          await client.decr(buildKey(bucket, ipHash))
        } catch (error) {
          monitoring.error('rate_limit.redis_error', {
            detail: `decr_rollback_failed:${normalizeError(error)}`,
          })
        }
        return { allowed: false, reason: 'lifetime' }
      }
      return { allowed: true, remaining: lifetime - incrResult.next }
    },
    isReady: () => client.status === 'ready',
    statusDetail: () => {
      const base = `redis:${client.status}`
      return lastError === null ? base : `${base}:last_error=${lastError}`
    },
  }
}

const createRateLimiter = (): RateLimiter => {
  if (rateLimitEnv.REDIS_URL === undefined) {
    monitoring.info('rate_limit.in_memory_mode', {})
    return createInMemoryLimiter()
  }
  return createRedisLimiter(rateLimitEnv.REDIS_URL)
}

export const rateLimiter = createRateLimiter()

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

// Second-chance detector for "is this a legitimate browser?" used by the
// misbehavior flag: some privacy configurations (Firefox strict tracking
// protection, privacy extensions, some VPNs) strip Origin AND Referer on
// cross-site / proxy-routed requests, which would otherwise trip the flag.
// Sec-Fetch-Site / Sec-Fetch-Mode are on the browser's "forbidden headers"
// list (https://fetch.spec.whatwg.org/#forbidden-header-name). in-page JS
// cannot set them, and every modern Chromium / Firefox / Safari / Edge sets
// them on same-origin fetch() calls. A caller that spoofs Origin can also
// spoof these, so this is an additional lane, not a security control.
export const looksLikeBrowserFetch = (request: Request): boolean => {
  const site = request.headers.get('sec-fetch-site')
  const mode = request.headers.get('sec-fetch-mode')
  const siteOk = site === 'same-origin' || site === 'same-site'
  const modeOk = mode === 'cors' || mode === 'same-origin'
  return siteOk && modeOk
}

const IP_HASH_SALT = rateLimitEnv.IP_HASH_SALT ?? ''

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
