import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// shared_keys memoises the parsed SHARED_API_KEYS env on first call. Tests
// need a fresh module per scenario so each can feed its own env. vi.resetModules
// + dynamic import gives us that; an eager import at the top would latch one
// environment for the whole file.

const importFresh = async () => {
  vi.resetModules()
  return import('./shared_keys')
}

const setSharedKeysEnv = (value: Record<string, unknown> | null): void => {
  if (value === null) {
    process.env.SHARED_API_KEYS = undefined
    return
  }
  process.env.SHARED_API_KEYS = JSON.stringify(value)
}

const validShare = {
  api_key: 'sk-ant-test',
  rate_limit_turns_lifetime: 20,
  model: 'anthropic_haiku_4_5',
}

describe('shared_keys', () => {
  const originalEnv = process.env.SHARED_API_KEYS

  beforeEach(() => {
    process.env.SHARED_API_KEYS = undefined
  })

  afterEach(() => {
    process.env.SHARED_API_KEYS = originalEnv
  })

  describe('resolveApiKey', () => {
    it('returns share_required for a null share id', async () => {
      setSharedKeysEnv({ invite_a: validShare })
      const { resolveApiKey } = await importFresh()
      expect(resolveApiKey(null)).toEqual({ kind: 'share_required' })
    })

    it('returns share_required for an unknown share id', async () => {
      setSharedKeysEnv({ invite_a: validShare })
      const { resolveApiKey } = await importFresh()
      expect(resolveApiKey('no_such_share')).toEqual({ kind: 'share_required' })
    })

    it('returns the full shared resolution for a known share id', async () => {
      setSharedKeysEnv({
        invite_a: { ...validShare, rate_limit_turns_lifetime: 15 },
      })
      const { resolveApiKey } = await importFresh()
      expect(resolveApiKey('invite_a')).toEqual({
        kind: 'shared',
        apiKey: 'sk-ant-test',
        lifetime: 15,
        bucket: 'invite_a',
        model: 'anthropic_haiku_4_5',
      })
    })

    it('surfaces the per-share model (DeepSeek) verbatim', async () => {
      setSharedKeysEnv({
        invite_deepseek: {
          api_key: 'sk-deepseek-test',
          rate_limit_turns_lifetime: 30,
          model: 'deepseek_v4_flash',
        },
      })
      const { resolveApiKey } = await importFresh()
      const resolution = resolveApiKey('invite_deepseek')
      expect(resolution.kind).toBe('shared')
      if (resolution.kind === 'shared') {
        expect(resolution.model).toBe('deepseek_v4_flash')
      }
    })
  })

  describe('resolveShareModel', () => {
    it('returns null for a null share id', async () => {
      setSharedKeysEnv({ invite_a: validShare })
      const { resolveShareModel } = await importFresh()
      expect(resolveShareModel(null)).toBeNull()
    })

    it('returns null for an unknown share id', async () => {
      setSharedKeysEnv({ invite_a: validShare })
      const { resolveShareModel } = await importFresh()
      expect(resolveShareModel('mystery')).toBeNull()
    })

    it('returns the model handle for a known share id', async () => {
      setSharedKeysEnv({ invite_a: validShare })
      const { resolveShareModel } = await importFresh()
      expect(resolveShareModel('invite_a')).toBe('anthropic_haiku_4_5')
    })
  })

  describe('parseSharedKeys (schema / env)', () => {
    it('throws when SHARED_API_KEYS is missing', async () => {
      // No env set in beforeEach; getConfig lazily throws on first call.
      const { resolveApiKey } = await importFresh()
      expect(() => resolveApiKey('any')).toThrow(/SHARED_API_KEYS is required/)
    })

    it('throws when SHARED_API_KEYS is an empty object', async () => {
      setSharedKeysEnv({})
      const { resolveApiKey } = await importFresh()
      expect(() => resolveApiKey('any')).toThrow(/SHARED_API_KEYS is required/)
    })

    it('treats invalid JSON as an empty config (then throws)', async () => {
      process.env.SHARED_API_KEYS = '{not json'
      const { resolveApiKey } = await importFresh()
      expect(() => resolveApiKey('any')).toThrow(/SHARED_API_KEYS is required/)
    })

    it('rejects an entry missing the `model` field', async () => {
      process.env.SHARED_API_KEYS = JSON.stringify({
        invite_a: { api_key: 'sk-ant-test', rate_limit_turns_lifetime: 20 },
      })
      const { resolveApiKey } = await importFresh()
      // Schema-mismatch collapses the whole map to empty, so getConfig throws.
      expect(() => resolveApiKey('invite_a')).toThrow(/SHARED_API_KEYS is required/)
    })

    it('rejects an entry with an unknown `model` value', async () => {
      setSharedKeysEnv({
        invite_a: { ...validShare, model: 'gpt_5_mini' },
      })
      const { resolveApiKey } = await importFresh()
      expect(() => resolveApiKey('invite_a')).toThrow(/SHARED_API_KEYS is required/)
    })

    it('rejects an entry with a non-positive rate limit', async () => {
      setSharedKeysEnv({
        invite_a: { ...validShare, rate_limit_turns_lifetime: 0 },
      })
      const { resolveApiKey } = await importFresh()
      expect(() => resolveApiKey('invite_a')).toThrow(/SHARED_API_KEYS is required/)
    })

    it('silently drops the reserved __default__ share id but keeps other entries', async () => {
      setSharedKeysEnv({
        __default__: validShare,
        invite_a: validShare,
      })
      const { resolveApiKey } = await importFresh()
      expect(resolveApiKey('__default__')).toEqual({ kind: 'share_required' })
      expect(resolveApiKey('invite_a').kind).toBe('shared')
    })

    it('memoises the parsed config between calls', async () => {
      setSharedKeysEnv({ invite_a: validShare })
      const { resolveApiKey } = await importFresh()
      const first = resolveApiKey('invite_a')
      // Mutate the env — the cached config should win, proving single-parse.
      setSharedKeysEnv({ invite_b: validShare })
      const second = resolveApiKey('invite_a')
      expect(second).toEqual(first)
    })
  })
})
