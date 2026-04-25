import { getRouteApi } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { type FormId, getFormsForLocale } from '../lib/forms'
import { buildSimplepdfUrl } from '../lib/simplepdf_url'
import { CerfaDorModal } from './cerfa_dor_modal'
import { FormPicker } from './form_picker'
import { InfoModal } from './info_modal'

const CERFA_DOR_LOGO_URL = 'https://cdn.simplepdf.com/simple-pdf/assets/form-copilot/cerfa-dor.jpeg'

const homeRoute = getRouteApi('/')

type LayoutProps = {
  locale: string
  currentFormId: FormId
  editor: ReactNode
  chat: ReactNode
}

export const Layout = ({ locale, currentFormId, editor, chat }: LayoutProps) => {
  const { t } = useTranslation()
  return (
    <div className="flex h-screen flex-col bg-slate-50">
      <Header locale={locale} currentFormId={currentFormId} />
      <main className="hidden min-h-0 flex-1 gap-4 p-4 lg:flex">
        <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {editor}
        </section>
        <aside className="flex w-[380px] min-w-[296px] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {chat}
        </aside>
      </main>
      <div className="flex flex-1 items-center justify-center p-6 lg:hidden">
        <div className="flex w-full max-w-md flex-col items-center gap-6 text-center">
          <h1 className="text-lg font-semibold text-slate-900">{t('mobileFallback.headline')}</h1>
          <div className="w-full">
            <h2 className="mb-2 text-sm font-medium text-slate-700">{t('mobileFallback.watchDemo')}</h2>
            <div
              role="img"
              aria-label={t('mobileFallback.videoPlaceholder')}
              className="flex aspect-video w-full items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-xs font-medium uppercase tracking-[0.2em] text-slate-400"
            >
              {t('mobileFallback.videoPlaceholder')}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

type HeaderProps = {
  locale: string
  currentFormId: FormId
}

const Header = ({ locale, currentFormId }: HeaderProps) => {
  const { t } = useTranslation()
  const navigate = homeRoute.useNavigate()
  const search = homeRoute.useSearch()
  const isInfoOpen = search.show === 'info'
  const isFrench = locale === 'fr'
  // The Cerfa d'Or easter egg is French-only. Honour ?show=cerfa_dor only
  // when the user is on the FR locale so the URL param is a no-op elsewhere.
  const isCerfaDorOpen = isFrench && search.show === 'cerfa_dor'
  const localeForms = getFormsForLocale(locale)

  const openInfoModal = (): void => {
    void navigate({
      search: (prev) => ({ ...prev, show: 'info' }),
    })
  }

  const openCerfaDorModal = (): void => {
    void navigate({
      search: (prev) => ({ ...prev, show: 'cerfa_dor' }),
    })
  }

  const closeModal = (): void => {
    void navigate({
      search: ({ show: _omit, ...rest }) => rest,
    })
  }

  const switchForm = (next: FormId): void => {
    void navigate({
      search: (prev) => ({ ...prev, form: next }),
    })
  }

  // Use-case modal cards always showcase US English forms, so clicking one
  // both sets the form AND flips the UI locale to EN. Keeping the locale
  // unchanged would land the user on a W-9 (or I-9) with, say, a Dutch UI,
  // which is inconsistent with the card copy and the form content.
  const switchToUseCaseForm = (next: FormId): void => {
    void navigate({
      search: (prev) => ({ ...prev, form: next, lang: 'en' }),
    })
  }

  const brandHref = buildSimplepdfUrl({ locale, query: { s: 'form-copilot' } })
  return (
    <header className="flex items-center justify-between gap-3 bg-sky-700 px-4 py-3 md:gap-4 md:px-6">
      <div className="flex min-w-0 items-center gap-2 md:gap-3">
        <a
          href={brandHref}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 rounded text-white hover:opacity-80"
        >
          <img
            src="https://simplepdf.com/android-chrome-512x512.png"
            alt=""
            aria-hidden="true"
            className="h-6 w-6 flex-none rounded"
          />
          <span className="truncate text-base font-semibold md:text-lg">{t('header.brand')}</span>
        </a>
        <span className="mt-0.5 hidden text-sm font-medium text-white md:inline">{t('header.tagline')}</span>
        <button
          type="button"
          onClick={openInfoModal}
          aria-label={t('header.whatIsThisDemo')}
          className="flex h-5 w-5 flex-none items-center justify-center rounded-full border border-white/40 text-[11px] font-semibold text-white/80 transition hover:border-white hover:text-white"
        >
          ?
        </button>
      </div>
      <div className="flex items-center gap-3 text-xs md:gap-4">
        <div className="hidden items-center gap-2 lg:flex">
          <FormPicker value={currentFormId} options={localeForms} onChange={switchForm} />
          {isFrench ? (
            <button
              type="button"
              onClick={openCerfaDorModal}
              aria-label={t('cerfaDor.buttonAria')}
              title={t('cerfaDor.buttonTitle')}
              className="flex h-9 w-9 flex-none items-center justify-center rounded-lg border border-amber-200 bg-amber-50/60 p-0.5 transition-all hover:border-amber-400 hover:shadow-sm"
            >
              <img
                src={CERFA_DOR_LOGO_URL}
                alt=""
                aria-hidden="true"
                className="h-full w-full rounded-md object-cover"
              />
            </button>
          ) : null}
        </div>
        <a
          href={brandHref}
          target="_blank"
          rel="noreferrer"
          className="hidden text-white/70 hover:text-white md:inline"
        >
          {t('header.poweredBy')}
        </a>
      </div>
      <InfoModal
        open={isInfoOpen}
        onClose={closeModal}
        onSelectUseCaseForm={switchToUseCaseForm}
        locale={locale}
      />
      {isFrench ? <CerfaDorModal open={isCerfaDorOpen} onClose={closeModal} /> : null}
    </header>
  )
}
