import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ToolInvocationCard } from './tool_invocation_card'

export type ToolInvocationPart = {
  key: string
  toolName: string
  state: 'input-streaming' | 'input-available' | 'output-available' | 'output-error'
  input?: unknown
  output?: unknown
  errorText?: string
}

type ToolInvocationGroupProps = {
  parts: ToolInvocationPart[]
  showDetails: boolean
}

export const ToolInvocationGroup = ({ parts, showDetails }: ToolInvocationGroupProps) => {
  const { t } = useTranslation()
  const [isExpanded, setIsExpanded] = useState(false)

  if (parts.length === 1) {
    const part = parts[0]
    return (
      <ToolInvocationCard
        toolName={part.toolName}
        state={part.state}
        showDetails={showDetails}
        input={part.input}
        output={part.output}
        errorText={part.errorText}
      />
    )
  }

  return (
    <div className="my-2 rounded-md border border-slate-200 bg-slate-50">
      <button
        type="button"
        onClick={() => setIsExpanded((open) => !open)}
        aria-expanded={isExpanded}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-slate-800 hover:bg-slate-100"
      >
        <span>{t('toolInvocation.groupSummary', { count: parts.length })}</span>
        <Caret isOpen={isExpanded} />
      </button>
      {isExpanded ? (
        <div className="border-t border-slate-200 px-2 pb-1">
          {parts.map((part) => (
            <ToolInvocationCard
              key={part.key}
              toolName={part.toolName}
              state={part.state}
              showDetails={showDetails}
              input={part.input}
              output={part.output}
              errorText={part.errorText}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
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
