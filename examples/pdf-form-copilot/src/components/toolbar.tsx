import { Check, ImageIcon, MousePointer, PenTool, Type } from 'lucide-react'
import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'

export type ToolbarTool = 'TEXT' | 'CHECKBOX' | 'SIGNATURE' | 'PICTURE' | null

type ToolbarProps = {
  selected: ToolbarTool
  onSelect: (tool: ToolbarTool) => void
  disabled: boolean
}

type ToolOption = {
  value: ToolbarTool
  labelKey: string
  icon: ComponentType<{ size?: number; strokeWidth?: number }>
}

const OPTIONS: ToolOption[] = [
  { value: null, labelKey: 'toolbar.cursor', icon: MousePointer },
  { value: 'TEXT', labelKey: 'toolbar.text', icon: Type },
  { value: 'CHECKBOX', labelKey: 'toolbar.checkbox', icon: Check },
  { value: 'SIGNATURE', labelKey: 'toolbar.signature', icon: PenTool },
  { value: 'PICTURE', labelKey: 'toolbar.picture', icon: ImageIcon },
]

export const Toolbar = ({ selected, onSelect, disabled }: ToolbarProps) => {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-1 border-b border-slate-200 bg-slate-50 px-3 py-2">
      {OPTIONS.map((option) => {
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
    </div>
  )
}
