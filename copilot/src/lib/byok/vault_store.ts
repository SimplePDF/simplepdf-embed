import {
  EMPTY_VAULT,
  isVaultAvailable,
  loadVault,
  type RemoveResult,
  removeCredential,
  removeSttCredential,
  type SaveResult,
  saveCredential,
  saveSttCredential,
  type Vault,
} from './key_vault'
import type { ByokConfig, ByokSttConfig } from './providers'

// Single subscribed owner of the BYOK vault snapshot for React consumers
// (P070-02 V3 #1). Reads go through `useSyncExternalStore(subscribeVault,
// getVaultSnapshot)`; nobody holds a long-lived decrypted-credential ref that
// outlives a revoke. A successful mutation re-reads the durable vault and then
// publishes a SECRET-FREE monotonic revision over `BroadcastChannel`, so other
// tabs reload before their next provider request. The channel is only a UI
// freshness hint — the actual revocation guarantee is the request gate's lock
// ordering (request_gate.ts).

export type VaultStoreState =
  | { status: 'loading' }
  | { status: 'unavailable' }
  | { status: 'ready'; vault: Vault }

const CHANNEL_NAME = 'byok-vault-revision'

let state: VaultStoreState = { status: 'loading' }
let revision = 0
let channel: BroadcastChannel | null = null
let started = false
const listeners = new Set<() => void>()

const emit = (next: VaultStoreState): void => {
  state = next
  for (const listener of listeners) {
    listener()
  }
}

const reload = async (): Promise<void> => {
  const result = await loadVault()
  switch (result.kind) {
    case 'loaded':
      emit({ status: 'ready', vault: result.vault })
      return
    case 'empty':
    case 'stale':
    case 'error':
      emit({ status: 'ready', vault: EMPTY_VAULT })
      return
    case 'unavailable':
      emit({ status: 'unavailable' })
      return
    default:
      result satisfies never
  }
}

const readRevision = (data: unknown): number | null => {
  if (typeof data !== 'object' || data === null || !('revision' in data)) {
    return null
  }
  return typeof data.revision === 'number' ? data.revision : null
}

const start = (): void => {
  if (started) {
    return
  }
  started = true
  if (!isVaultAvailable()) {
    emit({ status: 'unavailable' })
    return
  }
  channel = new BroadcastChannel(CHANNEL_NAME)
  channel.onmessage = (event: MessageEvent) => {
    const incoming = readRevision(event.data)
    if (incoming !== null && incoming > revision) {
      revision = incoming
      void reload()
    }
  }
  void reload()
}

const publishRevision = (): void => {
  revision += 1
  channel?.postMessage({ revision })
}

export const subscribeVault = (listener: () => void): (() => void) => {
  start()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const getVaultSnapshot = (): VaultStoreState => state

// SSR / first hydration snapshot — stable so there is no hydration mismatch.
export const getVaultServerSnapshot = (): VaultStoreState => ({ status: 'loading' })

// Durable commit → reload local snapshot → publish revision (V5 #1 ordering):
// the UI never claims "saved"/"forgotten" before the locked write commits.
const applyMutation = async <TResult extends RemoveResult | SaveResult>(
  mutate: () => Promise<TResult>,
): Promise<TResult> => {
  const result = await mutate()
  if (result.kind === 'saved' || result.kind === 'removed') {
    await reload()
    publishRevision()
  }
  return result
}

export const storeSaveChat = (config: ByokConfig): Promise<SaveResult> =>
  applyMutation(() => saveCredential(config))
export const storeForgetChat = (key: string): Promise<RemoveResult> =>
  applyMutation(() => removeCredential(key))
export const storeSaveStt = (config: ByokSttConfig): Promise<SaveResult> =>
  applyMutation(() => saveSttCredential(config))
export const storeForgetStt = (key: string): Promise<RemoveResult> =>
  applyMutation(() => removeSttCredential(key))
