import { Cog } from 'lucide-react'
import type { ReactNode } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  type ByokConfig,
  type ByokProviderId,
  type CredentialKey,
  CUSTOM_INSTRUCTIONS_MAX_CHARS,
  type CustomInstructions,
  credentialKey,
  findProvider,
  PROVIDER_ENTRIES,
  type ProviderEntry,
  type ValidateFailureKind,
  validateApiKey,
} from '../../lib/byok'
import { DEMO_MODELS } from '../../lib/demo/demo_model'
import { FINALISATION_ACTION } from '../../lib/embed-bridge-adapters/client-tools'
import { buildSimplepdfUrl } from '../../lib/simplepdf_url'
import type { DemoGate } from '../../routes/index'
import { getDefaultSystemPrompt } from '../../server/tools'
import { Modal, ModalCloseButton } from '../ui/modal'
import { TextInput } from '../ui/text_input'
import { DefaultPromptModal } from './default_prompt_modal'

type ModelPickerModalProps = {
  open: boolean
  onClose: () => void
  activeConfig: ByokConfig | null
  demoGate: DemoGate
  onApply: (config: ByokConfig) => void
  // Removes the credential at the given key (the one currently displayed in
  // the picker). Other saved credentials at different keys stay so the user
  // can switch back.
  onForget: (key: CredentialKey) => void
  // Returns the saved credential at this key, or null. Used to pre-fill the
  // form when the user picks a provider:model they have already used.
  lookupSavedCredential: (key: CredentialKey) => ByokConfig | null
}

export const ModelPickerModal = ({
  open,
  onClose,
  activeConfig,
  demoGate,
  onApply,
  onForget,
  lookupSavedCredential,
}: ModelPickerModalProps) => {
  // Conditionally mount the body so state always initializes cleanly from
  // activeConfig on each open. Avoids the "useEffect to sync prop → state"
  // anti-pattern; the inner component owns its fresh state.
  if (!open) {
    return null
  }
  return (
    <ModelPickerModalBody
      onClose={onClose}
      activeConfig={activeConfig}
      demoGate={demoGate}
      onApply={onApply}
      onForget={onForget}
      lookupSavedCredential={lookupSavedCredential}
    />
  )
}

type ModelPickerBodyProps = Omit<ModelPickerModalProps, 'open'>

// Describes what's running right now so the "Currently used" section can
// render a label + optional badge. Demo mode carries the rate-limit badge
// because the server-paid path is capped per share; BYOK skips the badge
// (the user owns the cost). Null means neither path is active. the modal
// is being opened before any selection exists. so the section is hidden.
type CurrentlyUsed = { kind: 'demo'; label: string } | { kind: 'byok'; label: string } | null

const pickCurrentlyUsed = ({
  activeConfig,
  demoGate,
}: {
  activeConfig: ByokConfig | null
  demoGate: DemoGate
}): CurrentlyUsed => {
  if (activeConfig !== null) {
    const provider = findProvider(activeConfig.provider)
    const label = ((): string => {
      if (provider.kind === 'catalog') {
        return provider.models.find((m) => m.id === activeConfig.model)?.label ?? activeConfig.model
      }
      return activeConfig.model
    })()
    return { kind: 'byok', label }
  }
  switch (demoGate.kind) {
    case 'demo':
      return { kind: 'demo', label: DEMO_MODELS[demoGate.model].label }
    case 'byok':
      return null
    default:
      demoGate satisfies never
      return null
  }
}

type ValidationState =
  | { kind: 'idle' }
  | { kind: 'validating' }
  | { kind: 'error'; reason: ValidateFailureKind }

// Map the probe's failure kind to the matching i18n key, per branch. Kept
// as exhaustive switches so a new ValidateFailureKind wires in at compile
// time instead of silently falling through to a generic message.
const catalogErrorKey = (reason: ValidateFailureKind): string => {
  switch (reason) {
    case 'auth':
      return 'chat.modelPicker.keyInvalid'
    case 'model_not_found':
      return 'chat.modelPicker.keyModelNotFound'
    case 'reach':
      return 'chat.modelPicker.keyNetworkError'
    default:
      reason satisfies never
      return 'chat.modelPicker.keyNetworkError'
  }
}

const customErrorKey = (reason: ValidateFailureKind): string => {
  switch (reason) {
    case 'auth':
      return 'chat.modelPicker.customAuthRejected'
    case 'model_not_found':
      return 'chat.modelPicker.customModelNotFound'
    case 'reach':
      return 'chat.modelPicker.customReachFailed'
    default:
      reason satisfies never
      return 'chat.modelPicker.customReachFailed'
  }
}

const ModelPickerModalBody = ({
  onClose,
  activeConfig,
  demoGate,
  onApply,
  onForget,
  lookupSavedCredential,
}: ModelPickerBodyProps) => {
  const { t, i18n } = useTranslation()
  const locale = i18n.language
  const [selectedProvider, setSelectedProvider] = useState<ByokProviderId | null>(
    activeConfig?.provider ?? null,
  )
  const [selectedModelId, setSelectedModelId] = useState<string | null>(activeConfig?.model ?? null)
  const [apiKeyDraft, setApiKeyDraft] = useState(activeConfig?.apiKey ?? '')
  const [baseUrlDraft, setBaseUrlDraft] = useState(
    activeConfig?.provider === 'custom' ? activeConfig.baseUrl : '',
  )
  const [modelNameDraft, setModelNameDraft] = useState(
    activeConfig?.provider === 'custom' ? activeConfig.model : '',
  )
  // Mode and text are independent slots so the user can flip the radio
  // before typing anything (otherwise selecting Replace on an empty textarea
  // would dissolve the draft and snap the radio back to Append).
  const [customInstructionsMode, setCustomInstructionsMode] = useState<'append' | 'replace'>(
    activeConfig?.customInstructions?.mode ?? 'append',
  )
  const [customInstructionsText, setCustomInstructionsText] = useState<string>(
    activeConfig?.customInstructions?.text ?? '',
  )
  // Default-collapsed unless the user has saved instructions to come back to.
  const [advancedExpanded, setAdvancedExpanded] = useState(activeConfig?.customInstructions != null)
  const [defaultPromptOpen, setDefaultPromptOpen] = useState(false)
  const [comingSoonProviderKey, setComingSoonProviderKey] = useState<string | null>(null)
  const [validation, setValidation] = useState<ValidationState>({ kind: 'idle' })
  const validationControllerRef = useRef<AbortController | null>(null)

  // Derived: only persisted as a CustomInstructions when there is text. Empty
  // text means "no custom instructions" regardless of which mode is selected.
  const customInstructionsDraft: CustomInstructions | null =
    customInstructionsText.trim() === ''
      ? null
      : { mode: customInstructionsMode, text: customInstructionsText }

  // Whether the current draft (provider, model) would update an existing
  // saved credential. Drives the Apply button's label so the user knows
  // upfront whether they're creating a new entry or editing one.
  const draftCredentialKey: CredentialKey | null = ((): CredentialKey | null => {
    if (selectedProvider === null) {
      return null
    }
    if (selectedProvider === 'custom') {
      return 'custom'
    }
    return selectedModelId === null ? null : `${selectedProvider}:${selectedModelId}`
  })()
  const isUpdatingExisting = draftCredentialKey !== null && lookupSavedCredential(draftCredentialKey) !== null

  const handleInstructionsTextChange = (raw: string): void => {
    setCustomInstructionsText(raw.slice(0, CUSTOM_INSTRUCTIONS_MAX_CHARS))
  }

  const handleModeChange = (mode: 'append' | 'replace'): void => {
    setCustomInstructionsMode(mode)
  }

  const handleForget = (): void => {
    if (draftCredentialKey === null) {
      return
    }
    cancelPendingValidation()
    onForget(draftCredentialKey)
    onClose()
  }

  // Input only mounts once both provider + model are picked, so a stable ref
  // callback fires once per mount. Stable via useCallback so React does not
  // re-bind on parent re-renders (which would steal focus back on every
  // keystroke).
  const focusOnMount = useCallback((element: HTMLInputElement | null): void => {
    element?.focus()
  }, [])

  // AbortController is a browser API. matches the CLAUDE.md carve-out for
  // "synchronizing with non-React systems". A stranded fetch on unmount
  // (parent closes the modal mid-probe) would otherwise resolve and flip
  // state on a dead tree; aborting here kills the in-flight request too.
  useEffect(() => {
    return () => {
      validationControllerRef.current?.abort()
    }
  }, [])

  const cancelPendingValidation = (): void => {
    validationControllerRef.current?.abort()
    validationControllerRef.current = null
  }

  // Restores draft state from a previously saved credential so the user
  // doesn't re-type the same key when they bounce between providers / models
  // they've already used. Auto-expands the Advanced section when the saved
  // credential has instructions, so a non-active credential's persisted
  // prompt is visible immediately on switch (matches the auto-expand
  // behaviour for the active credential at modal mount).
  const restoreFromCredential = (saved: ByokConfig): void => {
    setApiKeyDraft(saved.apiKey)
    setCustomInstructionsMode(saved.customInstructions?.mode ?? 'append')
    setCustomInstructionsText(saved.customInstructions?.text ?? '')
    setAdvancedExpanded(saved.customInstructions != null)
    if (saved.provider === 'custom') {
      setBaseUrlDraft(saved.baseUrl)
      setModelNameDraft(saved.model)
      setSelectedModelId(saved.model)
    } else {
      setSelectedModelId(saved.model)
    }
  }

  const resetDraftFields = ({ provider }: { provider: ByokProviderId }): void => {
    setApiKeyDraft('')
    setCustomInstructionsMode('append')
    setCustomInstructionsText('')
    if (provider === 'custom') {
      const spec = findProvider('custom')
      if (spec.kind === 'custom') {
        setBaseUrlDraft(spec.defaults.baseUrl)
        setModelNameDraft(spec.defaults.model)
        setSelectedModelId(spec.defaults.model)
      }
    } else {
      setSelectedModelId(null)
    }
  }

  const handlePickProvider = (providerId: ByokProviderId): void => {
    cancelPendingValidation()
    setSelectedProvider(providerId)
    setValidation({ kind: 'idle' })
    const spec = findProvider(providerId)
    if (spec.kind === 'custom') {
      // Custom collapses to a single saved slot. Pre-fill if present.
      const saved = lookupSavedCredential('custom')
      if (saved !== null && saved.provider === 'custom') {
        restoreFromCredential(saved)
        return
      }
      resetDraftFields({ provider: 'custom' })
      return
    }
    // Catalog: model picked separately; reset draft fields until then.
    resetDraftFields({ provider: providerId })
  }

  const handlePickCatalogModel = (modelId: string): void => {
    cancelPendingValidation()
    setValidation({ kind: 'idle' })
    setSelectedModelId(modelId)
    if (selectedProvider === null || selectedProvider === 'custom') {
      return
    }
    const key: CredentialKey = `${selectedProvider}:${modelId}`
    const saved = lookupSavedCredential(key)
    if (saved !== null && saved.provider === selectedProvider) {
      restoreFromCredential(saved)
      return
    }
    setApiKeyDraft('')
    setCustomInstructionsMode('append')
    setCustomInstructionsText('')
  }

  const handleKeyChange = (value: string): void => {
    cancelPendingValidation()
    setApiKeyDraft(value)
    setValidation({ kind: 'idle' })
  }

  const handleBaseUrlChange = (value: string): void => {
    cancelPendingValidation()
    setBaseUrlDraft(value)
    setValidation({ kind: 'idle' })
  }

  const handleModelNameChange = (value: string): void => {
    cancelPendingValidation()
    setModelNameDraft(value)
    setSelectedModelId(value.trim() === '' ? null : value.trim())
    setValidation({ kind: 'idle' })
  }

  const handleCancel = (): void => {
    cancelPendingValidation()
    onClose()
  }

  const providerSpec = selectedProvider === null ? null : findProvider(selectedProvider)
  const providerLabel = providerSpec === null ? '' : t(providerSpec.labelKey)
  const isValidating = validation.kind === 'validating'
  const isCustomProvider = providerSpec?.kind === 'custom'
  const trimmedBaseUrl = baseUrlDraft.trim()
  const trimmedModelName = modelNameDraft.trim()
  const canApply = ((): boolean => {
    if (selectedProvider === null || isValidating) {
      return false
    }
    if (isCustomProvider) {
      // Local setups (Ollama, LM Studio) don't require a key, so the custom
      // branch only needs URL + model name. Hosted OpenAI-compatible gateways
      // that DO require auth will surface the 401 through the probe.
      return trimmedBaseUrl !== '' && trimmedModelName !== ''
    }
    return selectedModelId !== null && apiKeyDraft.trim() !== ''
  })()

  const buildConfigToApply = (trimmedKey: string): ByokConfig | null => {
    if (selectedProvider === null) {
      return null
    }
    if (selectedProvider === 'custom') {
      if (trimmedBaseUrl === '' || trimmedModelName === '') {
        return null
      }
      return {
        provider: 'custom',
        model: trimmedModelName,
        apiKey: trimmedKey,
        baseUrl: trimmedBaseUrl,
        customInstructions: customInstructionsDraft,
      }
    }
    if (selectedModelId === null || trimmedKey === '') {
      return null
    }
    return {
      provider: selectedProvider,
      model: selectedModelId,
      apiKey: trimmedKey,
      customInstructions: customInstructionsDraft,
    }
  }

  // True when the only difference between the current draft and the active
  // credential is `customInstructions`. The API key has already been
  // validated (it is currently driving chat), so re-probing serves no
  // purpose and a transient probe failure would silently drop the new
  // instructions. Bypass the probe in that case.
  //
  // Identity is checked via `credentialKey(activeConfig)` so switching to a
  // DIFFERENT saved credential that happens to share an API key string
  // (e.g. one Anthropic key used for both Haiku and Sonnet) still runs the
  // probe — otherwise a stale or unavailable model would activate silently.
  const isInstructionsOnlyUpdate = ((): boolean => {
    if (activeConfig === null) {
      return false
    }
    if (draftCredentialKey !== credentialKey(activeConfig)) {
      return false
    }
    if (activeConfig.provider === 'custom') {
      return (
        modelNameDraft.trim() === activeConfig.model &&
        baseUrlDraft.trim() === activeConfig.baseUrl &&
        apiKeyDraft.trim() === activeConfig.apiKey
      )
    }
    return selectedModelId === activeConfig.model && apiKeyDraft.trim() === activeConfig.apiKey
  })()

  const handleApply = async (): Promise<void> => {
    const trimmedKey = apiKeyDraft.trim()
    const pending = buildConfigToApply(trimmedKey)
    if (pending === null) {
      return
    }
    cancelPendingValidation()
    if (isInstructionsOnlyUpdate) {
      // Skip the probe: only customInstructions changed against an already
      // validated credential. Save synchronously so a probe-time network
      // blip can't drop the user's edit.
      setValidation({ kind: 'idle' })
      onApply(pending)
      onClose()
      return
    }
    const controller = new AbortController()
    validationControllerRef.current = controller
    setValidation({ kind: 'validating' })
    // Validation always runs. even for the custom + empty-key case. The
    // probe catches bad URLs / wrong model names before the user commits;
    // for local servers that ignore auth, the key fallback in the transport
    // keeps the Bearer header well-formed so the probe goes through.
    const result = await validateApiKey({ config: pending, signal: controller.signal })
    if (controller.signal.aborted) {
      return
    }
    validationControllerRef.current = null
    if (!result.ok) {
      setValidation({ kind: 'error', reason: result.kind })
      return
    }
    setValidation({ kind: 'idle' })
    onApply(pending)
    onClose()
  }

  return (
    <Modal
      open
      onClose={handleCancel}
      labelledBy="model-picker-title"
      containerClassName="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl"
    >
      <div className="flex items-start justify-between gap-4">
        <h2 id="model-picker-title" className="text-lg font-semibold text-slate-900">
          {t('chat.modelPicker.title')}
        </h2>
        <ModalCloseButton onClose={handleCancel} />
      </div>

      <div className="mt-4 space-y-4 text-sm text-slate-700">
        {((): ReactNode => {
          const currentlyUsed = pickCurrentlyUsed({ activeConfig, demoGate })
          if (currentlyUsed === null) {
            return null
          }
          return (
            <section className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs">
              <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                {t('chat.modelPicker.currentlyUsedSectionTitle')}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="text-sm font-semibold text-slate-900">{currentlyUsed.label}</div>
                {currentlyUsed.kind === 'demo' ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide text-amber-700">
                    {t('chat.modelPicker.demoRateLimitedBadge')}
                  </span>
                ) : null}
              </div>
            </section>
          )
        })()}

        <section>
          <p className="text-xs text-slate-600">{t('chat.modelPicker.byokIntro')}</p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {PROVIDER_ENTRIES.map((entry: ProviderEntry) => {
              const isSelected = entry.supported && entry.id === selectedProvider
              const isComingSoon = !entry.supported
              const isExpanded = isComingSoon && comingSoonProviderKey === entry.id
              const isCustomEntry = entry.supported && entry.kind === 'custom'
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => {
                    if (entry.supported) {
                      setComingSoonProviderKey(null)
                      handlePickProvider(entry.id)
                      return
                    }
                    setSelectedProvider(null)
                    setComingSoonProviderKey(isExpanded ? null : entry.id)
                  }}
                  className={`flex flex-col items-start gap-1 rounded-md border px-3 py-2 text-left text-xs transition ${
                    isSelected
                      ? 'border-sky-600 text-sky-700'
                      : isExpanded
                        ? 'border-sky-600 text-slate-700'
                        : 'border-slate-200 text-slate-700 hover:border-sky-600'
                  }`}
                >
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className="flex items-center gap-2 font-medium">
                      {t(entry.labelKey)}
                      {isCustomEntry ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide text-emerald-700">
                          {t('chat.modelPicker.privacyBadge')}
                        </span>
                      ) : null}
                    </span>
                    {isSelected ? <span className="text-sky-600">✓</span> : null}
                    {isExpanded ? (
                      <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium uppercase text-slate-500">
                        {t('chat.modelPicker.comingSoon')}
                      </span>
                    ) : null}
                  </span>
                  {isExpanded ? (
                    <a
                      href={buildSimplepdfUrl({
                        locale,
                        path: '/contact',
                        query: {
                          message: t('chat.modelPicker.registerInterestMessage', {
                            provider: t(entry.labelKey),
                          }),
                        },
                      })}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(event) => event.stopPropagation()}
                      className="mt-1 block text-[11px] font-medium leading-snug text-sky-600 hover:text-sky-700"
                    >
                      {t('chat.modelPicker.registerInterest')}
                    </a>
                  ) : null}
                </button>
              )
            })}
          </div>

          {providerSpec !== null && providerSpec.kind === 'catalog' ? (
            <div className="mt-4 space-y-3">
              <div>
                <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                  {t('chat.modelPicker.modelSectionTitle')}
                </div>
                <div className="mt-1 space-y-1.5">
                  {providerSpec.models.map((model) => {
                    const isSelected = model.id === selectedModelId
                    return (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => handlePickCatalogModel(model.id)}
                        className={`flex w-full items-start justify-between gap-2 rounded-md border px-3 py-2 text-left text-xs transition ${
                          isSelected ? 'border-sky-600' : 'border-slate-200 hover:border-sky-600'
                        }`}
                      >
                        <span>
                          <span className="flex items-center gap-2">
                            <span className="font-medium text-slate-900">{model.label}</span>
                            {model.recommended ? (
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide text-emerald-700">
                                {t('chat.modelPicker.recommendedBadge')}
                              </span>
                            ) : null}
                          </span>
                          <span className="mt-0.5 block text-[11px] text-slate-500">{model.description}</span>
                        </span>
                        {isSelected ? <span className="text-sky-600">✓</span> : null}
                      </button>
                    )
                  })}
                </div>
              </div>

              {selectedModelId !== null ? (
                <div>
                  <TextInput
                    inputRef={focusOnMount}
                    type="password"
                    value={apiKeyDraft}
                    onChange={(event) => handleKeyChange(event.target.value)}
                    placeholder={t('chat.modelPicker.keyInputPlaceholder', { provider: providerLabel })}
                    invalid={validation.kind === 'error'}
                    autoComplete="off"
                  />
                  {validation.kind === 'error' ? (
                    <p className="mt-1 text-[11px] text-rose-600">{t(catalogErrorKey(validation.reason))}</p>
                  ) : (
                    <p className="mt-1 text-[11px] text-slate-500">{t('chat.modelPicker.keyInputHint')}</p>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}

          {providerSpec !== null && providerSpec.kind === 'custom' ? (
            <div className="mt-4 space-y-3">
              <div>
                <label
                  htmlFor="custom-base-url"
                  className="text-[10px] font-medium uppercase tracking-wide text-slate-400"
                >
                  {t('chat.modelPicker.customBaseUrlLabel')}
                </label>
                <TextInput
                  id="custom-base-url"
                  inputRef={focusOnMount}
                  type="url"
                  value={baseUrlDraft}
                  onChange={(event) => handleBaseUrlChange(event.target.value)}
                  placeholder={providerSpec.defaults.baseUrl}
                  className="mt-1"
                  autoComplete="off"
                  spellCheck={false}
                />
                <p className="mt-1 text-[11px] text-slate-500">{t('chat.modelPicker.customBaseUrlHint')}</p>
              </div>

              <div>
                <label
                  htmlFor="custom-model-name"
                  className="text-[10px] font-medium uppercase tracking-wide text-slate-400"
                >
                  {t('chat.modelPicker.customModelLabel')}
                </label>
                <TextInput
                  id="custom-model-name"
                  type="text"
                  value={modelNameDraft}
                  onChange={(event) => handleModelNameChange(event.target.value)}
                  placeholder={providerSpec.defaults.model}
                  className="mt-1"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>

              <div>
                <label
                  htmlFor="custom-api-key"
                  className="text-[10px] font-medium uppercase tracking-wide text-slate-400"
                >
                  {t('chat.modelPicker.customKeyLabel')}
                </label>
                <TextInput
                  id="custom-api-key"
                  type="password"
                  value={apiKeyDraft}
                  onChange={(event) => handleKeyChange(event.target.value)}
                  placeholder={t('chat.modelPicker.customKeyPlaceholder')}
                  invalid={validation.kind === 'error'}
                  className="mt-1"
                  autoComplete="off"
                />
                {validation.kind === 'error' ? (
                  <p className="mt-1 text-[11px] text-rose-600">{t(customErrorKey(validation.reason))}</p>
                ) : (
                  <p className="mt-1 text-[11px] text-slate-500">{t('chat.modelPicker.customKeyHint')}</p>
                )}
              </div>
            </div>
          ) : null}

          {selectedProvider !== null ? (
            <div className="mt-4 rounded-md border border-slate-200">
              <button
                type="button"
                onClick={() => setAdvancedExpanded((value) => !value)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium text-slate-700 hover:text-sky-700"
              >
                <span className="flex items-center gap-2">
                  <Cog
                    className={`h-3.5 w-3.5 flex-none ${
                      customInstructionsDraft !== null ? 'text-sky-600' : 'text-slate-500'
                    }`}
                    aria-hidden
                  />
                  {advancedExpanded
                    ? t('chat.modelPicker.customInstructionsHide')
                    : t('chat.modelPicker.customInstructionsToggle')}
                </span>
                <span aria-hidden className="text-slate-400">
                  {advancedExpanded ? '−' : '+'}
                </span>
              </button>
              {advancedExpanded ? (
                <div className="space-y-3 border-t border-slate-100 px-3 py-3">
                  <div className="space-y-1.5">
                    {(['append', 'replace'] as const).map((mode) => (
                      <label
                        key={mode}
                        className="flex cursor-pointer items-start gap-2 rounded-md border border-slate-200 px-2.5 py-2 text-xs hover:border-sky-600"
                      >
                        <input
                          type="radio"
                          name="custom-instructions-mode"
                          value={mode}
                          checked={customInstructionsMode === mode}
                          onChange={() => handleModeChange(mode)}
                          className="mt-0.5"
                        />
                        <span>
                          <span className="font-medium text-slate-900">
                            {t(
                              `chat.modelPicker.customInstructionsMode${mode === 'append' ? 'Append' : 'Replace'}`,
                            )}
                          </span>
                          <span className="mt-0.5 block text-[11px] text-slate-500">
                            {t(
                              `chat.modelPicker.customInstructionsMode${mode === 'append' ? 'Append' : 'Replace'}Description`,
                            )}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                  <textarea
                    value={customInstructionsText}
                    onChange={(event) => handleInstructionsTextChange(event.target.value)}
                    placeholder={t(
                      customInstructionsMode === 'append'
                        ? 'chat.modelPicker.customInstructionsPlaceholderAppend'
                        : 'chat.modelPicker.customInstructionsPlaceholderReplace',
                    )}
                    rows={customInstructionsMode === 'replace' ? 8 : 5}
                    className="block w-full resize-y rounded-md border border-slate-200 p-2 text-xs text-slate-700 focus:border-sky-600 focus:outline-none"
                  />
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <button
                      type="button"
                      onClick={() => setDefaultPromptOpen(true)}
                      className="text-sky-600 hover:text-sky-700"
                    >
                      {t('chat.modelPicker.customInstructionsViewDefault')}
                    </button>
                    <span>
                      {t('chat.modelPicker.customInstructionsCharCount', {
                        count: customInstructionsText.length,
                        max: CUSTOM_INSTRUCTIONS_MAX_CHARS,
                      })}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-4 rounded-md border border-sky-100 bg-sky-50 p-3 text-[11px] text-sky-900">
            <div className="font-semibold">{t('chat.modelPicker.byokSecurityTitle')}</div>
            <p className="mt-1 leading-relaxed">{t('chat.modelPicker.byokSecurityBody')}</p>
          </div>
        </section>

        <section className="flex items-center justify-between gap-2 border-t border-slate-100 pt-4">
          {isUpdatingExisting ? (
            <button
              type="button"
              onClick={handleForget}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-rose-600 hover:border-rose-300 hover:text-rose-700"
            >
              {t('chat.modelPicker.forgetKey')}
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:border-slate-300"
            >
              {t('chat.modelPicker.cancelButton')}
            </button>
            <button
              type="button"
              disabled={!canApply}
              onClick={() => {
                void handleApply()
              }}
              className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isValidating
                ? t('chat.modelPicker.validatingButton')
                : isUpdatingExisting
                  ? t('chat.modelPicker.updateConfigButton')
                  : t('chat.modelPicker.applyButton')}
            </button>
          </div>
        </section>
      </div>
      <DefaultPromptModal
        open={defaultPromptOpen}
        onClose={() => setDefaultPromptOpen(false)}
        prompt={getDefaultSystemPrompt(FINALISATION_ACTION)}
      />
    </Modal>
  )
}
