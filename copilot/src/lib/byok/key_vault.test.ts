import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  loadVault,
  removeCredential,
  removeSttCredential,
  saveCredential,
  saveSttCredential,
  VaultWireSchema,
} from './key_vault'
import { ByokConfigSchema } from './providers'

// Node 24 provides real Web Locks + Web Crypto + BroadcastChannel; fake-indexeddb
// provides IndexedDB. So these exercise the ACTUAL vault, including the
// exclusive-lock serialization (the Web-Locks ordering itself is also proven
// in the Phase 0 real-browser harness).

const chat = { provider: 'openai', model: 'gpt-5', apiKey: 'sk-chat', customInstructions: null } as const
const stt = { provider: 'openai', model: 'gpt-4o-mini-transcribe', apiKey: 'sk-stt' } as const

beforeEach(() => {
  // Fresh DB (and therefore a fresh crypto key + empty vault) per test.
  globalThis.indexedDB = new IDBFactory()
})

afterEach(() => {
  globalThis.indexedDB = new IDBFactory()
})

const loadedVault = async () => {
  const result = await loadVault()
  if (result.kind !== 'loaded') {
    throw new Error(`expected loaded, got ${result.kind}`)
  }
  return result.vault
}

describe('key_vault capability namespaces', () => {
  it('saves and loads a Chat credential', async () => {
    expect(await saveCredential(chat)).toEqual({ kind: 'saved' })
    const vault = await loadedVault()
    expect(vault.active).toBe('openai:gpt-5')
    expect(vault.credentials['openai:gpt-5']).toEqual(chat)
    expect(vault.sttActive).toBeNull()
  })

  it('keeps Chat and STT in separate slots; removing one preserves the other', async () => {
    await saveCredential(chat)
    await saveSttCredential(stt)
    const both = await loadedVault()
    expect(both.active).toBe('openai:gpt-5')
    expect(both.sttActive).toBe('openai:gpt-4o-mini-transcribe')

    expect(await removeCredential('openai:gpt-5')).toEqual({ kind: 'removed' })
    const afterChatRemoved = await loadedVault()
    expect(afterChatRemoved.active).toBeNull()
    expect(afterChatRemoved.credentials).toEqual({})
    // STT untouched.
    expect(afterChatRemoved.sttActive).toBe('openai:gpt-4o-mini-transcribe')
    expect(afterChatRemoved.sttCredentials['openai:gpt-4o-mini-transcribe']).toEqual(stt)

    expect(await removeSttCredential('openai:gpt-4o-mini-transcribe')).toEqual({ kind: 'removed' })
    // Both empty now → record cleared → loadVault is empty.
    expect((await loadVault()).kind).toBe('empty')
  })

  it('a separate custom entry per capability never collides', async () => {
    await saveCredential({
      provider: 'custom',
      model: 'x',
      apiKey: 'k',
      baseUrl: 'https://a/v1',
      customInstructions: null,
    })
    await saveSttCredential({
      provider: 'custom',
      model: 'whisper',
      apiKey: '',
      baseUrl: 'http://localhost:11434/v1',
    })
    const vault = await loadedVault()
    expect(vault.credentials.custom).toMatchObject({ provider: 'custom', baseUrl: 'https://a/v1' })
    expect(vault.sttCredentials.custom).toMatchObject({
      provider: 'custom',
      baseUrl: 'http://localhost:11434/v1',
    })
  })

  it('serializes interleaved Chat + STT writes with no lost update (Web Lock)', async () => {
    // Both read-modify-write concurrently. Without the exclusive lock one would
    // clobber the other; with it, both slots survive.
    await Promise.all([saveCredential(chat), saveSttCredential(stt)])
    const vault = await loadedVault()
    expect(vault.credentials['openai:gpt-5']).toEqual(chat)
    expect(vault.sttCredentials['openai:gpt-4o-mini-transcribe']).toEqual(stt)
  })
})

describe('key_vault wire-shape backward compatibility', () => {
  // The exact pre-P070-02 schema (Chat-only). Used to prove a rolled-back old
  // release can still read every Chat credential from a v2 record.
  const OldVaultSchema = z.object({
    active: z.string().nullable(),
    credentials: z.record(z.string(), ByokConfigSchema),
  })

  it('the old (Chat-only) schema parses a v2 wire object, keeping all Chat creds (STT stripped)', () => {
    const v2Wire = {
      version: 2,
      active: 'openai:gpt-5',
      credentials: { 'openai:gpt-5': chat },
      sttActive: 'openai:gpt-4o-mini-transcribe',
      sttCredentials: { 'openai:gpt-4o-mini-transcribe': stt },
    }
    const parsed = OldVaultSchema.parse(v2Wire)
    expect(parsed.active).toBe('openai:gpt-5')
    expect(parsed.credentials['openai:gpt-5']).toEqual(chat)
    // The old parser does not know about STT (stripped) — accepted rollback loss.
    expect('sttActive' in parsed).toBe(false)
  })

  it('the new schema reads an old (version-less, STT-less) record and defaults STT empty', () => {
    const v1Wire = { active: 'openai:gpt-5', credentials: { 'openai:gpt-5': chat } }
    const parsed = VaultWireSchema.parse(v1Wire)
    expect(parsed.active).toBe('openai:gpt-5')
    expect(parsed.sttActive ?? null).toBeNull()
    expect(parsed.sttCredentials ?? {}).toEqual({})
  })
})
