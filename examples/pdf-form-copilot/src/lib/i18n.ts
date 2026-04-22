import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from '../locales/en.json'

export const SUPPORTED_UI_LOCALES = ['en'] as const
export type UiLocale = (typeof SUPPORTED_UI_LOCALES)[number]

export const DEFAULT_UI_LOCALE: UiLocale = 'en'

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources: {
      en: { common: en },
    },
    lng: DEFAULT_UI_LOCALE,
    fallbackLng: DEFAULT_UI_LOCALE,
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    returnNull: false,
  })
}

export { i18n }
