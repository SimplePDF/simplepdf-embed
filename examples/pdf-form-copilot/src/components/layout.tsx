import { type ReactNode } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { getFormsForLocale, type FormId } from '../lib/forms'
import { FormPicker } from './form_picker'
import { InfoModal } from './info_modal'
import { SubmitDemoModal } from './submit_demo_modal'

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
          <h1 className="text-lg font-semibold text-slate-900">
            {t('mobileFallback.headline')}
          </h1>
          <div className="w-full">
            <h2 className="mb-2 text-sm font-medium text-slate-700">
              {t('mobileFallback.watchDemo')}
            </h2>
            <div
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
  const isSubmitOpen = search.show === 'submit'
  const localeForms = getFormsForLocale(locale)

  const openInfoModal = (): void => {
    void navigate({
      search: (prev) => ({ ...prev, show: 'info' }),
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

  return (
    <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 md:gap-4 md:px-6">
      <div className="flex min-w-0 items-center gap-2 md:gap-3">
        <a
          href="https://simplepdf.com?s=form-copilot"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 rounded text-slate-900 hover:opacity-80"
        >
          <img
            src="https://simplepdf.com/android-chrome-512x512.png"
            alt=""
            aria-hidden="true"
            className="h-6 w-6 flex-none rounded"
          />
          <span className="truncate text-base font-semibold md:text-lg">{t('header.brand')}</span>
        </a>
        <span className="hidden text-sm text-slate-500 md:inline">{t('header.tagline')}</span>
        <button
          type="button"
          onClick={openInfoModal}
          aria-label={t('header.whatIsThisDemo')}
          className="flex h-5 w-5 flex-none items-center justify-center rounded-full border border-slate-300 text-[11px] font-semibold text-slate-500 transition hover:border-sky-600 hover:text-sky-600"
        >
          ?
        </button>
      </div>
      <div className="flex items-center gap-3 text-xs md:gap-4">
        <div className="hidden lg:block">
          <FormPicker value={currentFormId} options={localeForms} onChange={switchForm} />
        </div>
        <a
          href="https://simplepdf.com?s=form-copilot"
          target="_blank"
          rel="noreferrer"
          className="hidden text-slate-400 hover:text-slate-600 md:inline"
        >
          {t('header.poweredBy')}
        </a>
      </div>
      <InfoModal open={isInfoOpen} onClose={closeModal} onSelectForm={switchForm} />
      <SubmitDemoModal open={isSubmitOpen} onClose={closeModal} />
    </header>
  )
}
