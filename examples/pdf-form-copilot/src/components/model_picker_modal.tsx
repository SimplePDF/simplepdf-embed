import type { ReactNode } from 'react'
import { useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import {
  type ByokConfig,
  type ByokProviderId,
  defaultModelFor,
  findProvider,
  PROVIDER_ENTRIES,
  type ProviderEntry,
} from '../lib/byok'
import { DEMO_MODELS } from '../lib/demo_model'
import type { DemoGate } from '../routes/index'
import { Modal, ModalCloseButton } from './ui/modal'

type ModelPickerModalProps = {
  open: boolean
  onClose: () => void
  activeConfig: ByokConfig | null
  demoGate: DemoGate
  onApply: (config: ByokConfig) => void
}

export const ModelPickerModal = ({
  open,
  onClose,
  activeConfig,
  demoGate,
  onApply,
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
    />
  )
}

type ModelPickerBodyProps = Omit<ModelPickerModalProps, 'open'>

// Describes what's running right now so the "Currently used" section can
// render a label + optional badge. Demo mode carries the rate-limit badge
// because the server-paid path is capped per share; BYOK skips the badge
// (the user owns the cost). Null means neither path is active — the modal
// is being opened before any selection exists — so the section is hidden.
type CurrentlyUsed = { kind: 'demo'; label: string } | { kind: 'byok'; label: string } | null

const pickCurrentlyUsed = ({
  activeConfig,
  demoGate,
}: {
  activeConfig: ByokConfig | null
  demoGate: DemoGate
}): CurrentlyUsed => {
  if (activeConfig !== null) {
    const label =
      findProvider(activeConfig.provider).models.find((m) => m.id === activeConfig.model)?.label ??
      activeConfig.model
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

const ModelPickerModalBody = ({ onClose, activeConfig, demoGate, onApply }: ModelPickerBodyProps) => {
  const { t } = useTranslation()
  const [selectedProvider, setSelectedProvider] = useState<ByokProviderId | null>(
    activeConfig?.provider ?? null,
  )
  const [selectedModelId, setSelectedModelId] = useState<string | null>(activeConfig?.model ?? null)
  const [apiKeyDraft, setApiKeyDraft] = useState(activeConfig?.apiKey ?? '')
  const [comingSoonProviderKey, setComingSoonProviderKey] = useState<string | null>(null)

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

  return (
    <Modal
      open
      onClose={onClose}
      labelledBy="model-picker-title"
      containerClassName="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl"
    >
      <div className="flex items-start justify-between gap-4">
        <h2 id="model-picker-title" className="text-lg font-semibold text-slate-900">
          {t('chat.modelPicker.title')}
        </h2>
        <ModalCloseButton onClose={onClose} />
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
                      <Trans
                        i18nKey="chat.modelPicker.registerInterest"
                        components={{
                          email: (
                            // biome-ignore lint/a11y/useAnchorContent: children injected by i18next <Trans>.
                            <a
                              href={`mailto:hello@simplepdf.com?subject=${encodeURIComponent(
                                `Form Copilot: ${t(entry.labelKey)} interest`,
                              )}`}
                              onClick={(event) => event.stopPropagation()}
                              className="font-medium text-sky-600 hover:text-sky-700"
                            />
                          ),
                        }}
                      />
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
    </Modal>
  )
}
