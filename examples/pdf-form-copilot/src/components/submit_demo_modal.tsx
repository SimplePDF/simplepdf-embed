import type { ReactElement } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { buildSimplepdfUrl } from '../lib/simplepdf_url'
import { Modal, ModalHeader } from './ui/modal'

type SubmitDemoModalProps = {
  open: boolean
  onClose: () => void
  locale: string
}

export const SubmitDemoModal = ({ open, onClose, locale }: SubmitDemoModalProps): ReactElement | null => {
  const { t } = useTranslation()
  const requiredFieldsHref = buildSimplepdfUrl({
    locale,
    path: '/help/how-to/add-required-fields-on-pdf-forms',
  })
  const webhooksHref = buildSimplepdfUrl({
    locale,
    path: '/help/how-to/configure-webhooks-pdf-form-submissions',
  })
  const learnMoreHref = buildSimplepdfUrl({ locale, query: { s: 'form-copilot' } })
  const contactHref = buildSimplepdfUrl({ locale, path: '/contact', query: { help: 'schedule_a_demo' } })
  return (
    <Modal open={open} onClose={onClose} labelledBy="submit-demo-modal-title" size="sm">
      <ModalHeader
        titleId="submit-demo-modal-title"
        title={t('submitDemo.headline')}
        onClose={onClose}
        closeAriaLabel={t('submitDemo.close')}
        className="flex items-start justify-between gap-4 px-6 pt-5 pb-4"
      />

      <div className="space-y-3 px-6 pb-5">
        <p className="text-[13.5px] leading-relaxed text-slate-600">{t('submitDemo.body')}</p>
        <p className="text-[12px] leading-relaxed text-slate-500">
          <Trans
            i18nKey="submitDemo.bodySubtext"
            components={{
              fields: (
                // biome-ignore lint/a11y/useAnchorContent: children injected by i18next <Trans>.
                <a
                  href={requiredFieldsHref}
                  target="_blank"
                  rel="noreferrer"
                  className="text-slate-900 hover:underline"
                />
              ),
              flows: (
                // biome-ignore lint/a11y/useAnchorContent: children injected by i18next <Trans>.
                <a
                  href={webhooksHref}
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
          href={learnMoreHref}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-sky-600 hover:text-sky-700"
        >
          {t('submitDemo.learnMore')}
        </a>
        <a
          href={contactHref}
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
