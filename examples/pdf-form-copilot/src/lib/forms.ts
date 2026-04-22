export type FormId = 'w9' | 'nl'

type FormConfig = {
  id: FormId
  label: string
  switchLabel: string
  pdfUrl: string
}

export const FORMS: Record<FormId, FormConfig> = {
  w9: {
    id: 'w9',
    label: 'IRS W-9',
    switchLabel: 'Back to IRS W-9 (English)',
    pdfUrl: 'https://cdn.simplepdf.com/simple-pdf/assets/demo/fw9.pdf',
  },
  nl: {
    id: 'nl',
    label: 'Loonheffingen',
    switchLabel: 'Try it in Dutch — works across languages',
    pdfUrl: 'https://cdn.simplepdf.com/simple-pdf/assets/demo/loonheffingen.pdf',
  },
}

export const DEFAULT_FORM_ID: FormId = 'w9'

export const otherFormId = (id: FormId): FormId => (id === 'w9' ? 'nl' : 'w9')

export const isFormId = (value: unknown): value is FormId => value === 'w9' || value === 'nl'
