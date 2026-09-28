// Benchmark-only (delete with benchmark/ before the PR). Two backends run the SAME work and return
// BOTH their timing AND their decisions, so the harness can check the outputs are equivalent before
// trusting the latency numbers. JEV via the Typesafe SDK (structured choice/noul); any
// OpenAI-compatible chat model via JSON mode. Node runs server-side, so no CORS and no proxy.
import { TypeSafeClient, choice, noul } from "@typesafe-ai/sdk"
import type { BenchField, BenchInput } from "./fixtures"

export type PhaseTiming = { mapMs: number; classifyMs: number }
export type ModelOutput = {
  timing: PhaseTiming
  mapping: Record<string, string> // fieldId -> chosen column / option / "none"
  plausibility: Record<string, number> // field label -> genuine score (0..1)
}
// `extraBody` is merged into each request, so a reasoning model can be tuned per provider without a
// code change (e.g. { reasoning_effort: "low" }, { thinking: false }).
export type OpenAICompatibleConfig = { baseUrl: string; model: string; apiKey: string; extraBody: Record<string, unknown> }

const JEV_BASE_URL = "https://api.typesafe.ai"
const NONE = "none"
const REQUEST_TIMEOUT_MS = 60_000

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null

const isFillable = (field: BenchField): boolean => field.type !== "SIGNATURE" && field.type !== "PICTURE"
const fieldOptions = (field: BenchField): string[] | null =>
  field.options !== null && field.options.length > 0 ? field.options : null

// --- JEV (Typesafe SDK) — the exact structured questions the app asks ------------------------

const jevMappingQuestions = (input: BenchInput): Record<string, ReturnType<typeof choice>> => {
  const columnCriteria: Record<string, string> = {
    ...Object.fromEntries(input.record.columns.map((column) => [column, `CSV column "${column}" = "${input.record.values[column] ?? ""}"`])),
    [NONE]: "No CSV column fits this field",
  }
  return Object.fromEntries(
    input.fields
      .filter(isFillable)
      .map((field): [string, ReturnType<typeof choice>] => {
        const options = fieldOptions(field)
        if (options !== null) {
          return [
            field.fieldId,
            choice(`Given the record, which value fits the field labeled "${field.name}" (type ${field.type})? Answer "${NONE}" to leave it blank.`, {
              ...Object.fromEntries(options.map((option) => [option, `The correct value for this field is "${option}"`])),
              [NONE]: "No option fits the record; leave the field blank",
            }),
          ]
        }
        return [
          field.fieldId,
          choice(`Which CSV column should fill the form field labeled "${field.name}" (type ${field.type})? Answer "${NONE}" if no column fits.`, columnCriteria),
        ]
      }),
  )
}

const jevPlausibilityQuestions = (input: BenchInput): Record<string, ReturnType<typeof noul>> =>
  Object.fromEntries(
    input.filled.map((field): [string, ReturnType<typeof noul>] => [
      field.name,
      noul(`Is "${field.value}" a genuine, plausible value for the field labeled "${field.name}" (not fictional, a placeholder, or obviously wrong)?`),
    ]),
  )

export const runJev = async (apiKey: string, input: BenchInput): Promise<ModelOutput> => {
  const client = new TypeSafeClient({ apiKey, baseURL: JEV_BASE_URL })

  const mapStart = performance.now()
  const { answers: mapAnswers } = await client.systemOne({ state: input.record.values, questions: jevMappingQuestions(input) })
  const mapMs = performance.now() - mapStart
  const mapping = Object.fromEntries(Object.entries(mapAnswers).map(([fieldId, answer]) => [fieldId, answer.choice]))

  const plausibilityState = { fields: Object.fromEntries(input.filled.map((field) => [field.name, field.value])) }
  const classifyStart = performance.now()
  const { answers: plausAnswers } = await client.systemOne({ state: plausibilityState, questions: jevPlausibilityQuestions(input) })
  const classifyMs = performance.now() - classifyStart
  const plausibility = Object.fromEntries(Object.entries(plausAnswers).map(([label, answer]) => [label, answer.noul]))

  return { timing: { mapMs, classifyMs }, mapping, plausibility }
}

// --- OpenAI-compatible chat model (JSON mode) — the same work, one batched call per phase -------

const chatJson = async (config: OpenAICompatibleConfig, system: string, user: string): Promise<Record<string, unknown>> => {
  const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
      ...config.extraBody,
    }),
    // Fail fast instead of hanging the whole benchmark if the endpoint stalls.
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Model request failed (${response.status}): ${detail.slice(0, 300)}`)
  }
  const data: unknown = await response.json()
  const content = isRecord(data) && Array.isArray(data.choices) && isRecord(data.choices[0]) && isRecord(data.choices[0].message)
    ? data.choices[0].message.content
    : null
  if (typeof content !== "string") {
    throw new Error("Model response missing choices[0].message.content")
  }
  const parsed: unknown = JSON.parse(content)
  return isRecord(parsed) ? parsed : {}
}

const toStringMap = (raw: Record<string, unknown>): Record<string, string> =>
  Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, typeof value === "string" ? value : String(value)]))

const toNumberMap = (raw: Record<string, unknown>): Record<string, number> =>
  Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, typeof value === "number" ? value : Number(value)]))

export const runOpenAICompatible = async (config: OpenAICompatibleConfig, input: BenchInput): Promise<ModelOutput> => {
  const fillable = input.fields.filter(isFillable)
  const fieldLines = fillable
    .map((field) => `- id=${field.fieldId} label="${field.name}" type=${field.type}${field.options !== null ? ` options=[${field.options.join(", ")}]` : ""}`)
    .join("\n")
  const recordLines = input.record.columns.map((column) => `- ${column} = "${input.record.values[column] ?? ""}"`).join("\n")

  const mapStart = performance.now()
  const mapRaw = await chatJson(
    config,
    'You fill PDF form fields from a CSV record. For each field, pick the CSV column whose value belongs in it, or "none". For a field with options, pick one of its options (or "none"). Reply ONLY with a JSON object mapping each field id to the chosen column/option/"none".',
    `CSV record:\n${recordLines}\n\nForm fields:\n${fieldLines}`,
  )
  const mapMs = performance.now() - mapStart

  const filledLines = input.filled.map((field) => `- label="${field.name}" value="${field.value}"`).join("\n")
  const classifyStart = performance.now()
  const plausRaw = await chatJson(
    config,
    "You judge whether each filled PDF field value is genuine and plausible (not fictional, a placeholder, or obviously wrong). Reply ONLY with a JSON object mapping each field label to a number from 0 (implausible) to 1 (genuine).",
    `Filled fields:\n${filledLines}`,
  )
  const classifyMs = performance.now() - classifyStart

  return { timing: { mapMs, classifyMs }, mapping: toStringMap(mapRaw), plausibility: toNumberMap(plausRaw) }
}
