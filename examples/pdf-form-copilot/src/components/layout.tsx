import { useState, type ReactNode } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { FORM_ORDER, FORMS, isFormId, type FormId } from '../lib/forms'
import { InfoModal } from './info_modal'

type LayoutProps = {
  currentFormId: FormId
  editor: ReactNode
  chat: ReactNode
}

export const Layout = ({ currentFormId, editor, chat }: LayoutProps) => {
  return (
    <div className="flex h-screen flex-col bg-slate-50">
      <Header currentFormId={currentFormId} />
      <main className="flex min-h-0 flex-1 gap-4 p-4">
        <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {editor}
        </section>
        <aside className="flex w-[380px] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {chat}
        </aside>
      </main>
    </div>
  )
}

type HeaderProps = {
  currentFormId: FormId
}

const Header = ({ currentFormId }: HeaderProps) => {
  const navigate = useNavigate()
  const [isInfoOpen, setIsInfoOpen] = useState(false)

  const handleFormChange = (event: React.ChangeEvent<HTMLSelectElement>): void => {
    const next = event.target.value
    if (!isFormId(next)) {
      return
    }
    void navigate({
      to: '/',
      search: (prev) => ({ form: next, debug: prev.debug ?? false }),
    })
  }

  return (
    <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-3">
      <div className="flex items-baseline gap-3">
        <span className="text-lg font-semibold text-slate-900">Form Copilot</span>
        <span className="text-sm text-slate-500">AI that helps users fill PDF forms step by step</span>
        <button
          type="button"
          onClick={() => setIsInfoOpen(true)}
          aria-label="What is this demo?"
          className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-[11px] font-semibold text-slate-500 transition hover:border-sky-400 hover:text-sky-600"
        >
          ?
        </button>
      </div>
      <div className="flex items-center gap-4 text-xs">
        <label className="flex items-center gap-2 text-slate-500">
          <span>Use case</span>
          <select
            value={currentFormId}
            onChange={handleFormChange}
            className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:border-sky-300 focus:border-sky-500 focus:outline-none"
          >
            {FORM_ORDER.map((id) => (
              <option key={id} value={id}>
                {FORMS[id].useCase} — {FORMS[id].label}
              </option>
            ))}
          </select>
        </label>
        <a
          href="https://simplepdf.com"
          target="_blank"
          rel="noreferrer"
          className="text-slate-400 hover:text-slate-600"
        >
          Powered by SimplePDF
        </a>
      </div>
      <InfoModal open={isInfoOpen} onClose={() => setIsInfoOpen(false)} />
    </header>
  )
}
