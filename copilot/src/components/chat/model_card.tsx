import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

// Presentational model row shared by the Chat catalog models and the
// Speech-to-Text OpenAI models (P070-02). Both tabs render the exact same
// card — label + optional "recommended" badge + description + selected tick —
// so a single owner keeps the two pickers visually identical.
export const ModelCard = ({
  label,
  description,
  recommended,
  selected,
  onClick,
}: {
  label: string
  description: string
  recommended: boolean
  selected: boolean
  onClick: () => void
}): ReactElement => {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex w-full items-start justify-between gap-2 rounded-md border px-3 py-2 text-left text-xs transition ${
        selected ? 'border-sky-600' : 'border-slate-200 hover:border-sky-600'
      }`}
    >
      <span>
        <span className="flex items-center gap-2">
          <span className="font-medium text-slate-900">{label}</span>
          {recommended ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide text-emerald-700">
              {t('chat.modelPicker.recommendedBadge')}
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 block text-[11px] text-slate-500">{description}</span>
      </span>
      {selected ? <span className="text-sky-600">✓</span> : null}
    </button>
  )
}
