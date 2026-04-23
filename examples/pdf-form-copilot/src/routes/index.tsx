import { useCallback, useRef } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { Layout } from '../components/layout'
import { EditorPane } from '../components/editor_pane'
import { ChatPane } from '../components/chat_pane'
import { DEFAULT_FORM_ID, getFormsForLocale, isFormId, type FormId } from '../lib/forms'
import { DEFAULT_LANGUAGE_CODE, isLanguageCode } from '../lib/languages'
import { useIframeBridge } from '../lib/iframe_bridge'
import { i18n } from '../lib/i18n'
import { isShareRequired, isShareValid } from '../server/shared_keys'

export type ShowParam = 'info' | 'model' | 'submit' | 'cerfa_dor'

const isShowParam = (value: unknown): value is ShowParam =>
  value === 'info' || value === 'model' || value === 'submit' || value === 'cerfa_dor'

type HomeSearch = {
  form: FormId
  lang: string
  show?: ShowParam
  share?: string
}

export type DemoGate = {
  shareRequired: boolean
  shareValid: boolean
}

const readDemoGate = createServerFn({ method: 'GET' })
  .inputValidator((raw: unknown): { shareId: string | null } => {
    if (typeof raw !== 'object' || raw === null) {
      return { shareId: null }
    }
    const rawShare = 'shareId' in raw ? raw.shareId : null
    if (typeof rawShare === 'string' && rawShare !== '') {
      return { shareId: rawShare }
    }
    return { shareId: null }
  })
  .handler(async ({ data }): Promise<DemoGate> => {
    return {
      shareRequired: isShareRequired(),
      shareValid: isShareValid(data.shareId),
    }
  })

export const Route = createFileRoute('/')({
  component: Home,
  validateSearch: (raw: Record<string, unknown>): HomeSearch => ({
    form: isFormId(raw.form) ? raw.form : DEFAULT_FORM_ID,
    lang: isLanguageCode(raw.lang) ? raw.lang : DEFAULT_LANGUAGE_CODE,
    ...(isShowParam(raw.show) ? { show: raw.show } : {}),
    ...(typeof raw.share === 'string' && raw.share !== '' ? { share: raw.share } : {}),
  }),
  beforeLoad: async ({ search }) => {
    if (i18n.language !== search.lang) {
      // Awaited so the route never renders with the previous language flashing
      // in before react-i18next has switched — the initial i18n config seeds
      // DEFAULT_UI_LOCALE, so on reload with ?lang=fr we must wait for the
      // resource swap + 'languageChanged' event before React hydrates.
      await i18n.changeLanguage(search.lang)
    }
  },
  loaderDeps: ({ search }) => ({ share: search.share ?? null }),
  loader: async ({ deps }): Promise<DemoGate> =>
    readDemoGate({ data: { shareId: deps.share } }),
})

const COMPANY_IDENTIFIER = import.meta.env.VITE_SIMPLEPDF_COMPANY_IDENTIFIER ?? 'pdf-form-copilot'
const EDITOR_ORIGIN = `https://${COMPANY_IDENTIFIER}.simplepdf.com`

// Locales the SimplePDF editor can render via i18n path-prefix routing.
// English is the default on the non-prefixed path, so it is not listed here.
const EDITOR_SUPPORTED_LOCALES = new Set(['de', 'es', 'fr', 'it', 'nl', 'pt'])

const buildEditorSrc = ({ pdfUrl, lang }: { pdfUrl: string; lang: string }): string => {
  const localePrefix = EDITOR_SUPPORTED_LOCALES.has(lang) ? `/${lang}` : ''
  const editorHost = `${EDITOR_ORIGIN}${localePrefix}/editor`
  if (pdfUrl === '') {
    // Custom / user-picked PDF: the editor falls back to its native file picker
    // when no ?open= is provided. We also drop loadingPlaceholder so the picker
    // is not hidden behind a loading screen.
    return `${editorHost}?ignoreExistingFields=true`
  }
  const params = new URLSearchParams({
    open: pdfUrl,
    loadingPlaceholder: 'true',
    ignoreExistingFields: 'true',
  })
  return `${editorHost}?${params.toString()}`
}

function Home() {
  const { form, lang } = Route.useSearch()
  const { shareRequired, shareValid } = Route.useLoaderData()
  const accessBlocked = shareRequired && !shareValid
  const localeForms = getFormsForLocale(lang)
  const currentForm = localeForms.forms[form] ?? localeForms.forms[DEFAULT_FORM_ID]
  const navigate = useNavigate()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const editorResetKey = `${currentForm.id}:${lang}`
  const { bridge, bridgeState } = useIframeBridge({
    iframeRef,
    editorOrigin: EDITOR_ORIGIN,
    resetKey: editorResetKey,
  })
  const isDocumentLoaded = bridgeState.kind === 'document_loaded'
  const documentId = bridgeState.kind === 'document_loaded' ? bridgeState.documentId : null

  const handleLanguageChange = useCallback(
    (nextLang: string): void => {
      void navigate({
        to: '/',
        search: (prev) => ({
          form: prev.form ?? DEFAULT_FORM_ID,
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
          iframeKey={editorResetKey}
          editorSrc={buildEditorSrc({ pdfUrl: currentForm.pdfUrl, lang })}
        />
      }
      chat={
        <ChatPane
          bridge={bridge}
          isReady={isDocumentLoaded}
          requiresUserUpload={form === 'custom'}
          language={lang}
          onLanguageChange={handleLanguageChange}
          documentId={documentId}
          accessBlocked={accessBlocked}
        />
      }
    />
  )
}
