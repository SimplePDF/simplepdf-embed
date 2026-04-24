import type { ReactElement } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Button } from './ui/button'
import { ExternalLink } from './ui/link'
import { Modal, ModalHeader } from './ui/modal'

type CerfaDorModalProps = {
  open: boolean
  onClose: () => void
}

const LOGO_URL = 'https://cdn.simplepdf.com/simple-pdf/assets/form-copilot/cerfa-dor.jpeg'

const CERFA_DOR_ARTICLE =
  'https://www.planet.fr/politique-les-cerfa-dor-organises-par-david-lisnard-le-palmares-des-normes-les-plus-ridicules.2996147.29334.html'
const LISNARD_PLAN_ARTICLE =
  'https://www.unenouvelleenergie.fr/david-lisnard-devoile-son-plan-pour-en-finir-avec-la-bureaucratie/'

const buildShareUrl = (): string => {
  // Cerfa d'Or is French-only; surface the FR-locale marketing URL in the
  // tweet so the click-through lands on localized content.
  const text =
    '@davidlisnard, @simple_pdf Form Copilot utilise l’IA pour remplir les CERFA directement dans le navigateur. Un outil dans l’esprit de votre combat contre la paperasse. https://simplepdf.com/fr?s=cerfa-dor'
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`
}

export const CerfaDorModal = ({ open, onClose }: CerfaDorModalProps): ReactElement | null => {
  const { t } = useTranslation()
  return (
    <Modal open={open} onClose={onClose} labelledBy="cerfa-dor-title" size="md">
      <ModalHeader
        titleId="cerfa-dor-title"
        title={t('cerfaDor.title')}
        onClose={onClose}
        closeAriaLabel={t('cerfaDor.close')}
        leftAccessory={
          <img
            src={LOGO_URL}
            alt=""
            aria-hidden="true"
            className="h-12 w-12 flex-none rounded-lg object-cover shadow-sm ring-1 ring-amber-200"
          />
        }
      />
      <div className="space-y-4 px-6 py-5 text-[14px] leading-relaxed text-slate-700">
        <p>
          <Trans
            i18nKey="cerfaDor.bodyLead"
            components={{ b: <strong className="font-semibold text-slate-900" /> }}
          />
        </p>
        <p>
          <Trans
            i18nKey="cerfaDor.bodyFounder"
            components={{ b: <strong className="font-semibold text-slate-900" /> }}
          />
        </p>
        <p>
          <Trans
            i18nKey="cerfaDor.bodyAsk"
            components={{ b: <strong className="font-semibold text-slate-900" /> }}
          />
        </p>
        <ul className="space-y-1.5 text-[13px] text-slate-600">
          <li>
            <ExternalLink href={CERFA_DOR_ARTICLE}>{t('cerfaDor.linkCerfaDor')}</ExternalLink>
          </li>
          <li>
            <ExternalLink href={LISNARD_PLAN_ARTICLE}>{t('cerfaDor.linkLisnardPlan')}</ExternalLink>
          </li>
        </ul>
      </div>
      <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
        <Button variant="ghost" size="md" onClick={onClose}>
          {t('cerfaDor.dismiss')}
        </Button>
        <a
          href={buildShareUrl()}
          target="_blank"
          rel="noreferrer"
          className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-700"
        >
          {t('cerfaDor.share')}
        </a>
      </div>
    </Modal>
  )
}
