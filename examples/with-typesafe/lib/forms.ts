import type { EmbedDocument } from "@simplepdf/react-embed-pdf"
import { DEMO_CSV_MA_PA, DEMO_CSV_W9 } from "./demo-data"

// A selectable form in the gallery. Every form ships a hosted document and a demo CSV; JEV maps
// the CSV onto the fields and a JEV plausibility pass validates the result.
// CF: plans/P107-typesafe-jev-example.md
export type FormDefinition = {
  id: string
  label: string
  description: string
  document: EmbedDocument
  demoCsv: string
}

const FORM_MA_PA: FormDefinition = {
  id: "ma-pa",
  label: "Medication Prior Auth",
  description: "MA standard form, healthcare workflow.",
  document: { url: "https://cdn.simplepdf.com/simple-pdf/assets/use-cases/ma_pa_form_clean.pdf" },
  demoCsv: DEMO_CSV_MA_PA,
}

export const FORM_W9: FormDefinition = {
  id: "w9",
  label: "IRS W-9",
  description: "Vendor onboarding, taxpayer ID.",
  document: { url: "https://www.irs.gov/pub/irs-pdf/fw9.pdf" },
  demoCsv: DEMO_CSV_W9,
}

export const FORMS: FormDefinition[] = [FORM_W9, FORM_MA_PA]
