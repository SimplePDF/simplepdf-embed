import { useRef } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Layout } from '../components/layout'
import { EditorPane } from '../components/editor_pane'
import { DebugPanel } from '../components/debug_panel'
import { DEFAULT_FORM_ID, FORMS, type FormId, isFormId } from '../lib/forms'
import { useIframeBridge } from '../lib/iframe_bridge'

type HomeSearch = {
  form: FormId
  debug: boolean
}

export const Route = createFileRoute('/')({
  component: Home,
  validateSearch: (raw: Record<string, unknown>): HomeSearch => ({
    form: isFormId(raw.form) ? raw.form : DEFAULT_FORM_ID,
    debug: raw.debug === '1' || raw.debug === 1 || raw.debug === 'true' || raw.debug === true,
  }),
})

const EDITOR_HOST = 'https://headless.simplepdf.com/editor'
const EDITOR_ORIGIN = 'https://headless.simplepdf.com'

const buildEditorSrc = ({ pdfUrl }: { pdfUrl: string }): string => {
  const params = new URLSearchParams({
    open: pdfUrl,
    loadingPlaceholder: 'true',
  })
  return `${EDITOR_HOST}?${params.toString()}`
}

function Home() {
  const { form, debug } = Route.useSearch()
  const currentForm = FORMS[form]
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const { bridge, isEditorReady } = useIframeBridge({ iframeRef, editorOrigin: EDITOR_ORIGIN })

  return (
    <Layout
      currentFormId={form}
      editor={
        <EditorPane
          ref={iframeRef}
          iframeKey={currentForm.id}
          editorSrc={buildEditorSrc({ pdfUrl: currentForm.pdfUrl })}
        />
      }
      chat={
        debug ? (
          <DebugPanel bridge={bridge} isEditorReady={isEditorReady} />
        ) : (
          <ChatPlaceholder isEditorReady={isEditorReady} />
        )
      }
    />
  )
}

type ChatPlaceholderProps = {
  isEditorReady: boolean
}

const ChatPlaceholder = ({ isEditorReady }: ChatPlaceholderProps) => {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">Chat</h2>
        <p className="text-xs text-slate-500">
          {isEditorReady ? 'Editor ready — Phase 3 wires the AI assistant.' : 'Waiting for the editor to load…'}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 text-sm text-slate-400">
        The assistant will appear here.{' '}
        <span className="text-slate-500">Tip: append <code className="rounded bg-slate-100 px-1">?debug=1</code> to exercise the iframe bridge.</span>
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
