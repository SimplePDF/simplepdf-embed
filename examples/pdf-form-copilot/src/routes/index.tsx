import { useCallback, useRef } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Layout } from '../components/layout'
import { EditorPane } from '../components/editor_pane'
import { DebugPanel } from '../components/debug_panel'
import { ChatPane } from '../components/chat_pane'
import { DEFAULT_FORM_ID, getFormsForLocale, isFormId, type FormId } from '../lib/forms'
import { DEFAULT_LANGUAGE_CODE, isLanguageCode } from '../lib/languages'
import { useIframeBridge } from '../lib/iframe_bridge'
import { i18n } from '../lib/i18n'

type HomeSearch = {
  form: FormId
  debug: boolean
  lang: string
}

export const Route = createFileRoute('/')({
  component: Home,
  validateSearch: (raw: Record<string, unknown>): HomeSearch => ({
    form: isFormId(raw.form) ? raw.form : DEFAULT_FORM_ID,
    debug: raw.debug === '1' || raw.debug === 1 || raw.debug === 'true' || raw.debug === true,
    lang: isLanguageCode(raw.lang) ? raw.lang : DEFAULT_LANGUAGE_CODE,
  }),
  beforeLoad: ({ search }) => {
    if (i18n.language !== search.lang) {
      void i18n.changeLanguage(search.lang)
    }
  },
})

const EDITOR_HOST = 'https://pdf-form-copilot.simplepdf.com/editor'
const EDITOR_ORIGIN = 'https://pdf-form-copilot.simplepdf.com'

const buildEditorSrc = ({ pdfUrl }: { pdfUrl: string }): string => {
  const params = new URLSearchParams({
    open: pdfUrl,
    loadingPlaceholder: 'true',
    ignoreExistingFields: 'true',
  })
  return `${EDITOR_HOST}?${params.toString()}`
}

function Home() {
  const { form, debug, lang } = Route.useSearch()
  const localeForms = getFormsForLocale(lang)
  const currentForm = localeForms.forms[form] ?? localeForms.forms[DEFAULT_FORM_ID]
  const navigate = useNavigate()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const { bridge, isEditorReady } = useIframeBridge({ iframeRef, editorOrigin: EDITOR_ORIGIN })

  const handleLanguageChange = useCallback(
    (nextLang: string): void => {
      void navigate({
        to: '/',
        search: (prev) => ({
          form: prev.form ?? DEFAULT_FORM_ID,
          debug: prev.debug ?? false,
          lang: nextLang,
        }),
      })
    },
    [navigate],
  )

  return (
    <Layout
      locale={lang}
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
          <ChatPane
            bridge={bridge}
            isEditorReady={isEditorReady}
            language={lang}
            onLanguageChange={handleLanguageChange}
            showToolDetails={debug}
          />
        )
      }
    />
  )
}
