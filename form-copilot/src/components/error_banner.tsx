import { type ReactElement, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { classifyError, getErrorDisplayMessage, type KnownErrorKind } from '../lib/error-classifier'
import { SocialShare } from './social_share'

type ErrorBannerProps = {
  error: Error
  onSwitchModel: () => void
  // When non-null the consumer has a model ready to pick up the
  // conversation on — typically a BYOK key the user just wired, or a share
  // switch. Both rate-limit and authentication banners are stale in that
  // state (the next turn will run on the new model), so both swap to the
  // "You're now using <model>" + Resume panel. If the new model's key is
  // still bad, the resume turn produces a fresh error and the proper
  // banner re-appears within one round-trip — self-healing.
  resumeModelLabel: string | null
  onResume: () => void
}

// Each branch has its own visual treatment (amber for the rate-limit demo
// nudge, rose for every other failure, emerald for the resolution state
// when a new model is wired up). A switch on the classifier output keeps
// the exhaustiveness guard at the default arm.
export const ErrorBanner = ({
  error,
  onSwitchModel,
  resumeModelLabel,
  onResume,
}: ErrorBannerProps): ReactElement => {
  const kind = classifyError(error)
  switch (kind) {
    case 'authentication':
      if (resumeModelLabel !== null) {
        return <ResumePanel modelLabel={resumeModelLabel} onResume={onResume} />
      }
      return <AuthPanel onSwitchModel={onSwitchModel} />
    case 'demo_rate_limited':
      if (resumeModelLabel !== null) {
        return <ResumePanel modelLabel={resumeModelLabel} onResume={onResume} />
      }
      return <RateLimitPanel onSwitchModel={onSwitchModel} />
    case 'server':
      return <ServerPanel message={getErrorDisplayMessage(error)} />
    case 'service_unavailable':
      return <ServiceUnavailablePanel onSwitchModel={onSwitchModel} />
    case null:
      return <GenericPanel message={getErrorDisplayMessage(error)} />
    default:
      kind satisfies never
      return <GenericPanel message={getErrorDisplayMessage(error)} />
  }
}

// Infra-level errors where `error.message` is the upstream's HTML response
// body (DO 503 page, generic load-balancer 5xx, etc.). The payload has no
// useful content, so we show "Something went wrong" + a clean explanation
// + the BYOK escape hatch (switching to your own AI bypasses our server
// entirely, so a DO outage is recoverable without waiting for it to clear).
const ServiceUnavailablePanel = ({ onSwitchModel }: SwitchModelProps): ReactElement => {
  const { t } = useTranslation()
  return (
    <div className="rounded border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
      <div className="font-medium">{t('chat.errorServerTitle')}</div>
      <p className="mt-1 leading-relaxed">
        <Trans
          i18nKey="chat.errorServiceUnavailableBody"
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
      </p>
    </div>
  )
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

type ResumePanelProps = {
  modelLabel: string
  onResume: () => void
}

// Shown when a fresh model has been wired up (BYOK key set, or share
// switched) while an error banner was still visible. Emerald treatment
// signals that the block is lifted; the Resume CTA dismisses the stale
// error and fires a continuation turn on the new model.
const ResumePanel = ({ modelLabel, onResume }: ResumePanelProps): ReactElement => {
  const { t } = useTranslation()
  return (
    <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
      <div className="font-medium">{t('chat.errorByokActivatedTitle', { model: modelLabel })}</div>
      <button
        type="button"
        onClick={onResume}
        className="mt-2 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
      >
        {t('chat.errorByokActivatedButton')}
      </button>
    </div>
  )
}

const RateLimitPanel = ({ onSwitchModel }: SwitchModelProps): ReactElement => {
  const { t } = useTranslation()
  return (
    <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      <div className="text-sm font-semibold">{t('chat.errorRateLimitedTitle')}</div>
      <p className="mt-2 leading-relaxed">{t('chat.errorRateLimitedBodyThanks')}</p>
      <p className="mt-1 leading-relaxed">{t('chat.errorRateLimitedBodyCta')}</p>
      <div className="mt-3">
        <button
          type="button"
          onClick={onSwitchModel}
          className="inline-flex h-8 items-center rounded-md bg-amber-900 px-3 text-sm font-medium text-amber-50 transition hover:bg-amber-950"
        >
          {t('chat.errorRateLimitedCtaButton')}
        </button>
      </div>
      <div className="mt-4 border-t border-amber-200 pt-3">
        <p className="leading-relaxed">{t('chat.shareHero')}</p>
        <div className="mt-2">
          <SocialShare />
        </div>
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
      <div className="font-medium">{t('chat.errorServerTitle')}</div>
      <button
        type="button"
        onClick={() => setIsExpanded((value) => !value)}
        aria-expanded={isExpanded}
        className="mt-2 flex w-full items-center justify-between gap-2 text-left text-[11px] font-medium"
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
