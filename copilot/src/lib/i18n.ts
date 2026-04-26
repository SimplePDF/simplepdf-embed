import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import ar from '../locales/ar.json'
import cs from '../locales/cs.json'
import da from '../locales/da.json'
import de from '../locales/de.json'
import el from '../locales/el.json'
import en from '../locales/en.json'
import es from '../locales/es.json'
import et from '../locales/et.json'
import fi from '../locales/fi.json'
import fr from '../locales/fr.json'
import he from '../locales/he.json'
import hi from '../locales/hi.json'
import it from '../locales/it.json'
import nl from '../locales/nl.json'
import no from '../locales/no.json'
import pl from '../locales/pl.json'
import pt from '../locales/pt.json'
import ro from '../locales/ro.json'
import sv from '../locales/sv.json'
import tr from '../locales/tr.json'
import uk from '../locales/uk.json'
import vi from '../locales/vi.json'
import zh from '../locales/zh.json'

export const SUPPORTED_UI_LOCALES = [
  'ar',
  'cs',
  'da',
  'de',
  'el',
  'en',
  'es',
  'et',
  'fi',
  'fr',
  'he',
  'hi',
  'it',
  'nl',
  'no',
  'pl',
  'pt',
  'ro',
  'sv',
  'tr',
  'uk',
  'vi',
  'zh',
] as const
export type UiLocale = (typeof SUPPORTED_UI_LOCALES)[number]

export const DEFAULT_UI_LOCALE: UiLocale = 'en'

const isUiLocale = (value: unknown): value is UiLocale =>
  typeof value === 'string' && SUPPORTED_UI_LOCALES.some((locale) => locale === value)

// Match a single locale tag (e.g. "fr-CA", "fr", "FR") against the
// supported set. Tries the full tag first, then the primary subtag.
// Returns null when nothing in our catalogue maps to it.
export const matchSupportedLocale = (raw: string | undefined): UiLocale | null => {
  if (raw === undefined || raw === '') {
    return null
  }
  const lower = raw.toLowerCase()
  if (isUiLocale(lower)) {
    return lower
  }
  const primary = lower.split('-')[0]
  if (isUiLocale(primary)) {
    return primary
  }
  return null
}

// Parse an Accept-Language header (or any comma-separated locale list) and
// return the first supported match. Used server-side by the route's
// beforeLoad so SSR can render in the visitor's preferred locale before the
// `?lang=` query param is set.
export const matchLocaleFromAcceptLanguage = (header: string | undefined): UiLocale | null => {
  if (header === undefined || header === '') {
    return null
  }
  for (const entry of header.split(',')) {
    const tag = entry.split(';')[0]?.trim()
    const matched = matchSupportedLocale(tag)
    if (matched !== null) {
      return matched
    }
  }
  return null
}

// Read the `?lang=` URL search param synchronously so the FIRST render matches
// the URL. Falls back to the browser's preferred locale (navigator.languages)
// so a French visitor landing on `/` without an explicit ?lang= hydrates in
// French and matches the SSR HTML produced by the route's beforeLoad
// (which detects Accept-Language). Without this, i18next initialises with
// DEFAULT_UI_LOCALE on the client and beforeLoad changes it, causing a
// hydration mismatch on locales other than EN.
const readInitialLocale = (): UiLocale => {
  if (typeof window === 'undefined') {
    return DEFAULT_UI_LOCALE
  }
  const fromUrl = matchSupportedLocale(new URLSearchParams(window.location.search).get('lang') ?? undefined)
  if (fromUrl !== null) {
    return fromUrl
  }
  const browserLocales = navigator.languages ?? [navigator.language]
  for (const candidate of browserLocales) {
    const matched = matchSupportedLocale(candidate)
    if (matched !== null) {
      return matched
    }
  }
  return DEFAULT_UI_LOCALE
}

// Init returns a Promise. Capture it so callers (e.g. the route's
// beforeLoad) can `await i18nReady` before rendering — without the await,
// the very first render happens before the init's microtask resolves and
// useTranslation returns key strings instead of translated values
// (visible as a flash on initial paint).
const i18nReady: Promise<unknown> = i18n.isInitialized
  ? Promise.resolve()
  : i18n.use(initReactI18next).init({
      resources: {
        ar: { common: ar },
        cs: { common: cs },
        da: { common: da },
        de: { common: de },
        el: { common: el },
        en: { common: en },
        es: { common: es },
        et: { common: et },
        fi: { common: fi },
        fr: { common: fr },
        he: { common: he },
        hi: { common: hi },
        it: { common: it },
        nl: { common: nl },
        no: { common: no },
        pl: { common: pl },
        pt: { common: pt },
        ro: { common: ro },
        sv: { common: sv },
        tr: { common: tr },
        uk: { common: uk },
        vi: { common: vi },
        zh: { common: zh },
      },
      lng: readInitialLocale(),
      fallbackLng: DEFAULT_UI_LOCALE,
      defaultNS: 'common',
      interpolation: { escapeValue: false },
      returnNull: false,
    })

export { i18n, i18nReady }
