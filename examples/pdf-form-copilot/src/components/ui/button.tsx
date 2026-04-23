import { type ButtonHTMLAttributes, type ReactElement, type ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'
type ButtonSize = 'sm' | 'md'

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> & {
  variant?: ButtonVariant
  size?: ButtonSize
  children: ReactNode
  className?: string
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:
    'bg-sky-600 text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300',
  secondary:
    'border border-slate-200 bg-white text-slate-600 hover:border-sky-600 hover:text-sky-700 disabled:cursor-not-allowed disabled:text-slate-400',
  ghost:
    'text-slate-500 hover:text-sky-700 disabled:cursor-not-allowed disabled:text-slate-300',
}

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'rounded px-2 py-1 text-xs',
  md: 'rounded-md px-3 py-2 text-sm',
}

const BASE_CLASS = 'font-medium transition-colors'

export const Button = ({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...rest
}: ButtonProps): ReactElement => {
  const classes = [BASE_CLASS, VARIANT_CLASS[variant], SIZE_CLASS[size], className]
    .filter((segment): segment is string => segment !== undefined && segment !== '')
    .join(' ')
  return (
    <button {...rest} className={classes}>
      {children}
    </button>
  )
}
