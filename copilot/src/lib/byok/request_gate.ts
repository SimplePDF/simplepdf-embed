import { isVaultAvailable, loadVault, VAULT_LOCK_NAME } from './key_vault'
import type { ByokSttConfig } from './providers'

// The authoritative revocation boundary for BYOK provider dispatch (P070-02 V4
// #1). A `forget` takes the vault's EXCLUSIVE lock; every dispatch takes the
// SHARED lock, fresh-reads the credential INSIDE the lock, verifies it still
// matches the frozen selection, and runs the provider call while still holding
// the lock. Web-Locks reader/writer ordering then guarantees: a `forget`
// queued during a dispatch waits for it to finish, and a dispatch queued after
// a `forget` waits behind it — so a forgotten key can never be used by a later
// request. `BroadcastChannel` is only a UI hint; this lock is the security
// guarantee.

export type SttDispatchResult<TResult> =
  | { kind: 'ran'; result: TResult }
  | { kind: 'revoked' } // the frozen credential was removed/replaced — fail visibly, no fallback
  | { kind: 'unavailable' } // vault primitives missing
  | { kind: 'cancelled' } // the caller aborted before/at dispatch

// Runs `run` with the CURRENT active STT credential, but only if it still
// matches `frozenKey` (the selection captured before recording). `signal`
// cancels a pending lock acquisition too (V5 #2), so a cancelled recording
// leaves no queued provider call.
export const dispatchSttUnderFreshCredential = async <TResult>({
  frozenKey,
  signal,
  run,
}: {
  frozenKey: string
  signal: AbortSignal
  run: (config: ByokSttConfig) => Promise<TResult>
}): Promise<SttDispatchResult<TResult>> => {
  if (!isVaultAvailable()) {
    return { kind: 'unavailable' }
  }
  try {
    const outcome = await navigator.locks.request(
      VAULT_LOCK_NAME,
      { mode: 'shared', signal },
      async (): Promise<SttDispatchResult<TResult>> => {
        const load = await loadVault()
        const vault = load.kind === 'loaded' ? load.vault : null
        const fresh =
          vault !== null && vault.sttActive === frozenKey ? (vault.sttCredentials[frozenKey] ?? null) : null
        if (fresh === null) {
          return { kind: 'revoked' }
        }
        return { kind: 'ran', result: await run(fresh) }
      },
    )
    return outcome
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { kind: 'cancelled' }
    }
    throw error
  }
}
