import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import { removeSttCredential, saveSttCredential } from './key_vault'
import { dispatchSttUnderFreshCredential } from './request_gate'

const stt = { provider: 'openai', model: 'gpt-4o-mini-transcribe', apiKey: 'sk-stt' } as const
const KEY = 'openai:gpt-4o-mini-transcribe'
const freshSignal = (): AbortSignal => new AbortController().signal
const tick = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
})

describe('dispatchSttUnderFreshCredential', () => {
  it('runs with the fresh credential when it still matches the frozen key', async () => {
    await saveSttCredential(stt)
    const result = await dispatchSttUnderFreshCredential({
      frozenKey: KEY,
      signal: freshSignal(),
      run: async (config) => config.apiKey,
    })
    expect(result).toEqual({ kind: 'ran', result: 'sk-stt' })
  })

  it('returns revoked when the credential was forgotten before dispatch (never runs)', async () => {
    await saveSttCredential(stt)
    await removeSttCredential(KEY)
    let ran = false
    const result = await dispatchSttUnderFreshCredential({
      frozenKey: KEY,
      signal: freshSignal(),
      run: async () => {
        ran = true
        return 'x'
      },
    })
    expect(result).toEqual({ kind: 'revoked' })
    expect(ran).toBe(false)
  })

  it('returns cancelled when the signal is already aborted (pending-lock cancellation)', async () => {
    await saveSttCredential(stt)
    const controller = new AbortController()
    controller.abort()
    const result = await dispatchSttUnderFreshCredential({
      frozenKey: KEY,
      signal: controller.signal,
      run: async () => 'x',
    })
    expect(result).toEqual({ kind: 'cancelled' })
  })

  it('a forget waits for an in-flight dispatch (shared lock held), then a later dispatch is revoked', async () => {
    await saveSttCredential(stt)
    let release: () => void = () => {}
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    // Dispatch acquires the SHARED lock and holds it across `run`.
    const dispatch = dispatchSttUnderFreshCredential({
      frozenKey: KEY,
      signal: freshSignal(),
      run: async () => {
        await held
        return 'ok'
      },
    })
    await tick(20)
    // The forget requests the EXCLUSIVE lock — it must wait behind the reader.
    let forgetDone = false
    const forget = removeSttCredential(KEY).then(() => {
      forgetDone = true
    })
    await tick(20)
    expect(forgetDone).toBe(false) // blocked by the in-flight shared dispatch

    release()
    expect(await dispatch).toEqual({ kind: 'ran', result: 'ok' })
    await forget
    expect(forgetDone).toBe(true)

    // A dispatch requested after the forget sees the credential gone.
    const after = await dispatchSttUnderFreshCredential({
      frozenKey: KEY,
      signal: freshSignal(),
      run: async () => 'nope',
    })
    expect(after).toEqual({ kind: 'revoked' })
  })
})
