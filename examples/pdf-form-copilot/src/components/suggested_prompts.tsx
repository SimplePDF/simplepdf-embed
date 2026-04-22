type SuggestedPromptsProps = {
  onSelect: (prompt: string) => void
  disabled: boolean
}

const PROMPTS: string[] = [
  'Help me fill this form',
  'Explain each field in one sentence',
]

export const SuggestedPrompts = ({ onSelect, disabled }: SuggestedPromptsProps) => {
  return (
    <div className="space-y-2 p-4">
      <p className="text-xs font-medium text-slate-500">Try one of these:</p>
      <div className="flex flex-col gap-2">
        {PROMPTS.map((prompt) => (
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
