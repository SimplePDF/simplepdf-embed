import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  type ByokSttConfig,
  type CustomSttUrlErrorCode,
  STT_OPENAI_MODELS,
  type SttProviderId,
  validateCustomSttUrl,
} from '../../lib/byok'
import { TextInput } from '../ui/text_input'

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
}: {
  activeStt: ByokSttConfig | null
  onApply: (config: ByokSttConfig) => void
  onForget: () => void
}) => {
  const { t } = useTranslation()
  const [provider, setProvider] = useState<SttProviderId>(activeStt?.provider ?? 'openai')
  const firstModel = STT_OPENAI_MODELS[0]?.id ?? 'gpt-4o-mini-transcribe'
  const [openaiModel, setOpenaiModel] = useState(activeStt?.provider === 'openai' ? activeStt.model : firstModel)
  const [customModel, setCustomModel] = useState(activeStt?.provider === 'custom' ? activeStt.model : '')
  const [baseUrl, setBaseUrl] = useState(activeStt?.provider === 'custom' ? activeStt.baseUrl : '')
  const [apiKey, setApiKey] = useState(activeStt?.apiKey ?? '')
  const [urlError, setUrlError] = useState<CustomSttUrlErrorCode | null>(null)

  const handleSelectOpenai = useCallback(() => {
    setProvider('openai')
    setUrlError(null)
  }, [])
  const handleSelectCustom = useCallback(() => {
    setProvider('custom')
  }, [])

  const handleSave = useCallback(() => {
    if (provider === 'openai') {
      if (apiKey.trim() === '') {
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

  const saveDisabled =
    provider === 'openai' ? apiKey.trim() === '' : baseUrl.trim() === '' || customModel.trim() === ''

  return (
    <section className="space-y-3">
      <p className="text-xs text-slate-600">{t('chat.modelPicker.stt.intro')}</p>

      <div className="grid grid-cols-2 gap-2">
        <ProviderCard
          selected={provider === 'openai'}
          onClick={handleSelectOpenai}
          label={t('chat.modelPicker.stt.providerOpenai')}
          badge={null}
        />
        <ProviderCard
          selected={provider === 'custom'}
          onClick={handleSelectCustom}
          label={t('chat.modelPicker.stt.providerCustom')}
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
          <div>
            <TextInput
              type="password"
              value={apiKey}
              placeholder="sk-..."
              autoComplete="off"
              onChange={(event) => setApiKey(event.target.value)}
            />
            <p className="mt-1 text-[11px] text-slate-500">{t('chat.modelPicker.stt.keyLabel')}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <TextInput
              type="text"
              value={baseUrl}
              invalid={urlError !== null}
              placeholder="https://host/v1"
              onChange={(event) => {
                setBaseUrl(event.target.value)
                setUrlError(null)
              }}
            />
            {urlError !== null ? (
              <p className="mt-1 text-[11px] text-rose-600">{t(customUrlErrorKey(urlError))}</p>
            ) : (
              <p className="mt-1 text-[11px] text-slate-500">{t('chat.modelPicker.stt.baseUrlLabel')}</p>
            )}
          </div>
          <div>
            <TextInput
              type="text"
              value={customModel}
              placeholder="whisper-1"
              onChange={(event) => setCustomModel(event.target.value)}
            />
            <p className="mt-1 text-[11px] text-slate-500">{t('chat.modelPicker.stt.modelLabel')}</p>
          </div>
          <div>
            <TextInput
              type="password"
              value={apiKey}
              autoComplete="off"
              placeholder={t('chat.modelPicker.stt.keyOptionalPlaceholder')}
              onChange={(event) => setApiKey(event.target.value)}
            />
            <p className="mt-1 text-[11px] text-slate-500">{t('chat.modelPicker.stt.keyOptionalLabel')}</p>
          </div>
        </div>
      )}

      <p className="text-[11px] leading-snug text-slate-500">{t('chat.modelPicker.stt.privacyNote')}</p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saveDisabled}
          className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {t('chat.modelPicker.stt.save')}
        </button>
        {activeStt !== null ? (
          <button
            type="button"
            onClick={onForget}
            className="rounded-md px-3 py-2 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50"
          >
            {t('chat.modelPicker.stt.forget')}
          </button>
        ) : null}
      </div>
    </section>
  )
}
