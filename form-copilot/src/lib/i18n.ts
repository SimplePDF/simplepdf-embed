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

// Read the `?lang=` URL search param synchronously so the FIRST render matches
// the URL. Without this, i18next initialises with DEFAULT_UI_LOCALE, react-i18next
// renders EN, then the route's `beforeLoad` calls changeLanguage → causes a
// visible flash of English on reload with a non-EN URL.
const readInitialLocale = (): UiLocale => {
  if (typeof window === 'undefined') {
    return DEFAULT_UI_LOCALE
  }
  const raw = new URLSearchParams(window.location.search).get('lang')
  return isUiLocale(raw) ? raw : DEFAULT_UI_LOCALE
}

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
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
}

export { i18n }
