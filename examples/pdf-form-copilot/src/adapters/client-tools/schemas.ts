import { z } from 'zod'

// Zod schemas for the 11 iframe tools. Consumers register these with their
// LLM framework (Vercel AI SDK's `tools`, LangChain, etc.). Each schema
// matches the bridge method signature; the dispatcher routes by tool name.

export const GetFieldsInput = z.object({}).describe('Lists every fillable field currently on the document')

export const GetDocumentContentInput = z
  .object({
    extraction_mode: z.enum(['auto', 'ocr']).default('auto'),
  })
  .describe('Returns extracted text per page. Use "ocr" for scanned documents, otherwise "auto"')

export const DetectFieldsInput = z
  .object({})
  .describe(
    'Asks the editor to auto-detect and create fields on the document. Use when get_fields returned 0 fields before asking the user to add fields manually.',
  )

// Must stay in lockstep with the toolbar in the host app. BOXED_TEXT is a
// field TYPE, not a toolbar option; excluding it from this schema keeps the
// LLM from picking a tool the host UI can't surface.
export const SelectToolInput = z
  .object({
    tool: z
      .enum(['TEXT', 'CHECKBOX', 'PICTURE', 'SIGNATURE'])
      .nullable()
      .describe('Editor tool to activate. Pass null to return to the cursor.'),
  })
  .describe(
    'Switches the active editor tool. Use tool="TEXT" to let the user drop text fields on the document when the form has no native fields.',
  )

export const SetFieldValueInput = z
  .object({
    field_id: z.string().describe('Field identifier from get_fields'),
    value: z
      .string()
      .nullable()
      .describe(
        'Value to write. TEXT/BOXED_TEXT: any string. CHECKBOX: "checked" ticks, null un-ticks (never "true"/"false"). Do not use this tool for SIGNATURE or PICTURE fields.',
      ),
  })
  .describe('Writes a value into a single field in the PDF')

export const FocusFieldInput = z
  .object({ field_id: z.string().describe('Field identifier from get_fields') })
  .describe('Scrolls to and visually highlights a field so the user can see what will be filled next')

export const GoToPageInput = z
  .object({ page: z.number().int().positive().describe('1-based page number') })
  .describe('Scrolls the editor to a given page')

export const SubmitDownloadInput = z
  .object({})
  .describe('Finalizes the filled PDF and triggers a download for the user')

export const CLIENT_TOOL_NAMES = [
  'get_fields',
  'get_document_content',
  'detect_fields',
  'select_tool',
  'set_field_value',
  'focus_field',
  'go_to_page',
  'submit_download',
] as const

export type ClientToolName = (typeof CLIENT_TOOL_NAMES)[number]

export const isClientToolName = (value: unknown): value is ClientToolName =>
  typeof value === 'string' && CLIENT_TOOL_NAMES.some((candidate) => candidate === value)

// Map of tool name → input schema. Consumers typically spread this into
// `streamText({ tools })` (for the ai-sdk path) after calling `.describe`
// on each to add per-call descriptions.
export const CLIENT_TOOL_SCHEMAS = {
  get_fields: GetFieldsInput,
  get_document_content: GetDocumentContentInput,
  detect_fields: DetectFieldsInput,
  select_tool: SelectToolInput,
  set_field_value: SetFieldValueInput,
  focus_field: FocusFieldInput,
  go_to_page: GoToPageInput,
  submit_download: SubmitDownloadInput,
} as const
