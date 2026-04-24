import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { useCallback, useRef } from 'react'
import { ChatPane } from '../components/chat_pane'
import { EditorPane } from '../components/editor_pane'
import { Layout } from '../components/layout'
import { useIframeBridge } from '../lib/embed-bridge-adapters/react'
import { DEFAULT_FORM_ID, type FormId, getFormsForLocale, isFormId } from '../lib/forms'
import { i18n } from '../lib/i18n'
import { DEFAULT_LANGUAGE_CODE, isLanguageCode } from '../lib/languages'
import { monitoring } from '../lib/monitoring'
import { isSameOrigin } from '../server/rate_limit'
import { readShareCookie, writeShareCookie } from '../server/share_cookie'
import { isShareValid } from '../server/shared_keys'

export type ShowParam = 'info' | 'model' | 'submit' | 'cerfa_dor'

const isShowParam = (value: unknown): value is ShowParam =>
  value === 'info' || value === 'model' || value === 'submit' || value === 'cerfa_dor'

type HomeSearch = {
  form: FormId
  lang: string
  show?: ShowParam
  share?: string
}

// Opaque gate: the client only needs to know whether access is blocked, not
// whether the share id happens to be valid. Collapsing to a single boolean
// keeps the server function easy to reason about; enumeration by a scripted
// attacker still reveals valid share ids but only ever costs the attacker
// the associated per-share lifetime budget. The same-origin check on the
// endpoint blocks casual cross-origin probing from the browser.
export type DemoGate = {
  accessBlocked: boolean
}

const readDemoGate = createServerFn({ method: 'GET' }).handler(async (): Promise<DemoGate> => {
  const request = getRequest()
  if (!isSameOrigin(request)) {
    // Treat cross-origin probes as blocked; the client cannot infer validity.
    return { accessBlocked: true }
  }
  const shareId = readShareCookie()
  return {
    accessBlocked: !isShareValid(shareId),
  }
})

// Server-only: on the initial GET for /?share=<id>, validate the id, set the
// httpOnly cookie, and swallow the param from the URL the user can copy. If
// the id is invalid we still strip the param (no sense leaving a failed
// secret in the address bar), but we do not set a cookie — the visitor sees
// the Welcome banner and is directed to BYOK.
const consumeShareQueryParam = createServerFn({ method: 'POST' })
  .inputValidator((raw: unknown): { shareId: string } => {
    if (typeof raw === 'object' && raw !== null && 'shareId' in raw) {
      const value = (raw as { shareId: unknown }).shareId
      if (typeof value === 'string' && value !== '') {
        return { shareId: value }
      }
    }
    throw new Error('shareId is required')
  })
  .handler(async ({ data }): Promise<void> => {
    if (isShareValid(data.shareId)) {
      writeShareCookie(data.shareId)
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
    // Strip `?share=` from the URL the moment the page loads. The share id is
    // moved into an httpOnly cookie server-side and the browser history is
    // rewritten to the bare path so the visitor can copy / share the URL
    // without leaking the invite secret.
    if (search.share !== undefined && search.share !== '') {
      await consumeShareQueryParam({ data: { shareId: search.share } })
      const strippedSearch: HomeSearch = {
        form: search.form,
        lang: search.lang,
        ...(search.show !== undefined ? { show: search.show } : {}),
      }
      throw redirect({ to: '/', search: strippedSearch, replace: true })
    }
    if (i18n.language !== search.lang) {
      // Awaited so the route never renders with the previous language flashing
      // in before react-i18next has switched — the initial i18n config seeds
      // DEFAULT_UI_LOCALE, so on reload with ?lang=fr we must wait for the
      // resource swap + 'languageChanged' event before React hydrates.
      await i18n.changeLanguage(search.lang)
    }
  },
  loader: async (): Promise<DemoGate> => readDemoGate(),
})

const COMPANY_IDENTIFIER = import.meta.env.VITE_SIMPLEPDF_COMPANY_IDENTIFIER ?? 'pdf-form-copilot'

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
  const { accessBlocked } = Route.useLoaderData()
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
