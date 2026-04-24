import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// shared_keys memoises the parsed SHARED_API_KEYS env on first call. Tests
// need a fresh module per scenario so each can feed its own env. vi.resetModules
// + dynamic import gives us that; an eager import at the top would latch one
// environment for the whole file.
//
// Only regression-guarding cases below. The Zod schema is the trust boundary
// between the operator's env and the rate-limited server path, so the tests
// guard the three failure modes that would silently break a deployment:
// missing `model`, unknown model value, reserved id drift. Happy path pins
// the resolveApiKey return shape.

const importFresh = async () => {
  vi.resetModules()
  return import('./shared_keys')
}

const setEnv = (raw: string | undefined): void => {
  process.env.SHARED_API_KEYS = raw
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

  it('resolveApiKey returns the full resolution shape for a known share id', async () => {
    setEnv(JSON.stringify({ invite_a: { ...validShare, rate_limit_turns_lifetime: 15 } }))
    const { resolveApiKey } = await importFresh()
    expect(resolveApiKey('invite_a')).toEqual({
      kind: 'shared',
      apiKey: 'sk-ant-test',
      lifetime: 15,
      bucket: 'invite_a',
      model: 'anthropic_haiku_4_5',
    })
  })

  it('rejects an entry missing the `model` field (required since the demo-model refactor)', async () => {
    setEnv(JSON.stringify({ invite_a: { api_key: 'sk-ant-test', rate_limit_turns_lifetime: 20 } }))
    const { resolveApiKey } = await importFresh()
    expect(() => resolveApiKey('invite_a')).toThrow(/SHARED_API_KEYS is required/)
  })

  it('rejects an entry whose `model` is not a known DemoModel handle', async () => {
    setEnv(JSON.stringify({ invite_a: { ...validShare, model: 'gpt_5_mini' } }))
    const { resolveApiKey } = await importFresh()
    expect(() => resolveApiKey('invite_a')).toThrow(/SHARED_API_KEYS is required/)
  })

  it('silently drops the reserved __default__ share id but keeps siblings', async () => {
    setEnv(JSON.stringify({ __default__: validShare, invite_a: validShare }))
    const { resolveApiKey } = await importFresh()
    expect(resolveApiKey('__default__')).toEqual({ kind: 'share_required' })
    expect(resolveApiKey('invite_a').kind).toBe('shared')
  })
})
