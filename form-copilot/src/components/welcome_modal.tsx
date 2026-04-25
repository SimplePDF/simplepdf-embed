import { type ReactElement, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from './ui/button'
import { ModalCloseButton } from './ui/modal'

type WelcomeModalProps = {
  open: boolean
  onClose: () => void
  onOpenInfo: () => void
}

const TITLE_ID = 'welcome-modal-title'
const ILLUSTRATION_URL = 'https://cdn.simplepdf.com/simple-pdf/assets/common/form-copilot-illustration.png'
const LOGO_URL = 'https://cdn.simplepdf.com/simple-pdf/assets/common/logo-white.png'

// First-load splash. Rendered inline (NOT through createPortal) so the
// SSR pass can include the markup directly in the initial HTML — the open
// state is seeded from the welcome-dismissed cookie read server-side. No
// portal target on the server, no localStorage, no hydration mismatch.
//
// Mobile gating happens in CSS (`hidden lg:flex`): the modal HTML ships to
// every visitor but is invisible below 1024px, where Layout's mobile
// fallback ("Form Copilot is best experienced on desktop") takes over.
export const WelcomeModal = ({ open, onClose, onOpenInfo }: WelcomeModalProps): ReactElement | null => {
  const { t, i18n } = useTranslation()
  const isEnglish = i18n.language.toLowerCase().startsWith('en')

  useEffect(() => {
    if (!open) {
      return
    }
    const handleKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('keydown', handleKey)
    }
  }, [open, onClose])

  if (!open) {
    return null
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={TITLE_ID}
      className="fixed inset-0 z-50 hidden items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm lg:flex"
      onClick={onClose}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: inner panel stops backdrop-close propagation, not interactive on its own. */}
      <div
        className="relative w-full max-w-[1040px] overflow-hidden rounded-lg bg-white shadow-2xl ring-1 ring-slate-900/5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="absolute right-3 top-3 z-10">
          <ModalCloseButton onClose={onClose} ariaLabel={t('welcomeModal.close')} />
        </div>
        <div className="grid grid-cols-2 bg-[#96cafc]">
          <div className="flex items-end justify-center">
            <img
              src={ILLUSTRATION_URL}
              alt=""
              aria-hidden="true"
              className="block h-auto w-full object-contain"
            />
          </div>
          <div className="flex flex-col gap-2 p-8">
            <h2
              id={TITLE_ID}
              className="mt-10 text-7xl font-extrabold leading-[1.05] tracking-tight text-slate-900"
            >
              Form Copilot
            </h2>
            <p className="max-w-[340px] text-[48px] font-bold leading-[1.1] text-slate-900">
              {isEnglish ? (
                <>
                  <span className="text-blue-600">AI that helps</span> users fill PDF forms step by
                  step
                </>
              ) : (
                t('header.tagline')
              )}
            </p>
            <div className="mt-auto flex flex-col items-start gap-3">
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
        </div>
        <img
          src={LOGO_URL}
          alt=""
          aria-hidden="true"
          className="absolute bottom-4 right-4 h-32 w-32 opacity-90"
        />
      </div>
    </div>
  )
}
