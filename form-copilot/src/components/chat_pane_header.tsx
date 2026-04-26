import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import type { ByokConfig } from '../lib/byok'
import { LanguagePicker } from './language_picker'

type ChatPaneHeaderProps = {
  byokConfig: ByokConfig | null
  byokModelLabel: string | null
  hasActiveModel: boolean
  isReady: boolean
  // Status message rendered when the chat is not yet active+ready (e.g.
  // "Load a document first", "Waiting for the editor to load…", "Bring
  // your own AI to start chatting"). Already i18n'd by the caller.
  chatStatusMessage: string
  isStreaming: boolean
  onOpenModelPicker: () => void
  onStop: () => void
  language: string
  onLanguageChange: (code: string) => void
}

// Top bar of the chat aside. Title is always "Form Copilot"; the subtext
// switches between three modes:
//   - status message  (chat not yet ready — load doc, loading, no model, …)
//   - model name      (BYOK active — clickable to swap)
//   - "Use your own AI" (demo mode active — clickable to open the picker)
// Right-side controls: language picker + a Stop button while streaming.
export const ChatPaneHeader = ({
  byokConfig,
  byokModelLabel,
  hasActiveModel,
  isReady,
  chatStatusMessage,
  isStreaming,
  onOpenModelPicker,
  onStop,
  language,
  onLanguageChange,
}: ChatPaneHeaderProps): ReactElement => {
  const { t } = useTranslation()
  const showModelAffordance = hasActiveModel && isReady
  return (
    <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
      {/* `min-w-0` lets the header's text flex-children shrink below their
          intrinsic width so `truncate` can actually ellipsis on narrow
          panes instead of forcing overflow. */}
      <div className="min-w-0">
        <h2 className="truncate text-sm font-semibold leading-5 text-slate-900">
          {t('chat.heading')}
        </h2>
        {/* Same leading/height on both branches so the transition from a
            status message to the model affordance doesn't jump the header
            vertically. `block + leading-4 + h-4 + truncate` forces both
            the paragraph and the button into identical line-boxes
            regardless of user-agent button defaults and prevents long
            translations from wrapping into a second (then clipped) line. */}
        {showModelAffordance ? (
          <button
            type="button"
            onClick={onOpenModelPicker}
            className="block h-4 truncate text-left text-xs font-medium leading-4 text-sky-600 hover:text-sky-700"
          >
            {byokConfig !== null && byokModelLabel !== null
              ? byokModelLabel
              : t('chat.useYourOwnAI')}
          </button>
        ) : (
          <p className="block h-4 truncate text-xs leading-4 text-slate-500">
            {chatStatusMessage}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <LanguagePicker value={language} onChange={onLanguageChange} />
        {isStreaming ? (
          <button
            type="button"
            onClick={onStop}
            className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
          >
            {t('chat.stop')}
          </button>
        ) : null}
      </div>
    </div>
  )
}
