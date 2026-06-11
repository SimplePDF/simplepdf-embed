import { Check, Loader2, X } from 'lucide-react'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import type { TranscriptionDestination } from '../../lib/voice/resolve_capability'
import type { VoiceStatus } from './hooks/use_audio_recorder'
import { VoiceWaveform } from './voice_waveform'

type VoiceBarStatus = Exclude<VoiceStatus, 'idle'>

// Non-idle composer content (P070-03). Rendered INSIDE the shared composer box
// (chat_pane owns the border/radius/padding) as a fragment, so swapping
// idle↔recording causes NO layout shift: the prompt span occupies the
// textarea's row (same font/size as the placeholder, but user-select-none since
// it is not editable) and the action row holds the recording controls where
// mic+send sit when idle. The prompt names the actual audio recipient before
// the user presses ✓ (audio egresses only on ✓) — never a false "SimplePDF"
// claim for BYOK, preserving the P070-02 consent guarantee.
export const VoiceInputBar = ({
  status,
  level,
  elapsedMs,
  destination,
  onStop,
  onCancel,
}: {
  status: VoiceBarStatus
  level: readonly number[]
  elapsedMs: number
  destination: TranscriptionDestination | null
  onStop: () => void
  onCancel: () => void
}): ReactElement => {
  const { t } = useTranslation()

  const prompt = ((): string => {
    if (destination === null) {
      return t('voice.promptDemo')
    }
    switch (destination.kind) {
      case 'demo':
        return t('voice.promptDemo')
      case 'openai-byok':
        return t('voice.promptOpenaiByok')
      case 'custom-byok':
        return t('voice.promptCustomByok', { host: destination.host })
      default:
        destination satisfies never
        return t('voice.promptDemo')
    }
  })()

  const liveStatusKey = ((): string => {
    switch (status) {
      case 'recording':
        return 'voice.statusRecording'
      case 'transcribing':
        return 'voice.statusTranscribing'
      default:
        status satisfies never
        return 'voice.statusRecording'
    }
  })()

  const cancelButton = (
    <button
      type="button"
      onClick={onCancel}
      aria-label={t('voice.cancelLabel')}
      className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
    >
      <X size={18} aria-hidden="true" />
    </button>
  )

  const actionRow = ((): ReactElement => {
    switch (status) {
      case 'recording':
        return (
          <>
            <div className="flex flex-1 items-center text-slate-600">
              <VoiceWaveform level={level} elapsedMs={elapsedMs} ariaLabel={t('voice.waveformLabel')} />
            </div>
            {cancelButton}
            <button
              type="button"
              onClick={onStop}
              aria-label={t('voice.stopLabel')}
              className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-sky-600 text-white transition-colors hover:bg-sky-700"
            >
              <Check size={18} strokeWidth={3} aria-hidden="true" />
            </button>
          </>
        )
      case 'transcribing':
        return (
          <>
            <span className="flex flex-1 items-center gap-2 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
              {t('voice.transcribing')}
            </span>
            {cancelButton}
          </>
        )
      default:
        status satisfies never
        throw new Error(`unhandled voice status: ${String(status)}`)
    }
  })()

  return (
    <>
      <span className="block w-full select-none text-sm leading-5 text-slate-400">{prompt}</span>
      <div className="flex items-center justify-end gap-1">{actionRow}</div>
      <span className="sr-only" aria-live="polite">
        {t(liveStatusKey)}
      </span>
    </>
  )
}
