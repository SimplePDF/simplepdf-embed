import { createFileRoute } from '@tanstack/react-router'
import { Layout } from '../components/layout'
import { DEFAULT_FORM_ID, FORMS, type FormId, isFormId } from '../lib/forms'

type HomeSearch = {
  form: FormId
}

export const Route = createFileRoute('/')({
  component: Home,
  validateSearch: (raw: Record<string, unknown>): HomeSearch => ({
    form: isFormId(raw.form) ? raw.form : DEFAULT_FORM_ID,
  }),
})

const EDITOR_HOST = 'https://headless.simplepdf.com/editor'

const buildEditorSrc = ({ pdfUrl }: { pdfUrl: string }): string => {
  const params = new URLSearchParams({
    open: pdfUrl,
    loadingPlaceholder: 'true',
  })
  return `${EDITOR_HOST}?${params.toString()}`
}

function Home() {
  const { form } = Route.useSearch()
  const currentForm = FORMS[form]

  return (
    <Layout
      currentFormId={form}
      editor={
        <iframe
          key={currentForm.id}
          title="SimplePDF editor"
          src={buildEditorSrc({ pdfUrl: currentForm.pdfUrl })}
          className="h-full w-full border-0"
          allow="clipboard-read; clipboard-write"
        />
      }
      chat={<ChatPlaceholder />}
    />
  )
}

const ChatPlaceholder = () => {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">Chat</h2>
        <p className="text-xs text-slate-500">Phase 2 wires the AI assistant.</p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 text-sm text-slate-400">
        The assistant will appear here.
      </div>
      <div className="border-t border-slate-200 p-3">
        <input
          disabled
          placeholder="Ask the copilot..."
          className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400 placeholder-slate-400"
        />
      </div>
    </div>
  )
}
