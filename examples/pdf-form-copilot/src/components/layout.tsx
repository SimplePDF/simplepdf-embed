import { useState, type ReactNode } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { getFormsForLocale, type FormId } from '../lib/forms'
import { FormPicker } from './form_picker'
import { InfoModal } from './info_modal'

type LayoutProps = {
  locale: string
  currentFormId: FormId
  editor: ReactNode
  chat: ReactNode
}

export const Layout = ({ locale, currentFormId, editor, chat }: LayoutProps) => {
  return (
    <div className="flex h-screen flex-col bg-slate-50">
      <Header locale={locale} currentFormId={currentFormId} />
      <main className="flex min-h-0 flex-1 gap-4 p-4">
        <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {editor}
        </section>
        <aside className="flex w-[380px] min-w-[296px] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {chat}
        </aside>
      </main>
    </div>
  )
}

type HeaderProps = {
  locale: string
  currentFormId: FormId
}

const Header = ({ locale, currentFormId }: HeaderProps) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [isInfoOpen, setIsInfoOpen] = useState(false)
  const localeForms = getFormsForLocale(locale)

  const switchForm = (next: FormId): void => {
    void navigate({
      to: '/',
      search: (prev) => ({
        form: next,
        debug: prev.debug ?? false,
        lang: prev.lang ?? 'en',
      }),
    })
  }

  return (
    <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-3">
      <div className="flex items-center gap-3">
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
            className="h-6 w-6 rounded"
          />
          <span className="text-lg font-semibold">{t('header.brand')}</span>
        </a>
        <span className="text-sm text-slate-500">{t('header.tagline')}</span>
        <button
          type="button"
          onClick={() => setIsInfoOpen(true)}
          aria-label={t('header.whatIsThisDemo')}
          className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-[11px] font-semibold text-slate-500 transition hover:border-sky-400 hover:text-sky-600"
        >
          ?
        </button>
      </div>
      <div className="flex items-center gap-4 text-xs">
        <FormPicker value={currentFormId} options={localeForms} onChange={switchForm} />
        <a
          href="https://simplepdf.com"
          target="_blank"
          rel="noreferrer"
          className="text-slate-400 hover:text-slate-600"
        >
          {t('header.poweredBy')}
        </a>
      </div>
      <InfoModal open={isInfoOpen} onClose={() => setIsInfoOpen(false)} onSelectForm={switchForm} />
    </header>
  )
}
