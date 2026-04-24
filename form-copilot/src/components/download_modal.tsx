import type { ReactElement } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { buildSimplepdfUrl } from '../lib/simplepdf_url'
import { Button } from './ui/button'
import { Modal, ModalFooter, ModalHeader } from './ui/modal'

type DownloadModalProps = {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  locale: string
}

export const DownloadModal = ({
  open,
  onClose,
  onConfirm,
  locale,
}: DownloadModalProps): ReactElement | null => {
  const { t } = useTranslation()
  // Pre-filled "message" on the contact form so sales sees the intent at a
  // glance. Localised so a French user's message lands in French.
  const contactHref = buildSimplepdfUrl({
    locale,
    path: '/contact',
    query: { message: t('download.upsellContactMessage') },
  })
  const pricingHref = buildSimplepdfUrl({ locale, path: '/pricing', query: { s: 'form-copilot' } })
  return (
    <Modal open={open} onClose={onClose} labelledBy="download-modal-title" size="sm">
      <ModalHeader
        titleId="download-modal-title"
        title={t('download.title')}
        onClose={onClose}
        closeAriaLabel={t('download.close')}
        className="flex items-start justify-between gap-4 px-6 pt-5 pb-4"
      />

      <div className="space-y-4 px-6 pb-5">
        <p className="text-[13.5px] leading-relaxed text-slate-600">{t('download.intro')}</p>

        <div className="flex justify-center">
          <Button
            type="button"
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            {t('download.cta')}
          </Button>
        </div>

        <hr className="border-slate-100" />

        <section className="space-y-3">
          <h3 className="text-[13px] font-semibold text-slate-900">{t('download.upsellHeading')}</h3>
          <p className="text-[12px] leading-relaxed text-slate-600">
            <Trans i18nKey="download.upsellStorage" components={{ b: <strong /> }} />
          </p>
          <p className="text-[12px] leading-relaxed text-slate-600">{t('download.upsellFields')}</p>
        </section>
      </div>

      <ModalFooter
        variant="split"
        left={
          <a
            href={contactHref}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-sky-600 hover:text-sky-700"
          >
            {t('download.upsellCta')}
          </a>
        }
        right={
          <a
            href={pricingHref}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-sky-600 hover:text-sky-700"
          >
            {t('download.upsellPricing')} →
          </a>
        }
      />
    </Modal>
  )
}
