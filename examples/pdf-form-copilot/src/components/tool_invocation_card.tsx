import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

type ToolInvocationState = 'input-streaming' | 'input-available' | 'output-available' | 'output-error'

type ToolInvocationCardProps = {
  toolName: string
  state: ToolInvocationState
  input?: unknown
  output?: unknown
  errorText?: string
}

const short = (value: unknown): string => {
  if (value === undefined) return ''
  const text = JSON.stringify(value)
  if (text === undefined) return ''
  return text.length > 140 ? `${text.slice(0, 137)}...` : text
}

const BADGE_TONES: Record<ToolInvocationState, string> = {
  'input-streaming': 'bg-slate-100 text-slate-500',
  'input-available': 'bg-sky-100 text-sky-700',
  'output-available': 'bg-emerald-100 text-emerald-700',
  'output-error': 'bg-rose-100 text-rose-700',
}

const StateBadge = ({ state }: { state: ToolInvocationState }) => {
  const { t } = useTranslation()
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${BADGE_TONES[state]}`}>
      {t(`toolInvocation.states.${state}`)}
    </span>
  )
}

export const ToolInvocationCard = ({ toolName, state, input, output, errorText }: ToolInvocationCardProps): ReactNode => {
  const { t } = useTranslation()
  return (
    <div className="my-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-mono font-semibold text-slate-800">{toolName}</span>
        <StateBadge state={state} />
      </div>
      {input !== undefined ? (
        <pre className="mt-1 whitespace-pre-wrap break-all text-[11px] text-slate-500">
          {t('toolInvocation.argsLabel')} {short(input)}
        </pre>
      ) : null}
      {state === 'output-available' && output !== undefined ? (
        <pre className="mt-1 whitespace-pre-wrap break-all text-[11px] text-slate-500">{short(output)}</pre>
      ) : null}
      {state === 'output-error' && errorText !== undefined ? (
        <pre className="mt-1 whitespace-pre-wrap break-all text-[11px] text-rose-600">{errorText}</pre>
      ) : null}
    </div>
  )
}
