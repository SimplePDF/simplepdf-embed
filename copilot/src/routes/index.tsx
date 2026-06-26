import { EmbedPDF, type EmbedDocument, type EmbedEvent, useEmbed } from '@simplepdf/react-embed-pdf'
import { useEmbedTools } from '@simplepdf/react-embed-pdf/ai-sdk'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getRequestHeader, getRequestUrl } from '@tanstack/react-start/server'
import { useCallback, useState } from 'react'
import { z } from 'zod'
import { ChatPane } from '../components/chat/chat_pane'
import { WelcomeModal } from '../components/demo/welcome_modal'
import { Layout } from '../components/layout'
import {
  DEFAULT_FORM_ID,
  type FormId,
  getDefaultFormIdForLocale,
  getFormsForLocale,
  isFormId,
} from '../lib/demo/forms'
import { i18n, i18nReady, matchLocaleFromAcceptLanguage } from '../lib/i18n'
import { DEFAULT_LANGUAGE_CODE, isLanguageCode } from '../lib/languages'
import { bridgeLogger } from '../lib/monitoring'
import {
  type DemoGate,
  readDemoGate,
  readWelcomeDismissed,
  writeWelcomeDismissedCookie,
} from '../server/demo/loader_helpers'

export type { DemoGate }

// Trim incoming env strings, treat empty as missing. Outputs `string | undefined`.
const TrimmedOptionalString = z.preprocess((val) => {
  if (typeof val !== 'string') {
    return undefined
  }
  const trimmed = val.trim()
  return trimmed === '' ? undefined : trimmed
}, z.string().min(1).optional())

// The company identifier is the only required env var. A missing value MUST
// fail loudly at startup instead of silently pointing at production SimplePDF
// with the demo's shared identifier (which would either succeed and bill the
// demo workspace, or fail at iframe-load time with a confusing whitelist
// error). Base domain is optional with a default of https://simplepdf.com;
// override for staging, alternate prod tenants, or a local SimplePDF dev
// checkout.
const ClientEnvSchema = z.object({
  VITE_SIMPLEPDF_COMPANY_IDENTIFIER: z.preprocess(
    (val) => (typeof val === 'string' ? val.trim() : val),
    z.string().min(1, 'VITE_SIMPLEPDF_COMPANY_IDENTIFIER is required (see .env.example)'),
  ),
  VITE_SIMPLEPDF_BASE_DOMAIN: TrimmedOptionalString.pipe(z.url().optional()),
})

const DEFAULT_BASE_DOMAIN = 'https://simplepdf.com'

const clientEnv = ((): z.infer<typeof ClientEnvSchema> => {
  const result = ClientEnvSchema.safeParse({
    VITE_SIMPLEPDF_COMPANY_IDENTIFIER: import.meta.env.VITE_SIMPLEPDF_COMPANY_IDENTIFIER,
    VITE_SIMPLEPDF_BASE_DOMAIN: import.meta.env.VITE_SIMPLEPDF_BASE_DOMAIN,
  })
  if (!result.success) {
    throw new Error(`Client env invalid:\n${z.prettifyError(result.error)}`)
  }
  return result.data
})()

const COMPANY_IDENTIFIER = clientEnv.VITE_SIMPLEPDF_COMPANY_IDENTIFIER
const BASE_DOMAIN_URL = new URL(clientEnv.VITE_SIMPLEPDF_BASE_DOMAIN ?? DEFAULT_BASE_DOMAIN)

// Tuple-derived union so adding / removing a value updates the type, the
// runtime check, and the URL contract in lockstep. No `as` casts needed at
// the membership check (the predicate uses `.some` over the typed tuple).
const SHOW_PARAMS = ['info', 'model', 'download', 'cerfa_dor'] as const
export type ShowParam = (typeof SHOW_PARAMS)[number]

const isShowParam = (value: unknown): value is ShowParam =>
  typeof value === 'string' && SHOW_PARAMS.some((candidate) => candidate === value)

// Sub-selection inside the `?show=model` picker. Absent / invalid normalizes
// to 'chat' at read time (the modal defaults to the Chat tab).
const MODEL_TABS = ['chat', 'speech-to-text'] as const
export type ModelTab = (typeof MODEL_TABS)[number]

const isModelTab = (value: unknown): value is ModelTab =>
  typeof value === 'string' && MODEL_TABS.some((candidate) => candidate === value)

// A `?url=` becomes the `<EmbedPDF>` document. A SimplePDF documents URL on the
// editor's own base-domain family is navigated to DIRECTLY by the embed core, so
// its origin becomes the iframe origin AND the postMessage bridge target — it must
// therefore be a valid document URL on that family (e.g. any `*.simplepdf.com`
// tenant), such as
// https://demo.simplepdf.com/documents/c28f061b-1974-4251-ba7a-d08bedc3ef28?prefill=35fdf39e-2e06-4712-bb9d-f62d2f88ce50
// Rejecting everything else keeps a crafted `?url=javascript:...`, a relative
// path resolving against our own origin, or a third-party origin (which would
// be framed with our clipboard permissions and wired to the bridge) out of the
// iframe. The leading dot on the suffix check blocks look-alikes like
// `evilsimplepdf.com`.
const isEmbeddableUrl = (value: unknown): value is string => {
  if (typeof value !== 'string' || value === '') {
    return false
  }
  try {
    const { protocol, host } = new URL(value)
    if (protocol !== 'http:' && protocol !== 'https:') {
      return false
    }
    return host === BASE_DOMAIN_URL.host || host.endsWith(`.${BASE_DOMAIN_URL.host}`)
  } catch {
    return false
  }
}

type HomeSearch = {
  form: FormId
  lang: string
  show?: ShowParam
  tab?: ModelTab
  url?: string
}

// Server-side: detect the visitor's preferred locale when the URL doesn't
// carry an explicit `?lang=`. Returns null when the URL DID have a
// ?lang= (in which case the user's choice wins) or when the
// Accept-Language header has no overlap with the supported set.
const readPreferredLocaleWhenLangAbsent = createServerFn({ method: 'GET' }).handler(
  async (): Promise<string | null> => {
    const url = (() => {
      try {
        return getRequestUrl()
      } catch {
        return null
      }
    })()
    if (url?.searchParams.has('lang')) {
      return null
    }
    return matchLocaleFromAcceptLanguage(getRequestHeader('accept-language'))
  },
)

type HomeLoaderData = {
  demoGate: DemoGate
  welcomeDismissed: boolean
}

export const Route = createFileRoute('/')({
  component: Home,
  validateSearch: (raw: Record<string, unknown>): HomeSearch => {
    const lang = isLanguageCode(raw.lang) ? raw.lang : DEFAULT_LANGUAGE_CODE
    return {
      form: isFormId(raw.form) ? raw.form : getDefaultFormIdForLocale(lang),
      lang,
      ...(isShowParam(raw.show) ? { show: raw.show } : {}),
      ...(isModelTab(raw.tab) ? { tab: raw.tab } : {}),
      ...(isEmbeddableUrl(raw.url) ? { url: raw.url } : {}),
    }
  },
  beforeLoad: async ({ search }) => {
    // Wait for i18next's init() Promise to resolve before the route renders.
    // Without this, the very first render (SSR pass + first client paint)
    // runs while init is still mid-microtask and t() returns raw key
    // strings — visible as a flash of "welcomeModal.getStarted" etc. in the
    // SSR'd welcome modal HTML.
    await i18nReady

    // Locale resolution: explicit ?lang= always wins. When absent, fall
    // back to the visitor's preferred locale (Accept-Language on the
    // server, navigator.languages on the client via readInitialLocale)
    // before defaulting to DEFAULT_UI_LOCALE. validateSearch normalises
    // search.lang to DEFAULT when ?lang= is missing, so we re-detect from
    // the request to know whether it was explicit.
    const preferredLocale = await ((): Promise<string | null> => {
      if (typeof window === 'undefined') {
        return readPreferredLocaleWhenLangAbsent()
      }
      // Client side: an explicit URL value takes precedence; otherwise
      // the i18n module's readInitialLocale already picked a
      // navigator-language match if available, so we trust i18n.language
      // as the detected value.
      const urlHasLang = new URLSearchParams(window.location.search).has('lang')
      return Promise.resolve(urlHasLang ? null : i18n.language)
    })()

    const targetLocale = preferredLocale ?? search.lang
    if (i18n.language !== targetLocale) {
      // Awaited so the route never renders with the previous language flashing
      // in before react-i18next has switched.
      await i18n.changeLanguage(targetLocale)
    }
  },
  loader: async (): Promise<HomeLoaderData> => {
    // Demo mode is read straight from server config (no `?share=` input).
    const [demoGate, welcomeDismissed] = await Promise.all([readDemoGate(), readWelcomeDismissed()])
    return { demoGate, welcomeDismissed }
  },
})

// Locales the SimplePDF editor renders via i18n path-prefix routing (English is
// the default, no prefix; an unsupported lang falls back to it). EmbedPDF builds
// the editor URL from this locale.
const EDITOR_LOCALES = ['de', 'es', 'fr', 'it', 'nl', 'pt'] as const
const isEditorLocale = (value: string): value is (typeof EDITOR_LOCALES)[number] =>
  EDITOR_LOCALES.some((locale) => locale === value)

function Home() {
  const { form, lang, url } = Route.useSearch()
  const { demoGate, welcomeDismissed } = Route.useLoaderData()
  const localeForms = getFormsForLocale(lang)
  const currentForm = localeForms.forms[form] ?? localeForms.forms[DEFAULT_FORM_ID]
  const navigate = useNavigate()
  // The editor is driven through <EmbedPDF> + useEmbed: <EmbedPDF> renders the
  // iframe; useEmbed gives the ref to attach plus the imperative `actions` and the
  // agentic `tools`. A `?url=` (validated to the editor's own base-domain family in
  // validateSearch) becomes the document source — a `/documents/<id>` URL is
  // navigated to directly by the embed core, otherwise the picked demo form's PDF
  // is host-fetched. No document → the editor's native file picker.
  const { embedRef, actions } = useEmbed()
  const tools = useEmbedTools(embedRef)
  const editorDocument = ((): EmbedDocument | undefined => {
    if (url !== undefined) {
      return { url }
    }
    if (currentForm.pdfUrl !== '') {
      return { url: currentForm.pdfUrl }
    }
    return undefined
  })()
  const editorLocale = isEditorLocale(lang) ? lang : undefined
  const editorResetKey = url ?? `${currentForm.id}:${lang}`
  // Readiness is observed via onEmbedEvent (the DOCUMENT_LOADED editor event), keyed
  // on the editor instance so a remount (form / locale / url change) resets it until
  // the new document loads — no separate effect, no stale "ready".
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const handleEmbedEvent = useCallback(
    (event: EmbedEvent): void => {
      if (event.type === 'DOCUMENT_LOADED') {
        setLoadedKey(editorResetKey)
      }
    },
    [editorResetKey],
  )
  const isDocumentLoaded = loadedKey === editorResetKey
  // A `?url=` always supplies the document, so the user is never asked to
  // upload one — only the `custom` demo form (which opens the native file
  // picker) requires an upload.
  const requiresUserUpload = url === undefined && form === 'custom'

  // WORKAROUND: the SimplePDF editor does not currently emit an outbound
  // FIELD_ADDED event when the user drops a field via the toolbar, so the
  // chat_pane's "new field added by the user" hint has to detect it via a
  // polling GET_FIELDS loop. To keep that loop narrow, we gate it on whether the
  // user's cursor is over the editor — pointerenter / pointerleave on the wrapper
  // around <EmbedPDF> fire on entry / exit of the editor's bounding box. Remove
  // this workaround if the editor starts emitting a FIELD_ADDED event.
  const [isCursorOverEditor, setIsCursorOverEditor] = useState(false)
  const handleEditorPointerEnter = useCallback((): void => setIsCursorOverEditor(true), [])
  const handleEditorPointerLeave = useCallback((): void => setIsCursorOverEditor(false), [])

  const handleLanguageChange = useCallback(
    (nextLang: string): void => {
      void navigate({
        to: '/',
        search: (prev) => ({
          form: prev.form ?? DEFAULT_FORM_ID,
          lang: nextLang,
          ...(prev.url !== undefined ? { url: prev.url } : {}),
        }),
      })
    },
    [navigate],
  )

  // First-load splash: open state seeded from the SSR loader (cookie read
  // server-side), so the modal markup is included or omitted directly in the
  // initial HTML. No localStorage round-trip, no hydration mismatch, no
  // flash of the modal on subsequent visits. Mobile viewports are gated via
  // CSS inside WelcomeModal (the modal renders in the DOM but is hidden
  // below lg via `hidden lg:flex`), so we don't need a JS viewport check.
  const [welcomeOpen, setWelcomeOpen] = useState<boolean>(!welcomeDismissed)

  const dismissWelcome = useCallback((): void => {
    writeWelcomeDismissedCookie()
    setWelcomeOpen(false)
  }, [])

  const handleOpenInfoFromWelcome = useCallback((): void => {
    dismissWelcome()
    void navigate({
      to: '/',
      search: (prev) => ({
        form: prev.form ?? DEFAULT_FORM_ID,
        lang: prev.lang ?? DEFAULT_LANGUAGE_CODE,
        show: 'info' as const,
        ...(prev.url !== undefined ? { url: prev.url } : {}),
      }),
    })
  }, [dismissWelcome, navigate])

  return (
    <>
      <Layout
        locale={lang}
        currentFormId={form}
        editor={
          <div
            className="h-full w-full"
            onPointerEnter={handleEditorPointerEnter}
            onPointerLeave={handleEditorPointerLeave}
          >
            <EmbedPDF
              ref={embedRef}
              key={editorResetKey}
              mode="inline"
              companyIdentifier={COMPANY_IDENTIFIER}
              baseDomain={BASE_DOMAIN_URL.host}
              locale={editorLocale}
              document={editorDocument}
              onEmbedEvent={handleEmbedEvent}
              logger={bridgeLogger}
              className="h-full w-full"
            />
          </div>
        }
        chat={
          <ChatPane
            tools={tools}
            actions={actions}
            resetKey={editorResetKey}
            isReady={isDocumentLoaded}
            requiresUserUpload={requiresUserUpload}
            language={lang}
            onLanguageChange={handleLanguageChange}
            form={form}
            demoGate={demoGate}
            isCursorOverEditor={isCursorOverEditor}
          />
        }
      />
      <WelcomeModal open={welcomeOpen} onClose={dismissWelcome} onOpenInfo={handleOpenInfoFromWelcome} />
    </>
  )
}
