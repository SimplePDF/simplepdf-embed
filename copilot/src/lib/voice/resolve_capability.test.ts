import { describe, expect, it } from 'vitest'
import type { DemoGate } from '../../routes/index'
import type { Vault } from '../byok'
import {
  isSttAvailable,
  resolveChat,
  resolveMicAction,
  resolveStt,
  sttDestination,
} from './resolve_capability'

const demo: DemoGate = { kind: 'demo', model: 'anthropic_haiku_4_5' }
const byokGate: DemoGate = { kind: 'byok' }

const chatCfg = { provider: 'openai', model: 'gpt-5', apiKey: 'k', customInstructions: null } as const
const sttOpenai = { provider: 'openai', model: 'gpt-4o-mini-transcribe', apiKey: 'k' } as const
const sttCustom = {
  provider: 'custom',
  model: 'whisper',
  apiKey: '',
  baseUrl: 'http://localhost:11434/v1',
} as const

const vault = (over: Partial<Vault>): Vault => ({
  active: null,
  credentials: {},
  sttActive: null,
  sttCredentials: {},
  ...over,
})

describe('resolveChat', () => {
  it('BYOK active config wins over demo', () => {
    const v = vault({ active: 'openai:gpt-5', credentials: { 'openai:gpt-5': chatCfg } })
    expect(resolveChat({ vault: v, demoGate: demo })).toEqual({ kind: 'byok', config: chatCfg })
  })
  it('falls back to demo when no BYOK and a valid share', () => {
    expect(resolveChat({ vault: vault({}), demoGate: demo })).toEqual({ kind: 'demo' })
  })
  it('none when no BYOK and no demo', () => {
    expect(resolveChat({ vault: vault({}), demoGate: byokGate })).toEqual({ kind: 'none' })
  })
})

describe('resolveStt', () => {
  it('BYOK STT wins over demo (per-capability precedence)', () => {
    const v = vault({
      sttActive: 'openai:gpt-4o-mini-transcribe',
      sttCredentials: { 'openai:gpt-4o-mini-transcribe': sttOpenai },
    })
    expect(resolveStt({ vault: v, demoGate: demo })).toEqual({
      kind: 'byok',
      key: 'openai:gpt-4o-mini-transcribe',
      config: sttOpenai,
    })
  })
  it('demo when no STT BYOK and a valid share', () => {
    expect(resolveStt({ vault: vault({}), demoGate: demo })).toEqual({ kind: 'demo' })
  })
  it('none when neither', () => {
    expect(resolveStt({ vault: vault({}), demoGate: byokGate })).toEqual({ kind: 'none' })
    expect(isSttAvailable(resolveStt({ vault: vault({}), demoGate: byokGate }))).toBe(false)
  })
})

describe('resolveMicAction (Chat-first, STT-second)', () => {
  it('opens the chat tab when Chat is unavailable (even if STT is)', () => {
    expect(resolveMicAction({ chat: { kind: 'none' }, stt: { kind: 'demo' } })).toEqual({
      kind: 'configure',
      tab: 'chat',
    })
  })
  it('opens the STT tab when Chat is available but STT is not', () => {
    expect(resolveMicAction({ chat: { kind: 'demo' }, stt: { kind: 'none' } })).toEqual({
      kind: 'configure',
      tab: 'speech-to-text',
    })
  })
  it('records when both are available', () => {
    expect(resolveMicAction({ chat: { kind: 'demo' }, stt: { kind: 'demo' } })).toEqual({ kind: 'record' })
  })
})

describe('sttDestination (recipient for the disclosure)', () => {
  it('maps demo → demo', () => {
    expect(sttDestination({ kind: 'demo' })).toEqual({ kind: 'demo' })
  })
  it('maps OpenAI BYOK → openai-byok', () => {
    expect(sttDestination({ kind: 'byok', key: 'openai:gpt-4o-mini-transcribe', config: sttOpenai })).toEqual(
      {
        kind: 'openai-byok',
      },
    )
  })
  it('maps custom BYOK → custom-byok with the normalized host only (no full URL)', () => {
    expect(sttDestination({ kind: 'byok', key: 'custom', config: sttCustom })).toEqual({
      kind: 'custom-byok',
      host: 'localhost:11434',
    })
  })
})
