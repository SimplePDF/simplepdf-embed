import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from './ui/button'
import { Modal, ModalCloseButton } from './ui/modal'

type WelcomeModalProps = {
  open: boolean
  onClose: () => void
  onOpenInfo: () => void
}

const TITLE_ID = 'welcome-modal-title'
const ARTWORK_URL = 'https://cdn.simplepdf.com/simple-pdf/assets/meta/form-copilot-welcome.png'

// First-load splash. The illustration on the left already carries the brand
// + tagline; CTAs sit on the right half of the image, below where the
// headline is rendered in the artwork. The wrapping <Modal> handles backdrop
// dismiss + Escape; the close button sits in the top-right corner of the
// panel, layered above the image so it's reachable without clicking outside.
export const WelcomeModal = ({ open, onClose, onOpenInfo }: WelcomeModalProps): ReactElement => {
  const { t } = useTranslation()
  const panelClass =
    'relative w-full max-w-[936px] overflow-hidden rounded-lg bg-white shadow-2xl ring-1 ring-slate-900/5'
  return (
    <Modal open={open} onClose={onClose} labelledBy={TITLE_ID} containerClassName={panelClass}>
      <div className="absolute right-3 top-3 z-10">
        <ModalCloseButton onClose={onClose} ariaLabel={t('welcomeModal.close')} />
      </div>
      <div className="relative aspect-[2017/1142] w-full">
        <img
          src={ARTWORK_URL}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
        />
        {/* CTA stack overlaid on the right half of the artwork, vertically
            anchored to roughly two-thirds down so it lands beneath the
            existing "step by step" headline rendered in the illustration.
            Modal is gated to lg+ viewports at the call site (the mobile
            fallback in Layout takes over below 1024px), so fixed pixel
            offsets are fine here. */}
        <div className="absolute inset-y-0 right-[62px] flex w-[44%] translate-y-[30px] flex-col items-start justify-end gap-3 px-[5%] pb-[8%]">
          <h2 id={TITLE_ID} className="sr-only">
            {t('welcomeModal.title')}
          </h2>
          <Button size="lg" onClick={onClose}>
            {t('welcomeModal.getStarted')}
          </Button>
          <button
            type="button"
            onClick={onOpenInfo}
            className="text-sm font-medium text-sky-700 underline-offset-4 transition-colors hover:text-sky-800 hover:underline"
          >
            {t('welcomeModal.howItWorks')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
