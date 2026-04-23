import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ToolInvocationCard } from './tool_invocation_card'
import { getToolKind, HourglassIcon, ToolIcon } from './tool_icons'

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
  const [isManuallyExpanded, setIsManuallyExpanded] = useState(false)
  const hasError = parts.some((part) => part.state === 'output-error')
  const isAnyRunning = parts.some(
    (part) => part.state === 'input-streaming' || part.state === 'input-available',
  )
  const isExpanded = isManuallyExpanded || hasError

  if (parts.length === 1) {
    const part = parts[0]
    return <ToolInvocationCard toolName={part.toolName} state={part.state} />
  }

  return (
    <div className="my-2 rounded-md border border-slate-200 bg-slate-50">
      <button
        type="button"
        onClick={() => setIsManuallyExpanded((open) => !open)}
        aria-expanded={isExpanded}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-slate-800 hover:bg-slate-100"
      >
        <span className="flex items-center gap-2.5">
          <span className="text-slate-500">
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
    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
