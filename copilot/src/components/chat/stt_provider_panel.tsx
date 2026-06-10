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

// Speech-to-Text provider configuration (P070-02). Only OpenAI (two
// transcription models) and a custom OpenAI-compatible endpoint expose
// transcription in the AI SDK. The key lives only in this browser's vault and
// audio goes browser-direct to the chosen endpoint — never to SimplePDF.

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
  const [openaiModel, setOpenaiModel] = useState(
    activeStt?.provider === 'openai' ? activeStt.model : firstModel,
  )
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
        <button
          type="button"
          onClick={handleSelectOpenai}
          aria-pressed={provider === 'openai'}
          className={`rounded-md border px-3 py-2 text-left text-xs font-medium transition ${provider === 'openai' ? 'border-sky-600 text-sky-700' : 'border-slate-200 text-slate-700 hover:border-sky-600'}`}
        >
          {t('chat.modelPicker.stt.providerOpenai')}
        </button>
        <button
          type="button"
          onClick={handleSelectCustom}
          aria-pressed={provider === 'custom'}
          className={`rounded-md border px-3 py-2 text-left text-xs font-medium transition ${provider === 'custom' ? 'border-sky-600 text-sky-700' : 'border-slate-200 text-slate-700 hover:border-sky-600'}`}
        >
          {t('chat.modelPicker.stt.providerCustom')}
        </button>
      </div>

      {provider === 'openai' ? (
        <div className="space-y-2">
          <label className="block text-xs font-medium text-slate-700" htmlFor="stt-openai-model">
            {t('chat.modelPicker.stt.modelLabel')}
          </label>
          <select
            id="stt-openai-model"
            value={openaiModel}
            onChange={(event) => setOpenaiModel(event.target.value)}
            className="block w-full rounded-md border border-solid border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-sky-600 focus:outline-none"
            style={{ borderWidth: '1px' }}
          >
            {STT_OPENAI_MODELS.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label}
                {model.recommended ? ` — ${t('chat.modelPicker.stt.recommended')}` : ''}
              </option>
            ))}
          </select>
          <label className="block text-xs font-medium text-slate-700" htmlFor="stt-openai-key">
            {t('chat.modelPicker.stt.keyLabel')}
          </label>
          <TextInput
            id="stt-openai-key"
            type="password"
            value={apiKey}
            placeholder="sk-..."
            onChange={(event) => setApiKey(event.target.value)}
          />
        </div>
      ) : (
        <div className="space-y-2">
          <label className="block text-xs font-medium text-slate-700" htmlFor="stt-custom-url">
            {t('chat.modelPicker.stt.baseUrlLabel')}
          </label>
          <TextInput
            id="stt-custom-url"
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
            <p className="text-xs text-rose-600">{t(customUrlErrorKey(urlError))}</p>
          ) : null}
          <label className="block text-xs font-medium text-slate-700" htmlFor="stt-custom-model">
            {t('chat.modelPicker.stt.modelLabel')}
          </label>
          <TextInput
            id="stt-custom-model"
            type="text"
            value={customModel}
            placeholder="whisper-1"
            onChange={(event) => setCustomModel(event.target.value)}
          />
          <label className="block text-xs font-medium text-slate-700" htmlFor="stt-custom-key">
            {t('chat.modelPicker.stt.keyOptionalLabel')}
          </label>
          <TextInput
            id="stt-custom-key"
            type="password"
            value={apiKey}
            placeholder={t('chat.modelPicker.stt.keyOptionalPlaceholder')}
            onChange={(event) => setApiKey(event.target.value)}
          />
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
