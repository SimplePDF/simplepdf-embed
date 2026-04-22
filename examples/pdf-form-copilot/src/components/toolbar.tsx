import { Check, ImageIcon, MousePointer, PenTool, Type } from 'lucide-react'
import type { ComponentType } from 'react'

export type ToolbarTool = 'TEXT' | 'CHECKBOX' | 'SIGNATURE' | 'PICTURE' | null

type ToolbarProps = {
  selected: ToolbarTool
  onSelect: (tool: ToolbarTool) => void
  disabled: boolean
}

type ToolOption = {
  value: ToolbarTool
  label: string
  icon: ComponentType<{ size?: number; strokeWidth?: number }>
}

const OPTIONS: ToolOption[] = [
  { value: null, label: 'Cursor', icon: MousePointer },
  { value: 'TEXT', label: 'Text', icon: Type },
  { value: 'CHECKBOX', label: 'Checkbox', icon: Check },
  { value: 'SIGNATURE', label: 'Signature', icon: PenTool },
  { value: 'PICTURE', label: 'Picture', icon: ImageIcon },
]

export const Toolbar = ({ selected, onSelect, disabled }: ToolbarProps) => {
  return (
    <div className="flex items-center gap-1 border-b border-slate-200 bg-slate-50 px-3 py-2">
      {OPTIONS.map((option) => {
        const isActive = option.value === selected
        const Icon = option.icon
        return (
          <button
            key={option.label}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(option.value)}
            aria-label={option.label}
            aria-pressed={isActive}
            title={option.label}
            className={`flex h-7 w-7 items-center justify-center rounded border transition disabled:cursor-not-allowed disabled:opacity-40 ${
              isActive
                ? 'border-sky-400 bg-sky-100 text-sky-700'
                : 'border-slate-200 bg-white text-slate-500 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-600'
            }`}
          >
            <Icon size={14} strokeWidth={2} />
          </button>
        )
      })}
    </div>
  )
}
