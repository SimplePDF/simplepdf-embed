import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useCallback, useRef } from 'react'
import { ChatPane } from '../components/chat_pane'
import { EditorPane } from '../components/editor_pane'
import { Layout } from '../components/layout'
import type { DemoModel } from '../lib/demo_model'
import { useIframeBridge } from '../lib/embed-bridge-adapters/react'
import { DEFAULT_FORM_ID, type FormId, getFormsForLocale, isFormId } from '../lib/forms'
import { i18n } from '../lib/i18n'
import { DEFAULT_LANGUAGE_CODE, isLanguageCode } from '../lib/languages'
import { bridgeLogger, monitoring } from '../lib/monitoring'
import { resolveShareModel } from '../server/shared_keys'

export type ShowParam = 'info' | 'model' | 'submit' | 'cerfa_dor'

const isShowParam = (value: unknown): value is ShowParam =>
  value === 'info' || value === 'model' || value === 'submit' || value === 'cerfa_dor'

type HomeSearch = {
  form: FormId
  lang: string
  show?: ShowParam
  share?: string
}

// Two-state gate: either the invite is valid and the chat runs against the
// per-share demo model, or the visitor has to bring their own key via the
// Model Picker. The UI reads this to label the active model and to decide
// whether to show the Welcome banner.
export type DemoGate = { kind: 'byok' } | { kind: 'demo'; model: DemoModel }

// The share id lives directly in `?share=<id>` on the page URL — no cookie
// round-trip, no URL stripping — so an invite link can be copy-pasted and
// reused verbatim. The loader forwards the id to this server fn, which
// treats a blank / missing id as "no invite".
//
// No same-origin gate here: a direct address-bar navigation doesn't send
// Origin or Referer, so a strict check would collapse every paste of an
// invite link into the 'byok' branch. Cross-origin JS fetches to this
// server-fn endpoint can't read the response under the browser's default
// CORS policy (we don't serve Access-Control-Allow-Origin), so an attacker
// already can't enumerate shares from another site.
const readDemoGate = createServerFn({ method: 'GET' })
  .inputValidator((raw: unknown): { shareId: string | null } => {
    if (typeof raw !== 'object' || raw === null || !('shareId' in raw)) {
      return { shareId: null }
    }
    const value = (raw as { shareId: unknown }).shareId
    if (typeof value !== 'string' || value === '') {
      return { shareId: null }
    }
    return { shareId: value }
  })
  .handler(async ({ data }): Promise<DemoGate> => {
    const model = resolveShareModel(data.shareId)
    if (model === null) {
      return { kind: 'byok' }
    }
    return { kind: 'demo', model }
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
  // loaderDeps reads from the already-validated search, so `search.share`
  // is typed as the `HomeSearch['share']` (`string | undefined`) and the
  // loader gets a pre-normalised `shareId: string | null`.
  loaderDeps: ({ search }) => ({
    shareId: search.share !== undefined && search.share !== '' ? search.share : null,
  }),
  loader: async ({ deps }): Promise<DemoGate> => readDemoGate({ data: { shareId: deps.shareId } }),
})

const COMPANY_IDENTIFIER = import.meta.env.VITE_SIMPLEPDF_COMPANY_IDENTIFIER ?? 'copilot'

// VITE_SIMPLEPDF_BASE_DOMAIN accepts a full base URL (protocol + host + optional
// port). The company identifier is spliced in as a subdomain when building the
// iframe origin. Useful for pointing the example at a local dev checkout of
// the SimplePDF editor (e.g. `http://simplepdf.nil:3105`) without touching the
// source. Unset defaults to the production marketing origin.
const BASE_DOMAIN_URL = ((): URL => {
  const raw = import.meta.env.VITE_SIMPLEPDF_BASE_DOMAIN ?? 'https://simplepdf.com'
  try {
    return new URL(raw)
  } catch {
    monitoring.warn('base_domain.invalid', { raw })
    return new URL('https://simplepdf.com')
  }
})()
const EDITOR_ORIGIN = `${BASE_DOMAIN_URL.protocol}//${COMPANY_IDENTIFIER}.${BASE_DOMAIN_URL.host}`

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
  const demoGate = Route.useLoaderData()
  const localeForms = getFormsForLocale(lang)
  const currentForm = localeForms.forms[form] ?? localeForms.forms[DEFAULT_FORM_ID]
  const navigate = useNavigate()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const editorResetKey = `${currentForm.id}:${lang}`
  const { bridge, bridgeState } = useIframeBridge({
    iframeRef,
    editorOrigin: EDITOR_ORIGIN,
    resetKey: editorResetKey,
    logger: bridgeLogger,
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
          ...(prev.share !== undefined ? { share: prev.share } : {}),
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
          demoGate={demoGate}
        />
      }
    />
  )
}
