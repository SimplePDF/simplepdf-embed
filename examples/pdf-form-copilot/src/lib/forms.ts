export type FormId =
  | 'w9'
  | 'w4'
  | 'i9'
  | 'healthcare'
  | 'hr'
  | 'state'
  | 'state_scanned'
  | 'cerfa_12485'
  | 'custom'

export type FormConfig = {
  id: FormId
  useCaseKey: string
  labelKey: string
  pdfUrl: string
}

export type LocaleForms = {
  order: FormId[]
  forms: Record<FormId, FormConfig>
}

const CDN_BASE = 'https://cdn.simplepdf.com/simple-pdf/assets'

const ALL_FORMS: Record<FormId, FormConfig> = {
  w9: {
    id: 'w9',
    useCaseKey: 'forms.useCases.tax',
    labelKey: 'forms.labels.w9',
    pdfUrl: `${CDN_BASE}/demo/fw9.pdf`,
  },
  w4: {
    id: 'w4',
    useCaseKey: 'forms.useCases.tax',
    labelKey: 'forms.labels.w4',
    pdfUrl: `${CDN_BASE}/form-copilot/fw4.pdf`,
  },
  i9: {
    id: 'i9',
    useCaseKey: 'forms.useCases.hr',
    labelKey: 'forms.labels.i9',
    pdfUrl: `${CDN_BASE}/form-copilot/i-9.pdf`,
  },
  healthcare: {
    id: 'healthcare',
    useCaseKey: 'forms.useCases.healthcare',
    labelKey: 'forms.labels.cms1500',
    pdfUrl: `${CDN_BASE}/onboarding/cms-1500.pdf`,
  },
  hr: {
    id: 'hr',
    useCaseKey: 'forms.useCases.hr',
    labelKey: 'forms.labels.mnda',
    pdfUrl: `${CDN_BASE}/onboarding/mnda.pdf`,
  },
  state: {
    id: 'state',
    useCaseKey: 'forms.useCases.state',
    labelKey: 'forms.labels.loonheffingen',
    pdfUrl: `${CDN_BASE}/demo/loonheffingen.pdf`,
  },
  state_scanned: {
    id: 'state_scanned',
    useCaseKey: 'forms.useCases.stateScanned',
    labelKey: 'forms.labels.loonheffingenScanned',
    pdfUrl: `${CDN_BASE}/demo/loonheffingen-scanned.pdf`,
  },
  cerfa_12485: {
    id: 'cerfa_12485',
    useCaseKey: 'forms.useCases.healthcare',
    labelKey: 'forms.labels.cerfa12485',
    pdfUrl: `${CDN_BASE}/form-copilot/cerfa-12485.pdf`,
  },
  custom: {
    id: 'custom',
    useCaseKey: 'forms.useCases.custom',
    labelKey: 'forms.labels.custom',
    pdfUrl: '',
  },
}

const EN_ORDER: FormId[] = ['custom', 'w9', 'w4', 'i9', 'healthcare', 'hr']
const NL_ORDER: FormId[] = ['custom', 'state', 'state_scanned']
const FR_ORDER: FormId[] = ['custom', 'cerfa_12485']
const FALLBACK_ORDER: FormId[] = ['custom', 'w9']

export const DEFAULT_FORM_ID: FormId = 'w9'

// Locale-specific form catalogues. Non-EN locales default to a single
// language-appropriate form (plus the "pick your own" slot). The use-case
// modal remains anchored on US English forms regardless of UI locale —
// clicking a use-case card switches language back to EN so the chosen form
// shows up in the picker afterwards.
export const getFormsForLocale = (locale: string): LocaleForms => {
  const order = ((): FormId[] => {
    if (locale === 'en') {
      return EN_ORDER
    }
    if (locale === 'nl') {
      return NL_ORDER
    }
    if (locale === 'fr') {
      return FR_ORDER
    }
    return FALLBACK_ORDER
  })()
  return { order, forms: ALL_FORMS }
}

export const isFormId = (value: unknown): value is FormId =>
  value === 'w9' ||
  value === 'w4' ||
  value === 'i9' ||
  value === 'healthcare' ||
  value === 'hr' ||
  value === 'state' ||
  value === 'state_scanned' ||
  value === 'cerfa_12485' ||
  value === 'custom'
