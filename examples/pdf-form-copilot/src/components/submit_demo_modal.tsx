import type { ReactElement } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Modal, ModalCloseButton } from './modal'

type SubmitDemoModalProps = {
  open: boolean
  onClose: () => void
}

export const SubmitDemoModal = ({ open, onClose }: SubmitDemoModalProps): ReactElement | null => {
  const { t } = useTranslation()
  return (
    <Modal open={open} onClose={onClose} labelledBy="submit-demo-modal-title" size="sm">
      <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4">
        <h2 id="submit-demo-modal-title" className="text-[17px] font-semibold leading-snug text-slate-900">
          {t('submitDemo.headline')}
        </h2>
        <ModalCloseButton onClose={onClose} ariaLabel={t('submitDemo.close')} />
      </div>

      <div className="space-y-3 px-6 pb-5">
        <p className="text-[13.5px] leading-relaxed text-slate-600">{t('submitDemo.body')}</p>
        <p className="text-[12px] leading-relaxed text-slate-500">
          <Trans
            i18nKey="submitDemo.bodySubtext"
            components={{
              fields: (
                <a
                  href="https://simplepdf.com/help/how-to/add-required-fields-on-pdf-forms"
                  target="_blank"
                  rel="noreferrer"
                  className="text-slate-900 hover:underline"
                />
              ),
              flows: (
                <a
                  href="https://simplepdf.com/help/how-to/configure-webhooks-pdf-form-submissions"
                  target="_blank"
                  rel="noreferrer"
                  className="text-slate-900 hover:underline"
                />
              ),
            }}
          />
        </p>
      </div>

      <footer className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-6 py-3.5 text-[12px]">
        <a
          href="https://simplepdf.com?s=form-copilot"
          target="_blank"
          rel="noreferrer"
          className="font-medium text-sky-600 hover:text-sky-700"
        >
          {t('submitDemo.learnMore')}
        </a>
        <a
          href="https://simplepdf.com/contact?help=schedule_a_demo"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center rounded-md bg-sky-600 px-3 py-1.5 text-[12px] font-medium text-white transition hover:bg-sky-700"
        >
          {t('submitDemo.requestDemo')}
        </a>
      </footer>
    </Modal>
  )
}
