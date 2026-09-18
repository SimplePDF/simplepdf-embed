// Benchmark-only fixtures (delete with the rest of benchmark/ before the PR). A faithful stand-in
// for the W-9's get_fields output + demo record, so both models are timed on the same payload
// without needing the live editor. The exact field ids don't affect latency; the field COUNT,
// labels, types and CSV size do, and those mirror the shipped W-9 demo.

export type BenchFieldType = "TEXT" | "SIGNATURE" | "PICTURE" | "CHECKBOX" | "COMB_TEXT" | "DROPDOWN" | "RADIO"
export type BenchField = { fieldId: string; name: string; type: BenchFieldType; options: string[] | null }
export type BenchRecord = { columns: string[]; values: Record<string, string> }
export type BenchFilledField = { name: string; value: string }
export type BenchInput = { fields: BenchField[]; record: BenchRecord; filled: BenchFilledField[] }

const CHECKBOX_OPTIONS = ["checked", "xchecked", "unchecked"]

const text = (fieldId: string, name: string): BenchField => ({ fieldId, name, type: "TEXT", options: null })
const comb = (fieldId: string, name: string): BenchField => ({ fieldId, name, type: "COMB_TEXT", options: null })
const checkbox = (fieldId: string, name: string): BenchField => ({ fieldId, name, type: "CHECKBOX", options: CHECKBOX_OPTIONS })

const W9_FIELDS: BenchField[] = [
  text("f0", "Name of entity / individual"),
  text("f1", "Business name"),
  checkbox("f2", "Individual / sole proprietor"),
  checkbox("f3", "C corporation"),
  checkbox("f4", "S corporation"),
  checkbox("f5", "Partnership"),
  checkbox("f6", "Trust / estate"),
  checkbox("f7", "LLC"),
  text("f8", "LLC Tax classification"),
  text("f9", "Other (entity name as per instructions)"),
  checkbox("f10", "Other (see instructions)"),
  text("f11", "Exempt payee code (if any)"),
  text("f12", "Exemption from FATCA reporting code (if any)"),
  checkbox("f13", "Foreign partners, owners, or beneficiaries (see instructions)"),
  text("f14", "Address (number, street, and apt. or suite no.)"),
  text("f15", "City, state, and ZIP code"),
  text("f16", "Requester's name and address (optional)"),
  text("f17", "List account number(s) here (optional)"),
  comb("f18", "SSN (first 3 digits)"),
  comb("f19", "SSN (middle 2 digits)"),
  comb("f20", "SSN (last 4 digits)"),
  comb("f21", "EIN (first 2 digits)"),
  comb("f22", "EIN (last 7 digits)"),
  { fieldId: "f23", name: "signature", type: "SIGNATURE", options: null },
]

const W9_RECORD: BenchRecord = {
  columns: ["name", "business_name", "federal_tax_classification", "address", "city_state_zip", "taxpayer_id"],
  values: {
    name: "Northwind Labs, Inc.",
    business_name: "Northwind Labs",
    federal_tax_classification: "C Corporation",
    address: "500 Howard Street",
    city_state_zip: "San Francisco, CA 94105",
    taxpayer_id: "84-1234567",
  },
}

// The values that would be filled after the mapping pass, judged by the plausibility pass. Fixed
// so both models judge the identical set (decoupled from each model's own mapping result).
const W9_FILLED: BenchFilledField[] = [
  { name: "Name of entity / individual", value: "Northwind Labs, Inc." },
  { name: "Business name", value: "Northwind Labs" },
  { name: "LLC Tax classification", value: "C Corporation" },
  { name: "Address (number, street, and apt. or suite no.)", value: "500 Howard Street" },
  { name: "City, state, and ZIP code", value: "San Francisco, CA 94105" },
  { name: "SSN (first 3 digits)", value: "84-1234567" },
  { name: "EIN (first 2 digits)", value: "84-1234567" },
  { name: "EIN (last 7 digits)", value: "84-1234567" },
]

export const W9_INPUT: BenchInput = { fields: W9_FIELDS, record: W9_RECORD, filled: W9_FILLED }
