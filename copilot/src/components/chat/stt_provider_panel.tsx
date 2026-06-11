import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  type ByokSttConfig,
  type CustomSttUrlErrorCode,
  STT_OPENAI_MODELS,
  type SttProviderId,
  validateCustomSttUrl,
} from '../../lib/byok'
import { LabeledField } from '../ui/labeled_field'
import { ModalFooterActions } from './modal_footer_actions'
import { StoredOnDeviceNote } from './stored_on_device_note'

// Speech-to-Text provider configuration (P070-02). UX deliberately mirrors the
// Chat picker (provider cards + model cards + key input — no dropdowns) so the
// two tabs feel identical. Only OpenAI (two transcription models) and a custom
// OpenAI-compatible endpoint expose transcription in the AI SDK. The key lives
// only in this browser's vault and audio goes browser-direct — never to
// SimplePDF.

const customUrlErrorKey = (code: CustomSttUrlErrorCode): string => {
  switch (code) {
    case 'invalid_url':
      return 'chat.modelPicker.stt.urlInvalid'
    case 'unsupported_scheme':
      return 'chat.modelPicker.stt.urlScheme'
    case 'http_requires_loopback':
      return 'chat.modelPicker.stt.urlLoopback'
    case 'embedded_credentials':
      return 'chat.modelPicker.stt.urlCredentials'
    case 'has_query':
    case 'has_fragment':
      return 'chat.modelPicker.stt.urlExtras'
    default:
      code satisfies never
      return 'chat.modelPicker.stt.urlInvalid'
  }
}

const ProviderCard = ({
  selected,
  onClick,
  label,
  badge,
}: {
  selected: boolean
  onClick: () => void
  label: string
  badge: string | null
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={selected}
    className={`flex flex-col items-start gap-1 rounded-md border px-3 py-2 text-left text-xs transition ${selected ? 'border-sky-600 text-sky-700' : 'border-slate-200 text-slate-700 hover:border-sky-600'}`}
  >
    <span className="flex w-full items-center justify-between gap-2">
      <span className="flex items-center gap-2 font-medium">
        {label}
        {badge !== null ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide text-emerald-700">
            {badge}
          </span>
        ) : null}
      </span>
      {selected ? <span className="text-sky-600">✓</span> : null}
    </span>
  </button>
)

export const SttProviderPanel = ({
  activeStt,
  onApply,
  onForget,
  onCancel,
}: {
  activeStt: ByokSttConfig | null
  onApply: (config: ByokSttConfig) => void
  onForget: () => void
  onCancel: () => void
}) => {
  const { t } = useTranslation()
  // No provider is pre-selected when there is no saved config (mirrors the Chat
  // tab's `selectedProvider ?? null`): only a saved STT config pre-selects its
  // provider. Opening the tab fresh shows the cards with nothing selected.
  const [provider, setProvider] = useState<SttProviderId | null>(activeStt?.provider ?? null)
  // Null until the user picks a model (mirrors the Chat tab's selectedModelId):
  // only a saved OpenAI config pre-selects its model.
  const [openaiModel, setOpenaiModel] = useState<string | null>(
    activeStt?.provider === 'openai' ? activeStt.model : null,
  )
  const [customModel, setCustomModel] = useState(activeStt?.provider === 'custom' ? activeStt.model : '')
  const [baseUrl, setBaseUrl] = useState(activeStt?.provider === 'custom' ? activeStt.baseUrl : '')
  const [apiKey, setApiKey] = useState(activeStt?.apiKey ?? '')
  const [urlError, setUrlError] = useState<CustomSttUrlErrorCode | null>(null)

  // Switching providers restores the saved config for that provider (so the
  // user doesn't re-type) or resets to a clean draft otherwise — mirrors the
  // Chat tab's restoreFromCredential / resetDraftFields, and keeps the shared
  // API key from carrying across providers.
  const handleSelectOpenai = useCallback(() => {
    setProvider('openai')
    setUrlError(null)
    if (activeStt?.provider === 'openai') {
      setOpenaiModel(activeStt.model)
      setApiKey(activeStt.apiKey)
    } else {
      setOpenaiModel(null)
      setApiKey('')
    }
  }, [activeStt])
  const handleSelectCustom = useCallback(() => {
    setProvider('custom')
    setUrlError(null)
    if (activeStt?.provider === 'custom') {
      setBaseUrl(activeStt.baseUrl)
      setCustomModel(activeStt.model)
      setApiKey(activeStt.apiKey)
    } else {
      setBaseUrl('')
      setCustomModel('')
      setApiKey('')
    }
  }, [activeStt])
  const handleBaseUrlChange = useCallback((value: string) => {
    setBaseUrl(value)
    setUrlError(null)
  }, [])

  const handleSave = useCallback(() => {
    if (provider === null) {
      return
    }
    if (provider === 'openai') {
      if (openaiModel === null || apiKey.trim() === '') {
        return
      }
      onApply({ provider: 'openai', model: openaiModel, apiKey: apiKey.trim() })
      return
    }
    const validated = validateCustomSttUrl(baseUrl)
    if (!validated.success) {
      setUrlError(validated.error.code)
      return
    }
    if (customModel.trim() === '') {
      return
    }
    setUrlError(null)
    onApply({
      provider: 'custom',
      model: customModel.trim(),
      apiKey: apiKey.trim(),
      baseUrl: validated.data.baseUrl,
    })
  }, [provider, apiKey, openaiModel, baseUrl, customModel, onApply])

  const saveDisabled = ((): boolean => {
    if (provider === null) {
      return true
    }
    if (provider === 'openai') {
      return openaiModel === null || apiKey.trim() === ''
    }
    return baseUrl.trim() === '' || customModel.trim() === ''
  })()

  return (
    <section className="space-y-3">
      <p className="text-xs text-slate-600">{t('chat.modelPicker.stt.intro')}</p>

      <div className="grid grid-cols-2 gap-2">
        <ProviderCard
          selected={provider === 'openai'}
          onClick={handleSelectOpenai}
          label={t('chat.modelPicker.providerOpenai')}
          badge={null}
        />
        <ProviderCard
          selected={provider === 'custom'}
          onClick={handleSelectCustom}
          label={t('chat.modelPicker.providerCustom')}
          badge={t('chat.modelPicker.privacyBadge')}
        />
      </div>

      {provider === 'openai' ? (
        <div className="space-y-3">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
              {t('chat.modelPicker.modelSectionTitle')}
            </div>
            <div className="mt-1 space-y-1.5">
              {STT_OPENAI_MODELS.map((model) => {
                const selected = model.id === openaiModel
                return (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => setOpenaiModel(model.id)}
                    className={`flex w-full items-start justify-between gap-2 rounded-md border px-3 py-2 text-left text-xs transition ${selected ? 'border-sky-600' : 'border-slate-200 hover:border-sky-600'}`}
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
                    {selected ? <span className="text-sky-600">✓</span> : null}
                  </button>
                )
              })}
            </div>
          </div>
          {openaiModel !== null ? (
            <LabeledField
              label={null}
              type="password"
              value={apiKey}
              onChange={setApiKey}
              placeholder={t('chat.modelPicker.keyInputPlaceholder', {
                provider: t('chat.modelPicker.providerOpenai'),
              })}
              hint={t('chat.modelPicker.keyInputHint')}
              error={null}
              autoComplete="off"
            />
          ) : null}
        </div>
      ) : provider === 'custom' ? (
        <div className="space-y-3">
          <LabeledField
            id="stt-base-url"
            label={t('chat.modelPicker.customBaseUrlLabel')}
            type="url"
            value={baseUrl}
            onChange={handleBaseUrlChange}
            placeholder="https://host/v1"
            hint={t('chat.modelPicker.customBaseUrlHint')}
            error={urlError !== null ? t(customUrlErrorKey(urlError)) : null}
            autoComplete="off"
            spellCheck={false}
          />
          <LabeledField
            id="stt-model"
            label={t('chat.modelPicker.customModelLabel')}
            type="text"
            value={customModel}
            onChange={setCustomModel}
            placeholder="gpt-4o-mini-transcribe"
            hint={null}
            error={null}
            spellCheck={false}
          />
          <LabeledField
            id="stt-api-key"
            label={t('chat.modelPicker.customKeyLabel')}
            type="password"
            value={apiKey}
            onChange={setApiKey}
            placeholder={t('chat.modelPicker.customKeyPlaceholder')}
            hint={t('chat.modelPicker.customKeyHint')}
            error={null}
            autoComplete="off"
          />
        </div>
      ) : null}

      <StoredOnDeviceNote />

      <ModalFooterActions
        showForget={activeStt !== null}
        forgetLabel={t('chat.modelPicker.forgetKey')}
        onForget={onForget}
        cancelLabel={t('chat.modelPicker.cancelButton')}
        onCancel={onCancel}
        primaryLabel={t('chat.modelPicker.stt.save')}
        primaryDisabled={saveDisabled}
        onPrimary={handleSave}
      />
    </section>
  )
}
