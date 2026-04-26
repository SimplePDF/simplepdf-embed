// BYOK vault: stores N credentials (one per `provider:model` for catalog
// providers, one slot for `custom`) in IndexedDB so a page reload doesn't
// force the user to re-enter anything they've already validated. The whole
// vault is encrypted with a non-extractable AES-GCM key bound to this
// browser.
//
// Threat model honestly stated: the AES-GCM key is non-extractable, so the
// raw key bits never leave the browser sandbox in any plaintext form. This
// hardens against an attacker who exfiltrates the IndexedDB blob (browser
// profile dump on a stolen / shared device). XSS on the copilot origin
// is NOT mitigated. an XSS payload can still call crypto.subtle.decrypt and
// recover the cleartext at runtime. Modal copy reflects this honestly.
//
// Stale entries are auto-cleared after 30 days of inactivity. Each successful
// chat send touches lastUsed so frequent users never expire.

import { z } from 'zod'
import { monitoring, normalizeError } from '../monitoring'
import { type ByokConfig, ByokConfigSchema } from './providers'

// Kept as `form-copilot-vault` after the rename so existing users don't lose
// their stored BYOK credentials on first reload.
const DB_NAME = 'form-copilot-vault'
const DB_VERSION = 1
const STORE_NAME = 'records'
const CRYPTO_KEY_RECORD_ID = 'cryptoKey'
const VAULT_RECORD_ID = 'vault'

export const STALE_DAYS = 30
const STALE_AFTER_MS = STALE_DAYS * 24 * 60 * 60 * 1000

// Catalog providers carry a model slot per credential so a user can save one
// key per (provider, model) pair. The custom branch collapses to a single
// slot since baseUrl + key + model are all editable for one logical "custom
// endpoint" credential.
export type CredentialKey = string

export const credentialKey = (config: ByokConfig): CredentialKey =>
  config.provider === 'custom' ? 'custom' : `${config.provider}:${config.model}`

export type Vault = {
  // The credential currently driving the BYOK chat AND the credential the
  // modal auto-opens to on next visit. One field, one source of truth.
  active: CredentialKey | null
  credentials: Record<CredentialKey, ByokConfig>
}

const VaultSchema: z.ZodType<Vault> = z.object({
  active: z.string().nullable(),
  credentials: z.record(z.string(), ByokConfigSchema),
})

// Frozen so accidental mutation by a future caller (e.g. forgetting the
// spread in a setState updater) fails loudly in dev rather than silently
// corrupting the singleton across consumers.
export const EMPTY_VAULT: Vault = Object.freeze({
  active: null,
  credentials: Object.freeze({}),
}) as Vault

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

const isAvailable = (): boolean =>
  typeof indexedDB !== 'undefined' && typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined'

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
  const parsed = VaultSchema.safeParse(JSON.parse(json))
  if (parsed.success) {
    return parsed.data
  }
  // Schema mismatch is the silent-data-loss path. Log it loudly so a future
  // schema evolution that drops user credentials is visible in telemetry
  // instead of presenting as "my key disappeared".
  monitoring.error('byok_vault.schema_mismatch', { detail: z.prettifyError(parsed.error) })
  return null
}

const encryptVault = async (
  vault: Vault,
): Promise<{ iv: Uint8Array<ArrayBuffer>; ciphertext: Uint8Array<ArrayBuffer> }> => {
  const key = await getOrCreateCryptoKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const plaintext = new TextEncoder().encode(JSON.stringify(vault))
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext))
  return { iv, ciphertext }
}

const writeVault = async (vault: Vault): Promise<void> => {
  const { iv, ciphertext } = await encryptVault(vault)
  await withStore('readwrite', (store) =>
    putRecord(store, {
      id: VAULT_RECORD_ID,
      iv,
      ciphertext,
      lastUsed: Date.now(),
    } satisfies StoredVault),
  )
}

// Returns the persisted vault, or `empty` when nothing is stored, or `stale`
// when the blob is older than the inactivity window (in which case it is
// also cleared).
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
      await clearVault()
      return { kind: 'stale' }
    }
    const vault = await decryptVault(record)
    if (vault === null) {
      // Schema mismatch (older format, manual tampering). Clear so the next
      // save lands cleanly.
      await clearVault()
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

const readVaultOrEmpty = async (): Promise<Vault> => {
  const record = await withStore('readonly', (store) => getRecord<StoredVault>(store, VAULT_RECORD_ID))
  if (record === null) {
    return { ...EMPTY_VAULT, credentials: {} }
  }
  const vault = await decryptVault(record)
  return vault ?? { ...EMPTY_VAULT, credentials: {} }
}

// Adds or updates the credential at `credentialKey(config)` and sets it
// active. Other saved credentials are preserved.
export const saveCredential = async (config: ByokConfig): Promise<SaveResult> => {
  if (!isAvailable()) {
    return { kind: 'unavailable' }
  }
  try {
    const current = await readVaultOrEmpty()
    const key = credentialKey(config)
    const next: Vault = {
      active: key,
      credentials: { ...current.credentials, [key]: config },
    }
    await writeVault(next)
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

// Removes the credential at the given key. If that credential was active,
// `active` is cleared too. Other credentials stay so the user can switch
// back. When the vault becomes empty, the entire blob is dropped.
export const removeCredential = async (key: CredentialKey): Promise<void> => {
  if (!isAvailable()) {
    return
  }
  try {
    const current = await readVaultOrEmpty()
    if (!(key in current.credentials)) {
      return
    }
    const remaining = { ...current.credentials }
    delete remaining[key]
    if (Object.keys(remaining).length === 0) {
      await clearVault()
      return
    }
    const next: Vault = {
      active: current.active === key ? null : current.active,
      credentials: remaining,
    }
    await writeVault(next)
  } catch (e) {
    monitoring.error('byok_vault.clear_failed', { detail: normalizeError(e) })
  }
}

const clearVault = async (): Promise<void> => {
  await withStore('readwrite', (store) => deleteRecord(store, VAULT_RECORD_ID))
}

// Updates the stored vault's `lastUsed` without re-encrypting the payload.
// Called on every successful chat send so the 30-day idle expiry only fires
// for genuinely abandoned credentials. Last-write-wins on `lastUsed` only;
// safe because the field is monotonic (always Date.now()).
export const touchLastUsed = async (): Promise<void> => {
  if (!isAvailable()) {
    return
  }
  try {
    await withStore('readwrite', async (store) => {
      const record = await getRecord<StoredVault>(store, VAULT_RECORD_ID)
      if (record === null) {
        return
      }
      await putRecord(store, { ...record, lastUsed: Date.now() } satisfies StoredVault)
    })
  } catch (e) {
    monitoring.error('byok_vault.touch_failed', { detail: normalizeError(e) })
  }
}
