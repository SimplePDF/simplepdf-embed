import { type ReactElement, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { classifyError, getErrorDisplayMessage, type KnownErrorKind } from '../lib/error-classifier'

type ErrorBannerProps = {
  error: Error
  onSwitchModel: () => void
}

// Each branch has its own visual treatment (amber for the rate-limit demo
// nudge, rose for every other failure). A switch on the classifier output
// keeps the exhaustiveness guard at the default arm.
export const ErrorBanner = ({ error, onSwitchModel }: ErrorBannerProps): ReactElement => {
  const kind = classifyError(error)
  switch (kind) {
    case 'authentication':
      return <AuthPanel onSwitchModel={onSwitchModel} />
    case 'demo_rate_limited':
      return <RateLimitPanel onSwitchModel={onSwitchModel} />
    case 'server':
      return <ServerPanel message={getErrorDisplayMessage(error)} />
    case null:
      return <GenericPanel message={getErrorDisplayMessage(error)} />
    default:
      kind satisfies never
      return <GenericPanel message={getErrorDisplayMessage(error)} />
  }
}

type SwitchModelProps = { onSwitchModel: () => void }

const AuthPanel = ({ onSwitchModel }: SwitchModelProps): ReactElement => {
  const { t } = useTranslation()
  return (
    <div className="rounded border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
      <div className="font-medium">{t('chat.errorAuthTitle')}</div>
      <div className="mt-1">
        <Trans
          i18nKey="chat.errorAuthBody"
          components={{
            switchModel: (
              <button
                type="button"
                onClick={onSwitchModel}
                className="font-medium underline underline-offset-2 hover:text-rose-900"
              />
            ),
          }}
        />
      </div>
    </div>
  )
}

const RateLimitPanel = ({ onSwitchModel }: SwitchModelProps): ReactElement => {
  const { t } = useTranslation()
  return (
    <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
      <div className="font-medium">{t('chat.errorRateLimitedTitle')}</div>
      <div className="mt-1">
        <Trans
          i18nKey="chat.errorRateLimitedBody"
          components={{
            switchModel: (
              <button
                type="button"
                onClick={onSwitchModel}
                className="font-medium underline underline-offset-2 hover:text-amber-950"
              />
            ),
          }}
        />
      </div>
    </div>
  )
}

type MessagePanelProps = { message: string }

const ServerPanel = ({ message }: MessagePanelProps): ReactElement => {
  const { t } = useTranslation()
  return (
    <div className="rounded border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
      <div className="font-medium">{t('chat.errorServerTitle')}</div>
      <pre className="mt-2 max-h-48 overflow-auto rounded border border-rose-200 bg-white p-2 text-[11px] leading-relaxed text-slate-700">
        <code>{message}</code>
      </pre>
    </div>
  )
}

const GenericPanel = ({ message }: MessagePanelProps): ReactElement => {
  const { t } = useTranslation()
  const [isExpanded, setIsExpanded] = useState(false)
  return (
    <div className="rounded border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
      <button
        type="button"
        onClick={() => setIsExpanded((value) => !value)}
        aria-expanded={isExpanded}
        className="flex w-full items-center justify-between gap-2 text-left font-medium"
      >
        <span>{t('chat.errorGenericTitle')}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
        >
          <path
            d="M6 9l6 6 6-6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {isExpanded ? (
        <pre className="mt-2 max-h-48 overflow-auto rounded border border-rose-200 bg-white p-2 text-[11px] leading-relaxed text-slate-700">
          <code>{message}</code>
        </pre>
      ) : null}
    </div>
  )
}

// Re-export the classifier kind for callers that need to type-check against
// the panels' decision surface.
export type { KnownErrorKind }
