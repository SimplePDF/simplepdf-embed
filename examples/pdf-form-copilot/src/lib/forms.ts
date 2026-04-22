export type FormId = 'w9' | 'healthcare' | 'hr' | 'state' | 'state_scanned'

type FormConfig = {
  id: FormId
  useCase: string
  label: string
  summary: string
  pdfUrl: string
}

export const FORMS: Record<FormId, FormConfig> = {
  w9: {
    id: 'w9',
    useCase: 'Tax',
    label: 'IRS W-9',
    summary: 'Classic US tax form every contractor fills at least once.',
    pdfUrl: 'https://cdn.simplepdf.com/simple-pdf/assets/demo/fw9.pdf',
  },
  healthcare: {
    id: 'healthcare',
    useCase: 'Healthcare',
    label: 'CMS-1500 claim form',
    summary: 'Healthcare insurance claim form. PHI-heavy, compliance-heavy.',
    pdfUrl: 'https://cdn.simplepdf.com/simple-pdf/assets/onboarding/cms-1500.pdf',
  },
  hr: {
    id: 'hr',
    useCase: 'HR onboarding',
    label: 'Mutual NDA',
    summary: 'Standard employee/contractor onboarding paperwork.',
    pdfUrl: 'https://cdn.simplepdf.com/simple-pdf/assets/onboarding/mnda.pdf',
  },
  state: {
    id: 'state',
    useCase: 'State bureaucracy',
    label: 'Loonheffingen (NL)',
    summary: 'Dutch wage-tax declaration. Perfect example of a non-English form an expat has to fill on day one.',
    pdfUrl: 'https://cdn.simplepdf.com/simple-pdf/assets/demo/loonheffingen.pdf',
  },
  state_scanned: {
    id: 'state_scanned',
    useCase: 'State bureaucracy (scanned PDF)',
    label: 'Loonheffingen scanned',
    summary:
      'Same Dutch tax form, rasterized to emulate a scanned document. Showcases SimplePDF\'s field detection + OCR path on forms that have no native form fields.',
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
