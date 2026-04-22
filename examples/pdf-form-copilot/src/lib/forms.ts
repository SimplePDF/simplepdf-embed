export type FormId = 'w9' | 'healthcare' | 'hr' | 'state' | 'state_scanned' | 'custom'

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

const DEFAULT_FORMS: Record<FormId, FormConfig> = {
  w9: {
    id: 'w9',
    useCaseKey: 'forms.useCases.tax',
    labelKey: 'forms.labels.w9',
    pdfUrl: 'https://cdn.simplepdf.com/simple-pdf/assets/demo/fw9.pdf',
  },
  healthcare: {
    id: 'healthcare',
    useCaseKey: 'forms.useCases.healthcare',
    labelKey: 'forms.labels.cms1500',
    pdfUrl: 'https://cdn.simplepdf.com/simple-pdf/assets/onboarding/cms-1500.pdf',
  },
  hr: {
    id: 'hr',
    useCaseKey: 'forms.useCases.hr',
    labelKey: 'forms.labels.mnda',
    pdfUrl: 'https://cdn.simplepdf.com/simple-pdf/assets/onboarding/mnda.pdf',
  },
  state: {
    id: 'state',
    useCaseKey: 'forms.useCases.state',
    labelKey: 'forms.labels.loonheffingen',
    pdfUrl: 'https://cdn.simplepdf.com/simple-pdf/assets/demo/loonheffingen.pdf',
  },
  state_scanned: {
    id: 'state_scanned',
    useCaseKey: 'forms.useCases.stateScanned',
    labelKey: 'forms.labels.loonheffingenScanned',
    pdfUrl: 'https://cdn.simplepdf.com/simple-pdf/assets/demo/loonheffingen-scanned.pdf',
  },
  custom: {
    id: 'custom',
    useCaseKey: 'forms.useCases.custom',
    labelKey: 'forms.labels.custom',
    pdfUrl: '',
  },
}

const DEFAULT_ORDER: FormId[] = ['w9', 'healthcare', 'hr', 'state', 'state_scanned', 'custom']

export const DEFAULT_FORM_ID: FormId = 'w9'

// Forms can be differentiated per locale later. For now every locale shares
// the same list; consumers must still route through getFormsForLocale so
// swapping in locale-specific variants is a one-file change.
export const getFormsForLocale = (_locale: string): LocaleForms => ({
  order: DEFAULT_ORDER,
  forms: DEFAULT_FORMS,
})

export const isFormId = (value: unknown): value is FormId =>
  value === 'w9' ||
  value === 'healthcare' ||
  value === 'hr' ||
  value === 'state' ||
  value === 'state_scanned' ||
  value === 'custom'
