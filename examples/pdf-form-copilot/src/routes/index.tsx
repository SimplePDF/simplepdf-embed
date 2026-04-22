import { useRef } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Layout } from '../components/layout'
import { EditorPane } from '../components/editor_pane'
import { DebugPanel } from '../components/debug_panel'
import { ChatPane } from '../components/chat_pane'
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
          <ChatPane bridge={bridge} isEditorReady={isEditorReady} />
        )
      }
    />
  )
}
