import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getToolKind, HourglassIcon, ToolIcon } from './tool_icons'
import { ToolInvocationCard } from './tool_invocation_card'

export type ToolInvocationPart = {
  key: string
  toolName: string
  state: 'input-streaming' | 'input-available' | 'output-available' | 'output-error'
}

type ToolInvocationGroupProps = {
  parts: ToolInvocationPart[]
}

export const ToolInvocationGroup = ({ parts }: ToolInvocationGroupProps) => {
  const { t } = useTranslation()
  // null = no user interaction yet → auto-expand on error. Once the user
  // clicks the disclosure, their choice (true/false) wins, even if another
  // error arrives later. Trades "force the user to see new errors" for
  // "respect the explicit collapse" — losing the auto-expand on subsequent
  // errors is recoverable (one click), being unable to collapse is not.
  const [userOverride, setUserOverride] = useState<boolean | null>(null)
  const hasError = parts.some((part) => part.state === 'output-error')
  const isAnyRunning = parts.some(
    (part) => part.state === 'input-streaming' || part.state === 'input-available',
  )
  const isExpanded = userOverride ?? hasError
  const groupedIconClassName = hasError ? 'text-rose-500' : 'text-slate-500'

  if (parts.length === 1) {
    const part = parts[0]
    return <ToolInvocationCard toolName={part.toolName} state={part.state} />
  }

  return (
    <div className="my-2 rounded-md border border-slate-200 bg-slate-50">
      <button
        type="button"
        onClick={() => setUserOverride(!isExpanded)}
        aria-expanded={isExpanded}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-slate-800 hover:bg-slate-100"
      >
        <span className="flex items-center gap-2.5">
          {/* Precedence: any tool still loading → spinner (wins over error,
              so a mid-flight failure in a 3-tool group still signals
              "things are in progress"). The wrapper colours the icon
              rose-500 when hasError, so a mixed running+error group shows
              a red spinner (both signals at once). When nothing is loading,
              the dominant kind icon stands in, also coloured rose-500 on
              failure. */}
          <span className={groupedIconClassName}>
            {isAnyRunning ? <HourglassIcon size={14} /> : <ToolIcon kind={dominantKind(parts)} />}
          </span>
          <span>{t('toolInvocation.groupSummary', { count: parts.length })}</span>
        </span>
        <Caret isOpen={isExpanded} />
      </button>
      {isExpanded ? (
        <div className="border-t border-slate-200 px-2 pb-1">
          {parts.map((part) => (
            <ToolInvocationCard key={part.key} toolName={part.toolName} state={part.state} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

const dominantKind = (parts: ToolInvocationPart[]): 'read' | 'write' => {
  return parts.some((part) => getToolKind(part.toolName) === 'write') ? 'write' : 'read'
}

const Caret = ({ isOpen }: { isOpen: boolean }) => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
    aria-hidden="true"
  >
    <path
      d="M6 9l6 6 6-6"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)
