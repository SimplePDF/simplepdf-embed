import { TypeSafeClient, choice, noul, AuthenticationError, type ChoiceResponse } from "@typesafe-ai/sdk"
import type { EmbedActions } from "@simplepdf/react-embed-pdf"
import type { ParsedCsvRecord } from "./csv"
import type { Result } from "./result"

// The editor's field shape, derived from the embed action's own return type (single owner, no copy).
type BridgeOk<TResult> = Extract<TResult, { success: true }>
export type EditorField = BridgeOk<Awaited<ReturnType<EmbedActions["getFields"]>>>["data"]["fields"][number]

// Confidence routing, grounded in Typesafe's calibrated-confidence pattern.
// CF: plans/P107-typesafe-jev-example.md
const AUTOFILL_MIN = 0.85
const FLOOR = 0.6
const NONE_LABEL = "none"

type MappingDisposition = "autofilled" | "suggested" | "uncertain" | "none"

type MappingCandidate = { column: string; probability: number }

export type FieldMapping = {
  field: EditorField
  column: string | null
  value: string | null
  confidence: number
  disposition: MappingDisposition
  candidates: MappingCandidate[]
}

export type Issue = {
  id: string
  severity: "amber" | "red"
  fieldId: string
  page: number
  fieldLabel: string
  message: string
  // A short annotation shown on the field's "from" line (e.g. a plausibility score), so the
  // message stays terse; null when the issue has none.
  note: string | null
  candidates: MappingCandidate[]
}

const fieldLabel = (field: EditorField): string => field.name ?? field.fieldId

const topCandidates = (probabilities: Record<string, number>): MappingCandidate[] =>
  Object.entries(probabilities)
    .filter(([label, probability]) => label !== NONE_LABEL && Math.round(probability * 100) > 0)
    .map(([column, probability]) => ({ column, probability }))
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 3)

// A checkbox's "empty" render state. The editor publishes a checkbox's full value-set as its
// GET_FIELDS `options` (["checked", "xchecked", "unchecked"]), so we never hardcode the set —
// we only need to know which chosen option means "leave the box empty".
// CF: client/entities.ts (CHECKBOX_OPTIONS)
const CHECKBOX_UNCHECKED = "unchecked"

const dispositionFor = (hasValue: boolean, confidence: number): MappingDisposition => {
  if (!hasValue) {
    return "none"
  }
  if (confidence >= AUTOFILL_MIN) {
    return "autofilled"
  }
  if (confidence >= FLOOR) {
    return "suggested"
  }
  return "uncertain"
}

const isCheckbox = (field: EditorField): boolean => field.type === "CHECKBOX"

// How JEV fills a field, by type. Signature/picture hold binary data (a data URL), never a value
// to map from a CSV column or judge for plausibility, so they are manual-only and their values
// never leave the browser through the proxy.
type FieldHandling = "text" | "options" | "manual"
const fieldHandling = (field: EditorField): FieldHandling => {
  switch (field.type) {
    case "TEXT":
    case "COMB_TEXT":
      return "text"
    case "CHECKBOX":
    case "DROPDOWN":
    case "RADIO":
      return "options"
    case "SIGNATURE":
    case "PICTURE":
      return "manual"
    default:
      field.type satisfies never
      return "manual"
  }
}

// A constrained field (checkbox, dropdown, radio) advertises its allowed values as `options`; a
// free field has none. setFieldValue rejects anything outside a constrained field's options, so
// these are filled by PICKING an option, not by writing a CSV column's text.
const fieldOptions = (field: EditorField): string[] | null =>
  field.options !== null && field.options.length > 0 ? field.options : null

// A chosen option that leaves the field blank: the explicit "leave it blank" escape, an empty
// option, or a checkbox's "unchecked" state. Everything else is a real value to set.
const isBlankOption = (field: EditorField, option: string): boolean =>
  option === NONE_LABEL || option.trim() === "" || (isCheckbox(field) && option === CHECKBOX_UNCHECKED)

// A constrained field is a pick-an-option judgment, not a column pick: JEV chooses which of the
// field's own options fits the record. A real option above the floor gets set (auto above
// AUTOFILL_MIN, else confirm); a blank verdict, or anything below the floor, leaves it empty with
// no note (a low-confidence pick is more likely wrong than a missed one).
const toOptionMapping = (field: EditorField, answer: ChoiceResponse): FieldMapping => {
  const probability = answer.probabilities[answer.choice] ?? answer.confidence
  const shouldSet = !isBlankOption(field, answer.choice) && probability >= FLOOR
  return {
    field,
    column: null,
    value: shouldSet ? answer.choice : null,
    confidence: probability,
    disposition: dispositionFor(shouldSet, probability),
    candidates: [],
  }
}

const toFieldMapping = (field: EditorField, record: ParsedCsvRecord, answer: ChoiceResponse): FieldMapping => {
  if (fieldOptions(field) !== null) {
    return toOptionMapping(field, answer)
  }
  const column = answer.choice === NONE_LABEL ? null : answer.choice
  // Display AND gating use the chosen label's probability (exactly what the candidate
  // chips show), so the message % and the chip % never disagree.
  const probability = answer.probabilities[answer.choice] ?? answer.confidence
  const disposition = dispositionFor(column !== null, probability)
  const rawValue = column === null ? null : record.values[column] ?? null
  const value = disposition === "autofilled" || disposition === "suggested" ? rawValue : null
  return {
    field,
    column,
    value,
    confidence: probability,
    disposition,
    candidates: topCandidates(answer.probabilities),
  }
}

// A suggested text fill shows its confidence on the "from" line, so its message is empty; a
// suggested constrained field (checkbox/dropdown/radio) has no source column, so it carries its
// confidence in the message instead.
const mappingMessage = (mapping: FieldMapping): string => {
  const percent = Math.round(mapping.confidence * 100)
  switch (mapping.disposition) {
    case "suggested": {
      if (mapping.column !== null) {
        return ""
      }
      const action = mapping.field.type === "CHECKBOX" ? "this box should be checked" : `"${mapping.value ?? ""}"`
      return `Confirm ${action} (confidence: ${percent}%)`
    }
    case "uncertain":
      return "No perfect match"
    case "autofilled":
    case "none":
      return ""
    default:
      mapping.disposition satisfies never
      return ""
  }
}

// Amber issues: fields JEV filled with medium confidence (confirm) or could not
// confidently map (a candidate exists but sits below the floor).
export const deriveMappingIssues = (mappings: FieldMapping[]): Issue[] =>
  mappings
    .filter((mapping) => mapping.disposition === "suggested" || mapping.disposition === "uncertain")
    .map((mapping) => ({
      id: mapping.field.fieldId,
      severity: "amber",
      fieldId: mapping.field.fieldId,
      page: mapping.field.page,
      fieldLabel: fieldLabel(mapping.field),
      message: mappingMessage(mapping),
      note: null,
      candidates: mapping.candidates,
    }))

// A field JEV mapped and tried to fill but the editor rejected the write: a hard error the
// human must resolve by hand. Self-clears once the field carries a value (a manual entry then a
// re-validate), so it never lingers after the human fixes it.
export const deriveFillFailureIssues = (fields: EditorField[], failedFieldIds: ReadonlySet<string>): Issue[] =>
  fields
    .filter((field) => failedFieldIds.has(field.fieldId) && (field.value ?? "").trim() === "")
    .map((field) => ({
      id: `fill-failed:${field.fieldId}`,
      severity: "red",
      fieldId: field.fieldId,
      page: field.page,
      fieldLabel: fieldLabel(field),
      message: "This field could not be filled automatically",
      note: null,
      candidates: [],
    }))

// One row per FORM field (all of get_fields): its current value, the record column the
// JEV mapping filled it from, and its status. Surfaces the whole form, not just the
// columns that matched — so junk-named or unmatched fields are still visible.
export type FieldRowState = "filled" | "confirm" | "confirmed" | "error" | "empty"
type FieldRow = {
  fieldId: string
  fieldName: string
  value: string
  sourceColumn: string | null
  // The orange annotation on the "from" line: a mapping confidence, or a plausibility score.
  fromNote: string | null
  page: number
  state: FieldRowState
  issue: Issue | null
}

export const buildFieldRows = (
  fields: EditorField[],
  mappings: FieldMapping[],
  issues: Issue[],
  confirmedFieldIds: ReadonlySet<string>,
): FieldRow[] => {
  const mappingByFieldId = new Map<string, FieldMapping>()
  for (const mapping of mappings) {
    mappingByFieldId.set(mapping.field.fieldId, mapping)
  }
  // Red (validation error) wins over amber (mapping/plausibility) on the same field, so a
  // field that is both flagged never gets downgraded to amber and undercounts errors.
  const issueByFieldId = new Map<string, Issue>()
  for (const issue of issues) {
    const existing = issueByFieldId.get(issue.fieldId)
    if (existing !== undefined && existing.severity === "red" && issue.severity !== "red") {
      continue
    }
    issueByFieldId.set(issue.fieldId, issue)
  }

  return fields.map((field): FieldRow => {
    const value = field.value ?? ""
    const isFilled = value.trim() !== ""
    const rawIssue = issueByFieldId.get(field.fieldId) ?? null
    const mapping = mappingByFieldId.get(field.fieldId) ?? null
    const sourceColumn = mapping?.column ?? null
    // A filled field driven by an amber mapping (a suggested fill, OR a low-confidence best guess
    // the editor filled through a comb group) reads like a confirmed fill: show its confidence on
    // the "from" line. The "No perfect match" prompt only applies to a field that is still empty,
    // so on a filled uncertain field blank that message and keep just the confidence + confirm.
    const isAmberMapping =
      mapping !== null && (mapping.disposition === "suggested" || mapping.disposition === "uncertain")
    const issue =
      rawIssue !== null && mapping !== null && mapping.disposition === "uncertain" && isFilled
        ? { ...rawIssue, message: "" }
        : rawIssue
    // The "from" annotation: a plausibility score (from the issue) takes precedence, else the
    // mapping confidence for a filled amber mapping.
    const fromNote = ((): string | null => {
      if (issue !== null && issue.note !== null) {
        return issue.note
      }
      if (isAmberMapping && isFilled && mapping !== null) {
        return `confidence: ${Math.round(mapping.confidence * 100)}%`
      }
      return null
    })()
    const state: FieldRowState = ((): FieldRowState => {
      if (issue !== null) {
        return issue.severity === "red" ? "error" : "confirm"
      }
      if (confirmedFieldIds.has(field.fieldId)) {
        return "confirmed"
      }
      return isFilled ? "filled" : "empty"
    })()
    return { fieldId: field.fieldId, fieldName: field.name ?? field.fieldId, value, sourceColumn, fromNote, page: field.page, state, issue }
  })
}

export type FillSummary = { autofilled: number; suggested: number; uncertain: number }

export const summarizeMappings = (mappings: FieldMapping[]): FillSummary => ({
  autofilled: mappings.filter((mapping) => mapping.disposition === "autofilled").length,
  suggested: mappings.filter((mapping) => mapping.disposition === "suggested").length,
  uncertain: mappings.filter((mapping) => mapping.disposition === "uncertain").length,
})

export type PrimaryAction = "fill" | "validate" | "revalidate"

// The primary button's action, derived purely from the document's current field values and the
// human-confirmed set: an empty document needs a fill pass; a document that already carries
// values only needs validation, which reads as a re-validation once the human has confirmed
// anything. Pure so the label is a function of state, not of which handler last ran.
export const primaryAction = (fields: EditorField[], confirmedFieldIds: ReadonlySet<string>): PrimaryAction => {
  const anyFilled = fields.some((field) => (field.value ?? "").trim() !== "")
  if (!anyFilled) {
    return "fill"
  }
  return confirmedFieldIds.size > 0 ? "revalidate" : "validate"
}

// Route through our same-origin proxy: api.typesafe.ai has no browser CORS, so the
// SDK's base URL points at /api/jev, which forwards server-side.
// CF: plans/P107-typesafe-jev-example.md
const createJevClient = (apiKey: string): TypeSafeClient =>
  new TypeSafeClient({ apiKey, dangerouslyAllowBrowser: true, baseURL: `${window.location.origin}/api/jev` })

type MapErrorCode = "no_fields" | "auth_failed" | "jev_request_failed"

const toJevError = (e: unknown): { code: "auth_failed" | "jev_request_failed"; message: string } => {
  const error = e as Error
  if (error instanceof AuthenticationError) {
    return { code: "auth_failed", message: "JEV rejected the API key. Check your console.typesafe.ai key." }
  }
  return { code: "jev_request_failed", message: `JEV request failed: ${error.name}: ${error.message}` }
}

// A constrained field asks which of its own options fits the record; every other field asks which
// CSV column fills it. Both are Choice questions, so they ride one systemOne call.
const questionForField = (field: EditorField, columnCriteria: Record<string, string>): ReturnType<typeof choice> => {
  const options = fieldOptions(field)
  if (options !== null) {
    const optionCriteria: Record<string, string> = {
      ...Object.fromEntries(options.map((option) => [option, `The correct value for this field is "${option}"`])),
      [NONE_LABEL]: "No option fits the record; leave the field blank",
    }
    return choice(
      `Given the record, which value fits the field labeled "${fieldLabel(field)}" (type ${field.type})? Answer "${NONE_LABEL}" to leave it blank.`,
      optionCriteria,
    )
  }
  return choice(
    `Which CSV column should fill the form field labeled "${fieldLabel(field)}" (type ${field.type})? Answer "${NONE_LABEL}" if no column fits.`,
    columnCriteria,
  )
}

export const mapColumnsToFields = async ({
  apiKey,
  record,
  fields,
}: {
  apiKey: string
  record: ParsedCsvRecord
  fields: EditorField[]
}): Promise<Result<FieldMapping[], MapErrorCode>> => {
  if (fields.length === 0) {
    return { success: false, error: { code: "no_fields", message: "No form fields were found in the document" } }
  }

  const criteria: Record<string, string> = {
    ...Object.fromEntries(record.columns.map((column) => [column, `CSV column "${column}" = "${record.values[column] ?? ""}"`])),
    [NONE_LABEL]: "No CSV column fits this field",
  }

  // Signature/picture fields are manual-only: never ask JEV about them, so their (data-URL)
  // values are never included in the systemOne request.
  const questions = Object.fromEntries(
    fields
      .filter((field) => fieldHandling(field) !== "manual")
      .map((field) => [field.fieldId, questionForField(field, criteria)]),
  )

  const client = createJevClient(apiKey)

  const answersResult = await (async (): Promise<Result<Record<string, ChoiceResponse>, MapErrorCode>> => {
    try {
      const { answers } = await client.systemOne({ state: record.values, questions })
      return { success: true, data: answers }
    } catch (e) {
      return { success: false, error: toJevError(e) }
    }
  })()

  if (!answersResult.success) {
    return answersResult
  }

  return {
    success: true,
    data: fields.flatMap((field) => {
      const answer = answersResult.data[field.fieldId]
      return answer === undefined ? [] : [toFieldMapping(field, record, answer)]
    }),
  }
}

// Pass B, JEV half: a judgment pass a model is genuinely needed for. Per filled field,
// `noul` returns P(the value is genuine/plausible for its label); low means fictional,
// placeholder, or obviously wrong. Agnostic — works on any field of any PDF. The precise
// cross-field rules (deadlines, arithmetic) are the deterministic half in lib/validate.ts.
// CF: plans/P107-typesafe-jev-example.md
const PLAUSIBILITY_MIN = 0.3

export const validatePlausibility = async ({
  apiKey,
  fields,
}: {
  apiKey: string
  fields: EditorField[]
}): Promise<Result<Issue[], MapErrorCode>> => {
  // Only free-text fields carry a real-world value worth a genuine/fictional judgment. Constrained
  // fields hold a controlled option, and signature/picture hold binary data — both are excluded,
  // so no option state or data URL is ever sent to JEV.
  const filled = fields.filter((field) => fieldHandling(field) === "text" && (field.value ?? "").trim() !== "")
  if (filled.length === 0) {
    return { success: true, data: [] }
  }

  const state = { fields: Object.fromEntries(filled.map((field) => [fieldLabel(field), field.value ?? ""])) }
  const questions = Object.fromEntries(
    filled.map((field) => [
      field.fieldId,
      noul(
        `Is "${field.value ?? ""}" a genuine, plausible value for the field labeled "${fieldLabel(field)}" (not fictional, a placeholder, or obviously wrong)?`,
      ),
    ]),
  )

  try {
    const { answers } = await createJevClient(apiKey).systemOne({ state, questions })
    const issues = filled.flatMap((field): Issue[] => {
      const answer = answers[field.fieldId]
      if (answer === undefined || answer.noul >= PLAUSIBILITY_MIN) {
        return []
      }
      const genuine = answer.noul
      return [
        {
          id: `plausibility:${field.fieldId}`,
          severity: "amber",
          fieldId: field.fieldId,
          page: field.page,
          fieldLabel: fieldLabel(field),
          message: "Looks fictional or implausible",
          note: `JEV ${Math.round(genuine * 100)}% genuine`,
          candidates: [],
        },
      ]
    })
    return { success: true, data: issues }
  } catch (e) {
    return { success: false, error: toJevError(e) }
  }
}
