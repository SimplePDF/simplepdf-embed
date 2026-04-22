export type Language = {
  code: string
  label: string
  native: string
}

export const LANGUAGES: Language[] = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'ar', label: 'Arabic', native: 'العربية' },
  { code: 'zh', label: 'Chinese', native: '中文' },
  { code: 'cs', label: 'Czech', native: 'Čeština' },
  { code: 'da', label: 'Danish', native: 'Dansk' },
  { code: 'nl', label: 'Dutch', native: 'Nederlands' },
  { code: 'fi', label: 'Finnish', native: 'Suomi' },
  { code: 'fr', label: 'French', native: 'Français' },
  { code: 'de', label: 'German', native: 'Deutsch' },
  { code: 'el', label: 'Greek', native: 'Ελληνικά' },
  { code: 'he', label: 'Hebrew', native: 'עברית' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'it', label: 'Italian', native: 'Italiano' },
  { code: 'ja', label: 'Japanese', native: '日本語' },
  { code: 'ko', label: 'Korean', native: '한국어' },
  { code: 'no', label: 'Norwegian', native: 'Norsk' },
  { code: 'pl', label: 'Polish', native: 'Polski' },
  { code: 'pt', label: 'Portuguese', native: 'Português' },
  { code: 'ro', label: 'Romanian', native: 'Română' },
  { code: 'ru', label: 'Russian', native: 'Русский' },
  { code: 'es', label: 'Spanish', native: 'Español' },
  { code: 'sv', label: 'Swedish', native: 'Svenska' },
  { code: 'tr', label: 'Turkish', native: 'Türkçe' },
  { code: 'uk', label: 'Ukrainian', native: 'Українська' },
  { code: 'vi', label: 'Vietnamese', native: 'Tiếng Việt' },
]

export const DEFAULT_LANGUAGE_CODE = 'en'

export const getLanguageByCode = (code: string): Language | null =>
  LANGUAGES.find((language) => language.code === code) ?? null

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

export const filterLanguages = (query: string): Language[] => {
  const trimmed = query.trim()
  if (trimmed === '') {
    return LANGUAGES
  }
  const needle = normalize(trimmed)
  return LANGUAGES.filter(
    (language) => normalize(language.label).includes(needle) || normalize(language.native).includes(needle),
  )
}
