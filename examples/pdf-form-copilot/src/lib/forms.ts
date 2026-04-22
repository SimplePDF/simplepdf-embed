export type FormId = 'w9' | 'healthcare' | 'hr' | 'state' | 'state_scanned'

type FormConfig = {
  id: FormId
  useCaseKey: string
  labelKey: string
  pdfUrl: string
}

export const FORMS: Record<FormId, FormConfig> = {
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
}

export const DEFAULT_FORM_ID: FormId = 'w9'
export const FORM_ORDER: FormId[] = ['w9', 'healthcare', 'hr', 'state', 'state_scanned']

export const isFormId = (value: unknown): value is FormId =>
  value === 'w9' ||
  value === 'healthcare' ||
  value === 'hr' ||
  value === 'state' ||
  value === 'state_scanned'
