import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// rate_limit memoises the module-level limiter on first import. Each test
// needs a fresh module so REDIS_URL / IP_HASH_SALT toggles take effect; we
// reset modules + dynamic-import per scenario.
const importFresh = async () => {
  vi.resetModules()
  return import('./rate_limit')
}

const setEnv = (vars: Record<string, string | undefined>): void => {
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
}

describe('rate_limit (in-memory mode)', () => {
  beforeEach(() => {
    setEnv({ REDIS_URL: undefined, IP_HASH_SALT: undefined })
  })

  it('allows requests up to the lifetime cap and rejects past it', async () => {
    const { rateLimiter } = await importFresh()
    const input = { bucket: 'invite_a', ipHash: 'abc', lifetime: 3 }
    const r1 = await rateLimiter.check(input)
    const r2 = await rateLimiter.check(input)
    const r3 = await rateLimiter.check(input)
    const r4 = await rateLimiter.check(input)
    expect(r1).toEqual({ allowed: true, remaining: 2 })
    expect(r2).toEqual({ allowed: true, remaining: 1 })
    expect(r3).toEqual({ allowed: true, remaining: 0 })
    expect(r4).toEqual({ allowed: false, reason: 'lifetime' })
  })

  it('does not bloat the counter past lifetime on repeated rate-limited retries', async () => {
    // Regression guard: the previous implementation incremented unconditionally,
    // so an IP at lifetime+10 stayed locked even if the operator later raised
    // the cap. Check-before-increment keeps the counter at exactly lifetime.
    const { rateLimiter } = await importFresh()
    const input = { bucket: 'invite_a', ipHash: 'abc', lifetime: 1 }
    await rateLimiter.check(input)
    for (let i = 0; i < 10; i += 1) {
      await rateLimiter.check(input)
    }
    // Raise the cap; the IP should re-allow once.
    const result = await rateLimiter.check({ ...input, lifetime: 5 })
    expect(result).toEqual({ allowed: true, remaining: 3 })
  })

  it('keeps separate counters per (bucket, ipHash) pair', async () => {
    const { rateLimiter } = await importFresh()
    const r1 = await rateLimiter.check({ bucket: 'a', ipHash: 'x', lifetime: 2 })
    const r2 = await rateLimiter.check({ bucket: 'b', ipHash: 'x', lifetime: 2 })
    const r3 = await rateLimiter.check({ bucket: 'a', ipHash: 'y', lifetime: 2 })
    expect(r1).toEqual({ allowed: true, remaining: 1 })
    expect(r2).toEqual({ allowed: true, remaining: 1 })
    expect(r3).toEqual({ allowed: true, remaining: 1 })
  })

  it('reports system_failure on invalid lifetime', async () => {
    const { rateLimiter } = await importFresh()
    const r = await rateLimiter.check({ bucket: 'a', ipHash: 'x', lifetime: 0 })
    expect(r.allowed).toBe(false)
    if (!r.allowed && r.reason === 'system_failure') {
      expect(r.detail).toMatch(/invalid_lifetime/)
    } else {
      throw new Error('expected system_failure with invalid_lifetime')
    }
  })

  it('reports ready and in-memory status detail', async () => {
    const { rateLimiter } = await importFresh()
    expect(rateLimiter.isReady()).toBe(true)
    expect(rateLimiter.statusDetail()).toBe('ready:in_memory')
  })
})

describe('rate_limit env validation', () => {
  const originalRedis = process.env.REDIS_URL
  const originalSalt = process.env.IP_HASH_SALT

  afterEach(() => {
    setEnv({ REDIS_URL: originalRedis, IP_HASH_SALT: originalSalt })
  })

  it('refuses to boot when REDIS_URL is set without IP_HASH_SALT', async () => {
    setEnv({ REDIS_URL: 'redis://localhost:6379', IP_HASH_SALT: undefined })
    await expect(importFresh()).rejects.toThrow(/IP_HASH_SALT is required when REDIS_URL is set/)
  })

  it('boots when REDIS_URL is set with IP_HASH_SALT', async () => {
    setEnv({ REDIS_URL: 'redis://localhost:6379', IP_HASH_SALT: 'a'.repeat(32) })
    // Constructor doesn't throw on bad host; ioredis lazily connects. Module
    // import is the boot path we care about — it should NOT throw.
    const mod = await importFresh()
    expect(typeof mod.rateLimiter).toBe('object')
    // Tear down the stray connection to avoid hanging the test runner.
    // (ioredis schedules background reconnect attempts otherwise.)
    setEnv({ REDIS_URL: undefined, IP_HASH_SALT: undefined })
  })

  it('treats whitespace-only env vars as unset', async () => {
    setEnv({ REDIS_URL: '   ', IP_HASH_SALT: undefined })
    const { rateLimiter } = await importFresh()
    expect(rateLimiter.statusDetail()).toBe('ready:in_memory')
  })
})
