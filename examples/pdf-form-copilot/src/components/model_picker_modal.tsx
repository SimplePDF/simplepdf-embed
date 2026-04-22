import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import {
  defaultModelFor,
  findProvider,
  PROVIDER_ENTRIES,
  type ByokConfig,
  type ByokProviderId,
  type ProviderEntry,
} from '../lib/byok'

type ModelPickerModalProps = {
  open: boolean
  onClose: () => void
  activeConfig: ByokConfig | null
  onApply: (config: ByokConfig) => void
  onReset: () => void
}

export const ModelPickerModal = ({ open, onClose, activeConfig, onApply, onReset }: ModelPickerModalProps) => {
  const { t } = useTranslation()
  const [selectedProvider, setSelectedProvider] = useState<ByokProviderId | null>(null)
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null)
  const [apiKeyDraft, setApiKeyDraft] = useState('')
  const [comingSoonProviderKey, setComingSoonProviderKey] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }
    if (activeConfig !== null) {
      setSelectedProvider(activeConfig.provider)
      setSelectedModelId(activeConfig.model)
      setApiKeyDraft(activeConfig.apiKey)
    } else {
      setSelectedProvider(null)
      setSelectedModelId(null)
      setApiKeyDraft('')
    }
    setComingSoonProviderKey(null)
    const handleKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('keydown', handleKey)
    }
  }, [open, onClose, activeConfig])

  if (!open || typeof document === 'undefined') {
    return null
  }

  const handlePickProvider = (providerId: ByokProviderId): void => {
    setSelectedProvider(providerId)
    setSelectedModelId(defaultModelFor(providerId).id)
  }

  const providerSpec = selectedProvider === null ? null : findProvider(selectedProvider)
  const providerLabel = providerSpec === null ? '' : t(providerSpec.labelKey)
  const canApply = selectedProvider !== null && selectedModelId !== null && apiKeyDraft.trim() !== ''

  const handleApply = (): void => {
    if (selectedProvider === null || selectedModelId === null || apiKeyDraft.trim() === '') {
      return
    }
    onApply({
      provider: selectedProvider,
      model: selectedModelId,
      apiKey: apiKeyDraft.trim(),
    })
    onClose()
  }

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
                <div className="text-sm font-semibold text-slate-900">
                  {activeConfig === null
                    ? t('chat.modelPicker.currentModel')
                    : findProvider(activeConfig.provider).models.find((m) => m.id === activeConfig.model)?.label ??
                      activeConfig.model}
                </div>
                <div className="text-[11px] text-slate-500">
                  {activeConfig === null
                    ? t('chat.modelPicker.currentProvider')
                    : t(findProvider(activeConfig.provider).labelKey)}
                </div>
              </div>
              {activeConfig === null ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700">
                  {t('chat.modelPicker.currentBadge')}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    onReset()
                    onClose()
                  }}
                  className="text-[11px] font-medium text-sky-600 hover:text-sky-700"
                >
                  {t('chat.modelPicker.resetToDefault')}
                </button>
              )}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-slate-900">{t('chat.modelPicker.byokSectionTitle')}</h3>
            <p className="mt-1 text-xs text-slate-600">{t('chat.modelPicker.byokIntro')}</p>

            <div className="mt-3 grid grid-cols-2 gap-2">
              {PROVIDER_ENTRIES.map((entry: ProviderEntry) => {
                const isSelected = entry.supported && entry.id === selectedProvider
                const isComingSoon = !entry.supported
                const isExpanded = isComingSoon && comingSoonProviderKey === entry.id
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
                      <span className="font-medium">{t(entry.labelKey)}</span>
                      {isSelected ? <span className="text-sky-600">✓</span> : null}
                      {isExpanded ? (
                        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium uppercase text-slate-500">
                          {t('chat.modelPicker.comingSoon')}
                        </span>
                      ) : null}
                    </span>
                    {isExpanded ? (
                      <span className="mt-1 block text-[11px] leading-snug text-slate-500">
                        {t('chat.modelPicker.comingSoonEmailLead')}{' '}
                        <a
                          href={`mailto:${t('chat.modelPicker.comingSoonEmail')}?subject=${encodeURIComponent(
                            `Form Copilot: ${t(entry.labelKey)} interest`,
                          )}`}
                          onClick={(event) => event.stopPropagation()}
                          className="font-medium text-sky-600 hover:text-sky-700"
                        >
                          {t('chat.modelPicker.comingSoonEmail')}
                        </a>
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>

            {providerSpec !== null ? (
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
                          onClick={() => setSelectedModelId(model.id)}
                          className={`flex w-full items-start justify-between gap-2 rounded-md border px-3 py-2 text-left text-xs transition ${
                            isSelected
                              ? 'border-sky-600'
                              : 'border-slate-200 hover:border-sky-600'
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

                <div>
                  <input
                    type="password"
                    value={apiKeyDraft}
                    onChange={(event) => setApiKeyDraft(event.target.value)}
                    placeholder={t('chat.modelPicker.keyInputPlaceholder', { provider: providerLabel })}
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-sky-600 focus:outline-none"
                    style={{ borderWidth: '1px' }}
                    autoComplete="off"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">{t('chat.modelPicker.keyInputHint')}</p>
                </div>
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
              disabled={!canApply}
              onClick={handleApply}
              className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
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
