import type { ReactElement, Ref } from 'react'
import { TextInput } from './text_input'

// Canonical credential / config field for the model picker (Chat AND
// Speech-to-Text tabs): an optional uppercase label, the shared TextInput, and
// a single helper line below that flips from slate (hint) to rose (error). This
// is the one owner of that field markup — the two tabs were copy-pasted before
// and drifted (missing labels, hardcoded placeholders, an unstyled disclosure),
// so both now render through here and cannot diverge again.
export const LabeledField = ({
  id,
  label,
  type,
  value,
  onChange,
  placeholder,
  hint,
  error,
  inputRef,
  autoComplete,
  spellCheck,
}: {
  id?: string
  label: string | null
  type: 'text' | 'url' | 'password'
  value: string
  onChange: (value: string) => void
  placeholder: string
  // Helper text under the field. `null` renders no helper line (unless an
  // error is present). `error`, when set, replaces the hint with rose copy and
  // flips the input border to invalid.
  hint: string | null
  error: string | null
  inputRef?: Ref<HTMLInputElement>
  autoComplete?: string
  spellCheck?: boolean
}): ReactElement => {
  const helper = ((): ReactElement | null => {
    if (error !== null) {
      return <p className="mt-1 text-[11px] text-rose-600">{error}</p>
    }
    if (hint !== null) {
      return <p className="mt-1 text-[11px] text-slate-500">{hint}</p>
    }
    return null
  })()
  return (
    <div>
      {label !== null ? (
        <label htmlFor={id} className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
          {label}
        </label>
      ) : null}
      <TextInput
        id={id}
        inputRef={inputRef}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        invalid={error !== null}
        className={label !== null ? 'mt-1' : undefined}
        autoComplete={autoComplete}
        spellCheck={spellCheck}
      />
      {helper}
    </div>
  )
}
