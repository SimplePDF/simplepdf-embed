// Locale-aware URL builder for SimplePDF marketing links. SimplePDF hosts
// the marketing site under a locale-prefixed path for a subset of languages;
// every other locale (including en) falls through to the unprefixed URL.

const SUPPORTED_SITE_LOCALES = new Set(['de', 'es', 'fr', 'it', 'nl', 'pt'])

const BASE = 'https://simplepdf.com'

export const buildSimplepdfUrl = ({
  locale,
  path = '',
  query,
}: {
  locale: string
  path?: string
  query?: Record<string, string>
}): string => {
  const localeSegment = SUPPORTED_SITE_LOCALES.has(locale) ? `/${locale}` : ''
  const normalizedPath = ((): string => {
    if (path === '' || path === '/') {
      return ''
    }
    return path.startsWith('/') ? path : `/${path}`
  })()
  const search = ((): string => {
    if (query === undefined) {
      return ''
    }
    const params = new URLSearchParams(query)
    const raw = params.toString()
    return raw === '' ? '' : `?${raw}`
  })()
  return `${BASE}${localeSegment}${normalizedPath}${search}`
}
