import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { getToolKind, ToolIcon } from './tool_icons'

type ToolInvocationState = 'input-streaming' | 'input-available' | 'output-available' | 'output-error'

type ToolInvocationCardProps = {
  toolName: string
  state: ToolInvocationState
  showDetails: boolean
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

const BADGE_TONES: Record<'input-streaming' | 'input-available', string> = {
  'input-streaming': 'bg-slate-100 text-slate-500',
  'input-available': 'bg-sky-100 text-sky-700',
}

const StateBadge = ({ state }: { state: ToolInvocationState }) => {
  const { t } = useTranslation()
  if (state === 'output-available') {
    return (
      <span aria-label={t('toolInvocation.states.output-available')} className="text-emerald-500">
        <SuccessIcon />
      </span>
    )
  }
  if (state === 'output-error') {
    return (
      <span aria-label={t('toolInvocation.states.output-error')} className="text-rose-500">
        <ErrorIcon />
      </span>
    )
  }
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${BADGE_TONES[state]}`}>
      {t(`toolInvocation.states.${state}`)}
    </span>
  )
}

const SuccessIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path fillRule="evenodd" clipRule="evenodd" d="M12 1.25C6.06294 1.25 1.25 6.06294 1.25 12C1.25 17.9371 6.06294 22.75 12 22.75C17.9371 22.75 22.75 17.9371 22.75 12C22.75 6.06294 17.9371 1.25 12 1.25ZM7.53044 11.9697C7.23755 11.6768 6.76268 11.6768 6.46978 11.9697C6.17689 12.2626 6.17689 12.7374 6.46978 13.0303L9.46978 16.0303C9.76268 16.3232 10.2376 16.3232 10.5304 16.0303L17.5304 9.03033C17.8233 8.73744 17.8233 8.26256 17.5304 7.96967C17.2375 7.67678 16.7627 7.67678 16.4698 7.96967L10.0001 14.4393L7.53044 11.9697Z" />
  </svg>
)

const ErrorIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path fillRule="evenodd" clipRule="evenodd" d="M12 1.25C6.06294 1.25 1.25 6.06294 1.25 12C1.25 17.9371 6.06294 22.75 12 22.75C17.9371 22.75 22.75 17.9371 22.75 12C22.75 6.06294 17.9371 1.25 12 1.25ZM9.70164 8.64124C9.40875 8.34835 8.93388 8.34835 8.64098 8.64124C8.34809 8.93414 8.34809 9.40901 8.64098 9.7019L10.9391 12L8.64098 14.2981C8.34809 14.591 8.34809 15.0659 8.64098 15.3588C8.93388 15.6517 9.40875 15.6517 9.70164 15.3588L11.9997 13.0607L14.2978 15.3588C14.5907 15.6517 15.0656 15.6517 15.3585 15.3588C15.6514 15.0659 15.6514 14.591 15.3585 14.2981L13.0604 12L15.3585 9.7019C15.6514 9.40901 15.6514 8.93414 15.3585 8.64124C15.0656 8.34835 14.5907 8.34835 14.2978 8.64124L11.9997 10.9393L9.70164 8.64124Z" />
  </svg>
)

export const ToolInvocationCard = ({
  toolName,
  state,
  showDetails,
  input,
  output,
  errorText,
}: ToolInvocationCardProps): ReactNode => {
  const { t } = useTranslation()
  return (
    <div className="my-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 font-medium text-slate-800">
          <ToolIcon kind={getToolKind(toolName)} />
          {t(`toolInvocation.names.${toolName}`, { defaultValue: t('toolInvocation.fallbackName', { tool: toolName }) })}
        </span>
        <StateBadge state={state} />
      </div>
      {showDetails && input !== undefined ? (
        <pre className="mt-1 whitespace-pre-wrap break-all text-[11px] text-slate-500">
          {t('toolInvocation.argsLabel')} {short(input)}
        </pre>
      ) : null}
      {showDetails && state === 'output-available' && output !== undefined ? (
        <pre className="mt-1 whitespace-pre-wrap break-all text-[11px] text-slate-500">{short(output)}</pre>
      ) : null}
      {showDetails && state === 'output-error' && errorText !== undefined ? (
        <pre className="mt-1 whitespace-pre-wrap break-all text-[11px] text-rose-600">{errorText}</pre>
      ) : null}
    </div>
  )
}
