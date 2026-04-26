import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, ModalCloseButton } from '../ui/modal'

type DefaultPromptModalProps = {
  open: boolean
  onClose: () => void
  prompt: string
}

type CopyState = 'idle' | 'copied' | 'failed'

const COPY_FEEDBACK_MS = 1500

export const DefaultPromptModal = ({ open, onClose, prompt }: DefaultPromptModalProps) => {
  const { t } = useTranslation()
  const [copyState, setCopyState] = useState<CopyState>('idle')

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopyState('copied')
    } catch {
      // Clipboard write can fail in non-secure contexts (HTTP, sandboxed
      // iframe). Surface the fallback path so the user knows to select +
      // copy by hand from the textarea below.
      setCopyState('failed')
    }
    window.setTimeout(() => setCopyState('idle'), COPY_FEEDBACK_MS)
  }

  const copyLabelKey =
    copyState === 'copied'
      ? 'chat.modelPicker.defaultPromptCopied'
      : copyState === 'failed'
        ? 'chat.modelPicker.defaultPromptCopyFailed'
        : 'chat.modelPicker.defaultPromptCopy'

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="default-prompt-title"
      containerClassName="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-xl"
    >
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-4">
        <div className="min-w-0">
          <h2 id="default-prompt-title" className="text-base font-semibold text-slate-900">
            {t('chat.modelPicker.defaultPromptTitle')}
          </h2>
          <p className="mt-1 text-xs text-slate-500">{t('chat.modelPicker.defaultPromptSubtitle')}</p>
        </div>
        <ModalCloseButton onClose={onClose} />
      </div>
      <div className="flex flex-col gap-3 p-4">
        <textarea
          readOnly
          value={prompt}
          className="h-[60vh] w-full resize-none rounded-md border border-slate-200 bg-slate-50 p-3 font-mono text-[11px] leading-relaxed text-slate-700"
        />
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              void handleCopy()
            }}
            className={`rounded-md border bg-white px-3 py-1.5 text-xs ${
              copyState === 'failed'
                ? 'border-rose-200 text-rose-600'
                : 'border-slate-200 text-slate-600 hover:border-sky-600 hover:text-sky-700'
            }`}
          >
            {t(copyLabelKey)}
          </button>
        </div>
      </div>
    </Modal>
  )
}
