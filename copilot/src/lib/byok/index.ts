export { type CustomSttUrlErrorCode, validateCustomSttUrl } from './custom_stt_url'
export type {
  CredentialKey,
  LoadResult as VaultLoadResult,
  RemoveResult as VaultRemoveResult,
  SaveResult as VaultSaveResult,
  Vault,
} from './key_vault'
export {
  credentialKey,
  EMPTY_VAULT,
  loadVault,
  removeCredential,
  removeSttCredential,
  STALE_DAYS,
  saveCredential,
  saveSttCredential,
  sttCredentialKey,
  touchLastUsed,
  VAULT_LOCK_NAME,
} from './key_vault'
export type {
  ByokConfig,
  ByokModel,
  ByokProviderId,
  ByokSttConfig,
  CustomInstructions,
  ProviderEntry,
  SttProviderId,
  SupportedProviderSpec,
} from './providers'
export {
  ByokConfigSchema,
  ByokSttConfigSchema,
  CUSTOM_INSTRUCTIONS_MAX_CHARS,
  defaultModelFor,
  findProvider,
  PROVIDER_ENTRIES,
  STT_OPENAI_MODELS,
} from './providers'
export { runByokStream } from './transport'
export type { ValidateFailureKind, ValidateResult } from './validate'
export { validateApiKey } from './validate'
