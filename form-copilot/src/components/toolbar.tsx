import { Check, Download, ImageIcon, MousePointer, PenTool, Send, Type } from 'lucide-react'
import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import type { SupportedFieldType } from '../lib/embed-bridge'
import { IS_DEMO_MODE } from '../lib/mode'

// Equivalent to SupportedFieldType | null. Kept as a named alias so the
// toolbar's five buttons + cursor state read cleanly at call sites.
export type ToolbarTool = SupportedFieldType | null

type ToolbarProps = {
  selected: ToolbarTool
  onSelect: (tool: ToolbarTool) => void
  disabled: boolean
  // Flips the finalisation button between quiet (white, secondary) and loud
  // (brand-blue, primary). Both variants remain clickable; the variant is a
  // visual nudge, not a gate.
  finalisationPrimary: boolean
  onFinalisation: () => void
}

const BoxedTextIcon = ({ size = 14 }: { size?: number; strokeWidth?: number }) => (
  <svg
    viewBox="0 0 5515 4463"
    width={size}
    height={size}
    xmlns="http://www.w3.org/2000/svg"
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M865.87 2736.79V1398.03H157.21v2047.42h5196.85V1398.03H4645.4v1338.76H3109.97v-866.32h-708.66v866.32H865.87Z" />
  </svg>
)

export type ToolOption = {
  value: ToolbarTool
  labelKey: string
  icon: ComponentType<{ size?: number; strokeWidth?: number }>
}

// Exported so other surfaces (e.g. the FieldAddedHint renderer in chat_pane)
// can reuse the same icon + label mapping per tool without duplicating the
// entries.
export const TOOLBAR_OPTIONS: ToolOption[] = [
  { value: null, labelKey: 'toolbar.cursor', icon: MousePointer },
  { value: 'TEXT', labelKey: 'toolbar.text', icon: Type },
  { value: 'CHECKBOX', labelKey: 'toolbar.checkbox', icon: Check },
  { value: 'SIGNATURE', labelKey: 'toolbar.signature', icon: PenTool },
  { value: 'PICTURE', labelKey: 'toolbar.picture', icon: ImageIcon },
  { value: 'BOXED_TEXT', labelKey: 'toolbar.boxedText', icon: BoxedTextIcon },
]

export const Toolbar = ({
  selected,
  onSelect,
  disabled,
  finalisationPrimary,
  onFinalisation,
}: ToolbarProps) => {
  const { t } = useTranslation()
  const finalisationLabel = IS_DEMO_MODE ? t('toolbar.download') : t('toolbar.submit')
  const FinalisationIcon = IS_DEMO_MODE ? Download : Send
  const finalisationClass = finalisationPrimary
    ? 'border-sky-600 bg-sky-600 text-white hover:bg-sky-700 hover:border-sky-700'
    : 'border-slate-200 bg-white text-slate-600 hover:border-sky-600 hover:text-sky-600'
  return (
    <div className="flex items-center gap-1 border-b border-slate-200 bg-slate-50 px-3 py-2">
      {TOOLBAR_OPTIONS.map((option) => {
        const isActive = option.value === selected
        const Icon = option.icon
        const label = t(option.labelKey)
        return (
          <button
            key={option.labelKey}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(option.value)}
            aria-label={label}
            aria-pressed={isActive}
            title={label}
            className={`flex h-7 w-7 items-center justify-center rounded border transition disabled:cursor-not-allowed disabled:opacity-40 ${
              isActive
                ? 'border-sky-600 bg-white text-sky-600'
                : 'border-slate-200 bg-white text-slate-500 hover:border-sky-600'
            }`}
          >
            <Icon size={14} strokeWidth={2} />
          </button>
        )
      })}
      <button
        type="button"
        disabled={disabled}
        onClick={onFinalisation}
        aria-label={finalisationLabel}
        title={finalisationLabel}
        className={`ml-auto inline-flex h-7 items-center gap-1.5 rounded border px-2.5 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 ${finalisationClass}`}
      >
        <FinalisationIcon size={12} strokeWidth={2.2} />
        {finalisationLabel}
      </button>
    </div>
  )
}
