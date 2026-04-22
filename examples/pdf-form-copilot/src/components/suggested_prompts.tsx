import type { FormId } from '../lib/forms'

type SuggestedPromptsProps = {
  formId: FormId
  onSelect: (prompt: string) => void
  disabled: boolean
}

const PROMPTS_BY_FORM: Record<FormId, string[]> = {
  w9: [
    'Help me fill this W-9',
    'What should I put in box 3 (federal tax classification)?',
    'Which fields are still empty?',
  ],
  nl: [
    'Help me dit formulier in te vullen',
    'Wat is de juiste categorie in vraag 1?',
    'Welke velden zijn nog leeg?',
  ],
}

export const SuggestedPrompts = ({ formId, onSelect, disabled }: SuggestedPromptsProps) => {
  const prompts = PROMPTS_BY_FORM[formId]
  return (
    <div className="space-y-2 p-4">
      <p className="text-xs font-medium text-slate-500">Try one of these:</p>
      <div className="flex flex-col gap-2">
        {prompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(prompt)}
            className="rounded border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  )
}
