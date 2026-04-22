type Window = {
  startedAt: number
  hits: number
}

type BucketState = {
  hour: Window
  day: Window
}

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

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

export const LIMITS = {
  perHour: parsePositiveInt(process.env.RATE_LIMIT_PER_HOUR, 30),
  perDay: parsePositiveInt(process.env.RATE_LIMIT_PER_DAY, 150),
} as const

export type RateLimitDecision =
  | { allowed: true; remaining: { hour: number; day: number } }
  | { allowed: false; reason: 'hour' | 'day'; retryAfterSeconds: number }

type Clock = () => number

const defaultClock: Clock = () => Date.now()

type CreateLimiterArgs = {
  clock?: Clock
}

export const createRateLimiter = ({ clock = defaultClock }: CreateLimiterArgs = {}) => {
  const buckets = new Map<string, BucketState>()

  const rollWindow = (window: Window, now: number, durationMs: number): Window => {
    if (now - window.startedAt >= durationMs) {
      return { startedAt: now, hits: 0 }
    }
    return window
  }

  const reset = (): number => {
    const previous = buckets.size
    buckets.clear()
    return previous
  }

  const check = (ipHash: string): RateLimitDecision => {
    const now = clock()
    const existing = buckets.get(ipHash)
    const state: BucketState = existing ?? {
      hour: { startedAt: now, hits: 0 },
      day: { startedAt: now, hits: 0 },
    }

    const hour = rollWindow(state.hour, now, HOUR_MS)
    const day = rollWindow(state.day, now, DAY_MS)

    if (day.hits >= LIMITS.perDay) {
      buckets.set(ipHash, { hour, day })
      return {
        allowed: false,
        reason: 'day',
        retryAfterSeconds: Math.max(1, Math.ceil((day.startedAt + DAY_MS - now) / 1000)),
      }
    }

    if (hour.hits >= LIMITS.perHour) {
      buckets.set(ipHash, { hour, day })
      return {
        allowed: false,
        reason: 'hour',
        retryAfterSeconds: Math.max(1, Math.ceil((hour.startedAt + HOUR_MS - now) / 1000)),
      }
    }

    hour.hits += 1
    day.hits += 1
    buckets.set(ipHash, { hour, day })

    return {
      allowed: true,
      remaining: {
        hour: LIMITS.perHour - hour.hits,
        day: LIMITS.perDay - day.hits,
      },
    }
  }

  return { check, reset }
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

export const hashIp = async (ip: string): Promise<string> => {
  const encoder = new TextEncoder()
  const data = encoder.encode(ip)
  const buffer = await crypto.subtle.digest('SHA-256', data)
  const bytes = new Uint8Array(buffer)
  let hex = ''
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0')
  }
  return hex.slice(0, 16)
}

export const rateLimiter = createRateLimiter()
