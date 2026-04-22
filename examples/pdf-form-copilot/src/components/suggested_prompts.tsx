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
      <div className="flex flex-col gap-2">
        {PROMPT_KEYS.map((key) => {
          const prompt = t(key)
          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(prompt)}
              className="rounded-md bg-sky-600 px-3 py-2 text-left text-sm font-medium text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {prompt}
            </button>
          )
        })}
      </div>
    </div>
  )
}
