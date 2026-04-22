import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

type ModelPickerModalProps = {
  open: boolean
  onClose: () => void
}

type ProviderId = 'anthropic' | 'openai' | 'google' | 'mistral' | 'xai' | 'groq'

type Provider = {
  id: ProviderId
  labelKey: string
}

const PROVIDERS: Provider[] = [
  { id: 'openai', labelKey: 'chat.modelPicker.providerOpenai' },
  { id: 'google', labelKey: 'chat.modelPicker.providerGoogle' },
  { id: 'anthropic', labelKey: 'chat.modelPicker.providerAnthropic' },
  { id: 'mistral', labelKey: 'chat.modelPicker.providerMistral' },
  { id: 'xai', labelKey: 'chat.modelPicker.providerXai' },
  { id: 'groq', labelKey: 'chat.modelPicker.providerGroq' },
]

export const ModelPickerModal = ({ open, onClose }: ModelPickerModalProps) => {
  const { t } = useTranslation()
  const [selectedProvider, setSelectedProvider] = useState<ProviderId | null>(null)
  const [apiKeyDraft, setApiKeyDraft] = useState('')

  useEffect(() => {
    if (!open) {
      setSelectedProvider(null)
      setApiKeyDraft('')
      return
    }
    const handleKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('keydown', handleKey)
    }
  }, [open, onClose])

  if (!open || typeof document === 'undefined') {
    return null
  }

  const selectedLabel = selectedProvider === null ? '' : t(PROVIDERS.find((p) => p.id === selectedProvider)?.labelKey ?? '')

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="model-picker-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="model-picker-title" className="text-lg font-semibold text-slate-900">
            {t('chat.modelPicker.title')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('infoModal.close')}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="mt-4 space-y-5 text-sm text-slate-700">
          <section className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs">
            <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
              {t('chat.modelPicker.currentSectionTitle')}
            </div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-slate-900">{t('chat.modelPicker.currentModel')}</div>
                <div className="text-[11px] text-slate-500">{t('chat.modelPicker.currentProvider')}</div>
              </div>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700">
                {t('chat.modelPicker.currentBadge')}
              </span>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-slate-900">{t('chat.modelPicker.byokSectionTitle')}</h3>
            <p className="mt-1 text-xs text-slate-600">{t('chat.modelPicker.byokIntro')}</p>

            <div className="mt-3 grid grid-cols-2 gap-2">
              {PROVIDERS.map((provider) => {
                const isSelected = provider.id === selectedProvider
                return (
                  <button
                    key={provider.id}
                    type="button"
                    onClick={() => setSelectedProvider(provider.id)}
                    className={`flex items-center justify-between rounded-md border px-3 py-2 text-left text-xs transition ${
                      isSelected
                        ? 'border-sky-600 text-sky-700'
                        : 'border-slate-200 text-slate-700 hover:border-sky-600'
                    }`}
                  >
                    <span className="font-medium">{t(provider.labelKey)}</span>
                    {isSelected ? <span className="text-sky-600">✓</span> : null}
                  </button>
                )
              })}
            </div>

            {selectedProvider !== null ? (
              <div className="mt-4 space-y-2">
                <input
                  type="password"
                  value={apiKeyDraft}
                  onChange={(event) => setApiKeyDraft(event.target.value)}
                  placeholder={t('chat.modelPicker.keyInputPlaceholder', { provider: selectedLabel })}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-sky-600 focus:outline-none"
                  style={{ borderWidth: '1px' }}
                  autoComplete="off"
                />
                <p className="text-[11px] text-slate-500">{t('chat.modelPicker.keyInputHint')}</p>
              </div>
            ) : null}

            <div className="mt-4 rounded-md border border-sky-100 bg-sky-50 p-3 text-[11px] text-sky-900">
              <div className="font-semibold">{t('chat.modelPicker.byokSecurityTitle')}</div>
              <p className="mt-1 leading-relaxed">{t('chat.modelPicker.byokSecurityBody')}</p>
            </div>
          </section>

          <section className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:border-slate-300"
            >
              {t('chat.modelPicker.cancelButton')}
            </button>
            <button
              type="button"
              disabled={selectedProvider === null || apiKeyDraft.trim() === ''}
              className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              title={t('chat.modelPicker.comingSoon')}
            >
              {t('chat.modelPicker.applyButton')}
            </button>
          </section>
        </div>
      </div>
    </div>,
    document.body,
  )
}
