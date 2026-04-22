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

export const LIMITS = {
  lifetime: parsePositiveInt(process.env.RATE_LIMIT_LIFETIME, 75),
} as const

export type RateLimitDecision =
  | { allowed: true; remaining: number }
  | { allowed: false; reason: 'lifetime' }

export const createRateLimiter = () => {
  const buckets = new Map<string, BucketState>()

  const check = (ipHash: string): RateLimitDecision => {
    const existing = buckets.get(ipHash)
    const state: BucketState = existing ?? { hits: 0 }

    if (state.hits >= LIMITS.lifetime) {
      buckets.set(ipHash, state)
      return { allowed: false, reason: 'lifetime' }
    }

    state.hits += 1
    buckets.set(ipHash, state)

    return {
      allowed: true,
      remaining: LIMITS.lifetime - state.hits,
    }
  }

  const reset = (): number => {
    const previous = buckets.size
    buckets.clear()
    return previous
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
