import { Loader2, Mic, X } from 'lucide-react'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import type { TranscriptionDestination } from '../../lib/voice/resolve_capability'
import type { VoiceStatus } from './hooks/use_audio_recorder'
import { VoiceWaveform } from './voice_waveform'

type VoiceBarStatus = Exclude<VoiceStatus, 'idle'>

// Presentational composer replacement while recording is in flight. Owns no
// state — `status` comes straight from the recorder hook. There is no error
// variant: failures land back on `idle` and chat_pane renders the inline error
// (D18). Cancel is available in every non-idle state.
export const VoiceInputBar = ({
  status,
  level,
  elapsedMs,
  destination,
  onRecord,
  onStop,
  onCancel,
}: {
  status: VoiceBarStatus
  level: readonly number[]
  elapsedMs: number
  destination: TranscriptionDestination | null
  onRecord: () => void
  onStop: () => void
  onCancel: () => void
}) => {
  const { t } = useTranslation()

  // Recipient-specific disclosure (V1 #7): the copy names exactly who receives
  // the audio for the frozen destination — never a false "SimplePDF" claim for
  // a BYOK path. Frozen before the armed view renders.
  const disclosureText = ((): string => {
    if (destination === null) {
      return t('voice.disclosureDemo')
    }
    switch (destination.kind) {
      case 'demo':
        return t('voice.disclosureDemo')
      case 'openai-byok':
        return t('voice.disclosureOpenaiByok')
      case 'custom-byok':
        return t('voice.disclosureCustomByok', { host: destination.host })
      default:
        destination satisfies never
        return t('voice.disclosureDemo')
    }
  })()

  const liveStatusKey = ((): string | null => {
    switch (status) {
      case 'armed':
        return null
      case 'recording':
        return 'voice.statusRecording'
      case 'transcribing':
        return 'voice.statusTranscribing'
      default:
        status satisfies never
        return null
    }
  })()

  const content = ((): ReactElement => {
    switch (status) {
      case 'armed':
        return (
          <>
            <span className="flex-1 text-xs leading-tight text-slate-500">{disclosureText}</span>
            <button
              type="button"
              onClick={onRecord}
              aria-label={t('voice.recordLabel')}
              className="flex h-8 flex-none items-center gap-1.5 rounded-full bg-rose-600 px-3 text-sm font-medium text-white transition-colors hover:bg-rose-700"
            >
              <Mic size={15} aria-hidden="true" />
              {t('voice.record')}
            </button>
          </>
        )
      case 'recording':
        return (
          <>
            <button
              type="button"
              onClick={onStop}
              aria-label={t('voice.stopLabel')}
              className="relative flex h-8 w-8 flex-none items-center justify-center rounded-full bg-rose-600 text-white transition-colors hover:bg-rose-700"
            >
              {/* Pulsing ring signals "live recording"; removed under reduced motion. */}
              <span
                className="absolute inset-0 rounded-full bg-rose-500/40 motion-safe:animate-ping"
                aria-hidden="true"
              />
              <span className="relative h-3 w-3 rounded-[2px] bg-current" aria-hidden="true" />
            </button>
            <div className="flex flex-1 items-center text-slate-600">
              <VoiceWaveform level={level} elapsedMs={elapsedMs} ariaLabel={t('voice.waveformLabel')} />
            </div>
          </>
        )
      case 'transcribing':
        return (
          <span className="flex flex-1 items-center gap-2 text-sm text-slate-500">
            <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
            {t('voice.transcribing')}
          </span>
        )
      default:
        status satisfies never
        throw new Error(`unhandled voice status: ${String(status)}`)
    }
  })()

  return (
    <div
      className="flex flex-1 items-center gap-2 rounded-3xl border border-solid border-slate-200 bg-white px-3 py-1.5"
      style={{ borderWidth: '1px' }}
    >
      {content}
      <button
        type="button"
        onClick={onCancel}
        aria-label={t('voice.cancelLabel')}
        className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
      >
        <X size={18} aria-hidden="true" />
      </button>
      <span className="sr-only" aria-live="polite">
        {liveStatusKey === null ? '' : t(liveStatusKey)}
      </span>
    </div>
  )
}
