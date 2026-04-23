import { useTranslation } from 'react-i18next'

type SuggestedPromptsProps = {
  onSelect: (prompt: string) => void
  disabled: boolean
}

const PROMPT_KEYS: string[] = ['suggestedPrompts.helpFill', 'suggestedPrompts.explainFields']

export const SuggestedPrompts = ({ onSelect, disabled }: SuggestedPromptsProps) => {
  const { t } = useTranslation()
  return (
    <div className="space-y-2 p-4">
      <p className="text-xs font-medium text-slate-500">{t('suggestedPrompts.lead')}</p>
      <div className="flex flex-row gap-2">
        {PROMPT_KEYS.map((key, index) => {
          const prompt = t(key)
          const isPrimary = index === 0
          const base =
            'flex-1 cursor-pointer rounded-md px-2 py-1.5 text-left text-xs leading-snug transition disabled:cursor-not-allowed'
          const theme = isPrimary
            ? 'bg-sky-600 font-medium text-white hover:bg-sky-700 disabled:bg-slate-300'
            : 'border border-slate-200 bg-white text-slate-700 hover:border-sky-600 disabled:opacity-40'
          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(prompt)}
              className={`${base} ${theme}`}
            >
              {prompt}
            </button>
          )
        })}
      </div>
    </div>
  )
}
