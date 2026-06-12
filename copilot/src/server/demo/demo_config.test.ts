import { afterEach, describe, expect, it, vi } from 'vitest'

// demo_config reads env fresh per call but keeps module-level "already warned"
// flags; resetModules + dynamic import gives each scenario a clean module so
// the flags (and any import-time state) never leak between cases.
const importFresh = async () => {
  vi.resetModules()
  return import('./demo_config')
}

const DEMO_ENV_KEYS = [
  'DEMO_CHAT_API_KEY',
  'DEMO_CHAT_MODEL',
  'DEMO_RATE_LIMIT_TURNS',
  'DEMO_STT_OPENAI_API_KEY',
] as const

const FULL_DEMO_ENV: Record<(typeof DEMO_ENV_KEYS)[number], string> = {
  DEMO_CHAT_API_KEY: 'sk-demo-chat',
  DEMO_CHAT_MODEL: 'anthropic_haiku_4_5',
  DEMO_RATE_LIMIT_TURNS: '20',
  DEMO_STT_OPENAI_API_KEY: 'sk-transcribe',
}

const setEnv = (env: Partial<Record<(typeof DEMO_ENV_KEYS)[number], string>>): void => {
  for (const key of DEMO_ENV_KEYS) {
    const value = env[key]
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
}

describe('demo_config', () => {
  const original = Object.fromEntries(DEMO_ENV_KEYS.map((key) => [key, process.env[key]]))

  afterEach(() => {
    for (const key of DEMO_ENV_KEYS) {
      const value = original[key]
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  })

  it('resolves to demo with the full shape when chat config + transcription key are both present', async () => {
    setEnv(FULL_DEMO_ENV)
    const { resolveDemoConfig, DEMO_BUCKET } = await importFresh()
    expect(resolveDemoConfig()).toEqual({
      kind: 'demo',
      apiKey: 'sk-demo-chat',
      lifetime: 20,
      bucket: DEMO_BUCKET,
      model: 'anthropic_haiku_4_5',
    })
  })

  it('is not_demo when nothing is configured (plain BYOK-only deployment)', async () => {
    setEnv({})
    const { resolveDemoConfig } = await importFresh()
    expect(resolveDemoConfig()).toEqual({ kind: 'not_demo' })
  })

  it('is not_demo when the chat config is present but the transcription key is missing (both required)', async () => {
    setEnv({ ...FULL_DEMO_ENV, DEMO_STT_OPENAI_API_KEY: undefined })
    const { resolveDemoConfig } = await importFresh()
    expect(resolveDemoConfig()).toEqual({ kind: 'not_demo' })
  })

  it('is not_demo when the model value is not a known demo model', async () => {
    setEnv({ ...FULL_DEMO_ENV, DEMO_CHAT_MODEL: 'not-a-model' })
    const { resolveDemoConfig } = await importFresh()
    expect(resolveDemoConfig()).toEqual({ kind: 'not_demo' })
  })

  it('is not_demo when the turn cap is not a positive integer', async () => {
    setEnv({ ...FULL_DEMO_ENV, DEMO_RATE_LIMIT_TURNS: 'nope' })
    const { resolveDemoConfig } = await importFresh()
    expect(resolveDemoConfig()).toEqual({ kind: 'not_demo' })
  })

  it('resolveDemoModel returns the configured model in demo mode and null otherwise', async () => {
    setEnv(FULL_DEMO_ENV)
    const demo = await importFresh()
    expect(demo.resolveDemoModel()).toBe('anthropic_haiku_4_5')
    setEnv({})
    const byok = await importFresh()
    expect(byok.resolveDemoModel()).toBeNull()
  })
})
