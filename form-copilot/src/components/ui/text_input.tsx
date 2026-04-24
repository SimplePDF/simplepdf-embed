import type { InputHTMLAttributes, ReactElement, Ref } from 'react'

type TextInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> & {
  invalid?: boolean
  inputRef?: Ref<HTMLInputElement>
  className?: string
}

const BASE_CLASS =
  'w-full rounded-md bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none'

const BORDER_CLASS = {
  default: 'border border-slate-200 focus:border-sky-600',
  invalid: 'border border-rose-400 focus:border-rose-500',
}

// Shared text / url / password input styling. Pass `invalid` to flip the
// border to rose. the component stays uncontrolled otherwise, mirroring
// the native element's contract.
export const TextInput = ({
  invalid = false,
  inputRef,
  className,
  ...rest
}: TextInputProps): ReactElement => {
  const border = invalid ? BORDER_CLASS.invalid : BORDER_CLASS.default
  const merged = className === undefined ? `${BASE_CLASS} ${border}` : `${BASE_CLASS} ${border} ${className}`
  // Tailwind's preflight resets `border: 0` on form elements. The utility
  // classes set the color but the WIDTH comes from a UA style that preflight
  // zeroed out. Inline style pins 1px so the ring shows up. Remove only when
  // preflight stops zeroing input borders.
  return <input ref={inputRef} className={merged} style={{ borderWidth: '1px' }} {...rest} />
}
