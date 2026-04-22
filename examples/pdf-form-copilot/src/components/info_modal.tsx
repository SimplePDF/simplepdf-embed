import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import type { FormId } from '../lib/forms'

type InfoModalProps = {
  open: boolean
  onClose: () => void
  onSelectForm: (formId: FormId) => void
}

type UseCaseKey = 'healthcare' | 'insurance' | 'state' | 'hr'

type UseCase = {
  key: UseCaseKey
  formId: FormId | null
}

const USE_CASES: UseCase[] = [
  { key: 'healthcare', formId: 'healthcare' },
  { key: 'insurance', formId: null },
  { key: 'state', formId: 'state' },
  { key: 'hr', formId: 'hr' },
]

export const InfoModal = ({ open, onClose, onSelectForm }: InfoModalProps) => {
  const { t } = useTranslation()

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

  if (!open || typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="info-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <h2 id="info-modal-title" className="text-lg font-semibold text-slate-900">
              {t('infoModal.title')}
            </h2>
            <div className="flex items-center gap-3 text-xs">
              <a
                href="https://github.com/SimplePDF/simplepdf-embed/tree/main/examples/pdf-form-copilot"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-sky-600 hover:text-sky-700"
              >
                {t('infoModal.sourceCode')}
              </a>
              <iframe
                title={t('infoModal.githubStarTitle')}
                src="https://ghbtns.com/github-btn.html?user=SimplePDF&repo=simplepdf-embed&type=star&count=true"
                frameBorder={0}
                scrolling="0"
                width={110}
                height={20}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('infoModal.close')}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="mt-4 space-y-5 text-sm leading-relaxed text-slate-700">
          <section className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            <p>
              {t('infoModal.poweredBySimplePdfPro')}{' '}
              <a
                href="https://simplepdf.com/pricing"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-sky-600 hover:text-sky-700"
              >
                {t('infoModal.proPlanLink')}
              </a>
            </p>
          </section>

          <section className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <p>{t('infoModal.disclaimer')}</p>
            <p>
              <strong>{t('infoModal.piiWarningLeadIn')}</strong> {t('infoModal.piiWarning')}
            </p>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-slate-900">{t('infoModal.whyItMattersTitle')}</h3>
            <p className="mt-1">{t('infoModal.whyItMattersBody')}</p>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-slate-900">{t('infoModal.humanInTheLoopTitle')}</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>{t('infoModal.humanInTheLoopBullet1')}</li>
              <li>{t('infoModal.humanInTheLoopBullet2')}</li>
            </ul>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-slate-900">{t('infoModal.aboutTitle')}</h3>
            <p className="mt-1 text-xs text-slate-600">{t('infoModal.aboutIntro')}</p>
            <ul className="mt-2 space-y-2 text-xs">
              <li>
                <span className="font-semibold text-slate-900">{t('infoModal.aboutBullet1Title')}</span>{' '}
                <span className="text-slate-600">{t('infoModal.aboutBullet1Body')}</span>
              </li>
              <li>
                <span className="font-semibold text-slate-900">{t('infoModal.aboutBullet2Title')}</span>{' '}
                <span className="text-slate-600">{t('infoModal.aboutBullet2Body')}</span>
              </li>
              <li>
                <span className="font-semibold text-slate-900">{t('infoModal.aboutBullet3Title')}</span>{' '}
                <span className="text-slate-600">{t('infoModal.aboutBullet3Body')}</span>
              </li>
            </ul>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-slate-900">{t('infoModal.useCasesTitle')}</h3>
            <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {USE_CASES.map((useCase) => {
                const isClickable = useCase.formId !== null
                const baseClass = 'flex flex-col rounded-md border p-3 text-left transition'
                const title = t(`infoModal.useCases.${useCase.key}.title`)
                const body = t(`infoModal.useCases.${useCase.key}.body`)
                if (isClickable) {
                  return (
                    <button
                      key={useCase.key}
                      type="button"
                      onClick={() => {
                        if (useCase.formId === null) {
                          return
                        }
                        onSelectForm(useCase.formId)
                        onClose()
                      }}
                      className={`${baseClass} cursor-pointer border-slate-200 bg-slate-50 hover:border-sky-300 hover:bg-sky-50`}
                    >
                      <div className="text-sm font-semibold text-slate-900">{title}</div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">{body}</p>
                      <span className="mt-2 text-[11px] font-medium text-sky-600">{t('infoModal.tryThisForm')}</span>
                    </button>
                  )
                }
                return (
                  <div key={useCase.key} className={`${baseClass} border-slate-200 bg-slate-50`}>
                    <div className="text-sm font-semibold text-slate-900">{title}</div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">{body}</p>
                  </div>
                )
              })}
            </div>
            <p className="mt-3 text-xs text-slate-500">{t('infoModal.useCasesFooter')}</p>
          </section>
        </div>
      </div>
    </div>,
    document.body,
  )
}
