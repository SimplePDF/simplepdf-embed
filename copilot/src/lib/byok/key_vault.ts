// BYOK vault: stores N credentials (one per `provider:model` for catalog
// providers, one slot for `custom`) in IndexedDB so a page reload doesn't
// force the user to re-enter anything they've already validated. The whole
// vault is encrypted with a non-extractable AES-GCM key bound to this
// browser.
//
// Two independent capability namespaces (P070-02): Chat (`active`/
// `credentials`) and Speech-to-Text (`sttActive`/`sttCredentials`). An STT
// write never touches Chat state and vice versa. The wire shape stays
// backward-readable: an older release's `z.object({active, credentials})`
// parser strips the additive STT/version fields, so a code rollback keeps
// every Chat credential (STT config is lost on the first old-version write —
// an accepted trade-off, P070-02 V3 #2).
//
// Threat model honestly stated: the AES-GCM key is non-extractable, so the
// raw key bits never leave the browser sandbox. This hardens against an
// attacker who exfiltrates the IndexedDB blob. XSS on the copilot origin is
// NOT mitigated — an XSS payload can call crypto.subtle.decrypt at runtime.
//
// Every write is serialized through one exclusive Web Lock with a fresh read
// inside the lock, so concurrent same-tab/cross-tab writes cannot lose
// updates (P070-02 V2 #2). The vault is fail-closed: if IndexedDB, Web
// Crypto, Web Locks, or BroadcastChannel are unavailable, the vault refuses
// reads and writes (P070-02 V4 #2) — a stored BYOK credential is never
// decrypted when it can't be reliably revoked.

import { z } from 'zod'
import { monitoring, normalizeError } from '../monitoring'
import { type ByokConfig, ByokConfigSchema, type ByokSttConfig, ByokSttConfigSchema } from './providers'

// Kept as `form-copilot-vault` after the rename so existing users don't lose
// their stored BYOK credentials on first reload.
const DB_NAME = 'form-copilot-vault'
const DB_VERSION = 1
const STORE_NAME = 'records'
const CRYPTO_KEY_RECORD_ID = 'cryptoKey'
const VAULT_RECORD_ID = 'vault'
// Origin-wide name for the serialized-mutation lock; the request gate uses the
// same name in shared mode for provider dispatch (see request_gate.ts).
export const VAULT_LOCK_NAME = 'byok-vault'
const VAULT_WIRE_VERSION = 2

export const STALE_DAYS = 30
const STALE_AFTER_MS = STALE_DAYS * 24 * 60 * 60 * 1000

export type CredentialKey = string

export const credentialKey = (config: ByokConfig): CredentialKey =>
  config.provider === 'custom' ? 'custom' : `${config.provider}:${config.model}`

export const sttCredentialKey = (config: ByokSttConfig): CredentialKey =>
  config.provider === 'custom' ? 'custom' : `${config.provider}:${config.model}`

export type Vault = {
  // Chat capability (unchanged wire fields).
  active: CredentialKey | null
  credentials: Record<CredentialKey, ByokConfig>
  // Speech-to-Text capability (additive). Lives in its own slots/pointer.
  sttActive: CredentialKey | null
  sttCredentials: Record<CredentialKey, ByokSttConfig>
}

// Reads tolerate an old (version-less, STT-less) record by defaulting the new
// fields; writes always emit the full v2 shape. The old fields keep their
// exact names so an old-code rollback still parses Chat. Exported for the
// wire-compat test.
export const VaultWireSchema = z.object({
  active: z.string().nullable(),
  credentials: z.record(z.string(), ByokConfigSchema),
  version: z.number().optional(),
  sttActive: z.string().nullable().optional(),
  sttCredentials: z.record(z.string(), ByokSttConfigSchema).optional(),
})

const normalizeVault = (parsed: z.infer<typeof VaultWireSchema>): Vault => ({
  active: parsed.active,
  credentials: parsed.credentials,
  sttActive: parsed.sttActive ?? null,
  sttCredentials: parsed.sttCredentials ?? {},
})

export const EMPTY_VAULT: Vault = Object.freeze({
  active: null,
  credentials: Object.freeze({}),
  sttActive: null,
  sttCredentials: Object.freeze({}),
}) as Vault

const freshEmpty = (): Vault => ({ active: null, credentials: {}, sttActive: null, sttCredentials: {} })

const isEmptyVault = (vault: Vault): boolean =>
  vault.active === null &&
  Object.keys(vault.credentials).length === 0 &&
  vault.sttActive === null &&
  Object.keys(vault.sttCredentials).length === 0

type StoredCryptoKey = { id: typeof CRYPTO_KEY_RECORD_ID; key: CryptoKey }
type StoredVault = {
  id: typeof VAULT_RECORD_ID
  iv: Uint8Array<ArrayBuffer>
  ciphertext: Uint8Array<ArrayBuffer>
  lastUsed: number
}

export type LoadResult =
  | { kind: 'empty' }
  | { kind: 'stale' }
  | { kind: 'loaded'; vault: Vault }
  | { kind: 'unavailable' }
  | { kind: 'error'; detail: string }

export type SaveResult = { kind: 'saved' } | { kind: 'unavailable' } | { kind: 'error'; detail: string }
export type RemoveResult = { kind: 'removed' } | { kind: 'unavailable' } | { kind: 'error'; detail: string }

// Fail-closed gate: the vault needs IndexedDB + Web Crypto to store secrets,
// AND Web Locks + BroadcastChannel to serialize mutations and revoke across
// tabs. Missing any of them means a stored credential could not be reliably
// changed or forgotten, so we treat the BYOK vault as entirely unavailable.
const isAvailable = (): boolean =>
  typeof indexedDB !== 'undefined' &&
  typeof crypto !== 'undefined' &&
  typeof crypto.subtle !== 'undefined' &&
  typeof navigator !== 'undefined' &&
  typeof navigator.locks !== 'undefined' &&
  typeof BroadcastChannel !== 'undefined'

// Holds the origin-wide exclusive lock for the duration of `fn` (Web Locks
// release when the callback's promise settles). All writes go through this so
// a read-modify-write can never interleave with another mutation.
// `navigator.locks.request` holds the lock until the callback's promise
// settles. Its lib typing nests the promise (Promise<Promise<T>>);
// Promise.resolve flattens it back to Promise<T> without a cast.
const withExclusiveLock = <TResult>(fn: () => Promise<TResult>): Promise<TResult> =>
  Promise.resolve(navigator.locks.request(VAULT_LOCK_NAME, { mode: 'exclusive' }, fn))

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('idb_open_failed'))
    request.onblocked = () => reject(new Error('idb_open_blocked'))
  })

const withStore = async <TResult>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => Promise<TResult>,
): Promise<TResult> => {
  const db = await openDb()
  try {
    const tx = db.transaction(STORE_NAME, mode)
    const store = tx.objectStore(STORE_NAME)
    const result = await fn(store)
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('idb_tx_error'))
      tx.onabort = () => reject(tx.error ?? new Error('idb_tx_aborted'))
    })
    return result
  } finally {
    db.close()
  }
}

const getRecord = <TRecord>(store: IDBObjectStore, id: string): Promise<TRecord | null> =>
  new Promise((resolve, reject) => {
    const request = store.get(id)
    request.onsuccess = () => resolve((request.result as TRecord | undefined) ?? null)
    request.onerror = () => reject(request.error ?? new Error('idb_get_failed'))
  })

const putRecord = <TRecord extends { id: string }>(store: IDBObjectStore, record: TRecord): Promise<void> =>
  new Promise((resolve, reject) => {
    const request = store.put(record)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error ?? new Error('idb_put_failed'))
  })

const deleteRecord = (store: IDBObjectStore, id: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const request = store.delete(id)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error ?? new Error('idb_delete_failed'))
  })

const generateCryptoKey = (): Promise<CryptoKey> =>
  crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])

const getOrCreateCryptoKey = async (): Promise<CryptoKey> => {
  const existing = await withStore('readonly', (store) =>
    getRecord<StoredCryptoKey>(store, CRYPTO_KEY_RECORD_ID),
  )
  if (existing !== null) {
    return existing.key
  }
  const key = await generateCryptoKey()
  await withStore('readwrite', (store) =>
    putRecord(store, { id: CRYPTO_KEY_RECORD_ID, key } satisfies StoredCryptoKey),
  )
  return key
}

const decryptVault = async (record: StoredVault): Promise<Vault | null> => {
  const key = await getOrCreateCryptoKey()
  const plaintext = new Uint8Array(
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv: record.iv }, key, record.ciphertext),
  )
  const json = new TextDecoder().decode(plaintext)
  const parsed = VaultWireSchema.safeParse(JSON.parse(json))
  if (parsed.success) {
    return normalizeVault(parsed.data)
  }
  monitoring.error('byok_vault.schema_mismatch', { detail: z.prettifyError(parsed.error) })
  return null
}

const encryptVault = async (
  vault: Vault,
): Promise<{ iv: Uint8Array<ArrayBuffer>; ciphertext: Uint8Array<ArrayBuffer> }> => {
  const key = await getOrCreateCryptoKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  // Always write the full v2 wire shape (version + both capabilities).
  const wire = {
    version: VAULT_WIRE_VERSION,
    active: vault.active,
    credentials: vault.credentials,
    sttActive: vault.sttActive,
    sttCredentials: vault.sttCredentials,
  }
  const plaintext = new TextEncoder().encode(JSON.stringify(wire))
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext))
  return { iv, ciphertext }
}

const writeVault = async (vault: Vault): Promise<void> => {
  const { iv, ciphertext } = await encryptVault(vault)
  await withStore('readwrite', (store) =>
    putRecord(store, { id: VAULT_RECORD_ID, iv, ciphertext, lastUsed: Date.now() } satisfies StoredVault),
  )
}

const clearVault = async (): Promise<void> => {
  await withStore('readwrite', (store) => deleteRecord(store, VAULT_RECORD_ID))
}

const readVaultOrEmpty = async (): Promise<Vault> => {
  const record = await withStore('readonly', (store) => getRecord<StoredVault>(store, VAULT_RECORD_ID))
  if (record === null) {
    return freshEmpty()
  }
  return (await decryptVault(record)) ?? freshEmpty()
}

export const loadVault = async (): Promise<LoadResult> => {
  if (!isAvailable()) {
    return { kind: 'unavailable' }
  }
  try {
    const record = await withStore('readonly', (store) => getRecord<StoredVault>(store, VAULT_RECORD_ID))
    if (record === null) {
      return { kind: 'empty' }
    }
    if (Date.now() - record.lastUsed > STALE_AFTER_MS) {
      await withExclusiveLock(clearVault)
      return { kind: 'stale' }
    }
    const vault = await decryptVault(record)
    if (vault === null) {
      await withExclusiveLock(clearVault)
      return { kind: 'empty' }
    }
    const activeCred = vault.active === null ? null : (vault.credentials[vault.active] ?? null)
    monitoring.info('byok_vault.loaded', {
      credential_count: Object.keys(vault.credentials).length,
      active: vault.active,
      active_has_custom_instructions: activeCred?.customInstructions != null,
      active_instructions_mode: activeCred?.customInstructions?.mode ?? null,
      active_instructions_length: activeCred?.customInstructions?.text.length ?? 0,
    })
    return { kind: 'loaded', vault }
  } catch (e) {
    const detail = normalizeError(e)
    monitoring.error('byok_vault.load_failed', { detail })
    return { kind: 'error', detail }
  }
}

// Every mutation: take the exclusive lock, fresh-read inside it, apply, then
// commit durably (clearing the whole record only when BOTH capabilities are
// empty). Returns the committed vault so a caller/store can update its
// snapshot AFTER the durable write (commit → snapshot → notify, V5 #1).
const commitMutation = async (apply: (current: Vault) => Vault): Promise<Vault> =>
  withExclusiveLock(async () => {
    const next = apply(await readVaultOrEmpty())
    if (isEmptyVault(next)) {
      await clearVault()
    } else {
      await writeVault(next)
    }
    return next
  })

export const saveCredential = async (config: ByokConfig): Promise<SaveResult> => {
  if (!isAvailable()) {
    return { kind: 'unavailable' }
  }
  try {
    const key = credentialKey(config)
    await commitMutation((current) => ({
      ...current,
      active: key,
      credentials: { ...current.credentials, [key]: config },
    }))
    monitoring.info('byok_vault.credential_saved', {
      key,
      has_custom_instructions: config.customInstructions !== null,
      instructions_mode: config.customInstructions?.mode ?? null,
      instructions_length: config.customInstructions?.text.length ?? 0,
    })
    return { kind: 'saved' }
  } catch (e) {
    const detail = normalizeError(e)
    monitoring.error('byok_vault.save_failed', { detail })
    return { kind: 'error', detail }
  }
}

export const removeCredential = async (key: CredentialKey): Promise<RemoveResult> => {
  if (!isAvailable()) {
    return { kind: 'unavailable' }
  }
  try {
    await commitMutation((current) => {
      if (!(key in current.credentials)) {
        return current
      }
      const remaining = { ...current.credentials }
      delete remaining[key]
      return { ...current, active: current.active === key ? null : current.active, credentials: remaining }
    })
    return { kind: 'removed' }
  } catch (e) {
    const detail = normalizeError(e)
    monitoring.error('byok_vault.clear_failed', { detail })
    return { kind: 'error', detail }
  }
}

export const saveSttCredential = async (config: ByokSttConfig): Promise<SaveResult> => {
  if (!isAvailable()) {
    return { kind: 'unavailable' }
  }
  try {
    const key = sttCredentialKey(config)
    await commitMutation((current) => ({
      ...current,
      sttActive: key,
      sttCredentials: { ...current.sttCredentials, [key]: config },
    }))
    monitoring.info('byok_vault.stt_saved', { key })
    return { kind: 'saved' }
  } catch (e) {
    const detail = normalizeError(e)
    monitoring.error('byok_vault.save_failed', { detail })
    return { kind: 'error', detail }
  }
}

export const removeSttCredential = async (key: CredentialKey): Promise<RemoveResult> => {
  if (!isAvailable()) {
    return { kind: 'unavailable' }
  }
  try {
    await commitMutation((current) => {
      if (!(key in current.sttCredentials)) {
        return current
      }
      const remaining = { ...current.sttCredentials }
      delete remaining[key]
      return {
        ...current,
        sttActive: current.sttActive === key ? null : current.sttActive,
        sttCredentials: remaining,
      }
    })
    return { kind: 'removed' }
  } catch (e) {
    const detail = normalizeError(e)
    monitoring.error('byok_vault.clear_failed', { detail })
    return { kind: 'error', detail }
  }
}

// Metadata-only: bumps `lastUsed` so the 30-day idle expiry only fires for
// genuinely abandoned credentials. Serialized under the same lock (so it can't
// clobber a concurrent mutation's record) but it does NOT change usable
// credentials, so it never publishes a cross-tab invalidation (V4 polish).
export const touchLastUsed = async (): Promise<void> => {
  if (!isAvailable()) {
    return
  }
  try {
    await withExclusiveLock(() =>
      withStore('readwrite', async (store) => {
        const record = await getRecord<StoredVault>(store, VAULT_RECORD_ID)
        if (record === null) {
          return
        }
        await putRecord(store, { ...record, lastUsed: Date.now() } satisfies StoredVault)
      }),
    )
  } catch (e) {
    monitoring.error('byok_vault.touch_failed', { detail: normalizeError(e) })
  }
}
