import { z } from 'zod'

export const GetFieldsInput = z.object({}).describe('Lists every fillable field currently on the document')
export const GetFieldsOutput = z.object({
  fields: z.array(
    z.object({
      field_id: z.string(),
      name: z.string().nullable(),
      type: z.enum(['TEXT', 'BOXED_TEXT', 'CHECKBOX', 'PICTURE', 'SIGNATURE']),
      page: z.number().int(),
      value: z.string().nullable(),
    }),
  ),
})

export const GetDocumentContentInput = z
  .object({
    extraction_mode: z.enum(['auto', 'ocr']).default('auto'),
  })
  .describe('Returns extracted text per page. Use "ocr" for scanned documents, otherwise "auto"')
export const GetDocumentContentOutput = z.object({
  name: z.string(),
  pages: z.array(z.object({ page: z.number().int(), content: z.string() })),
})

export const SetFieldValueInput = z
  .object({
    field_id: z.string().describe('Field identifier from get_fields'),
    value: z.string().describe('Value to set. For CHECKBOX, use "true" / "false"'),
  })
  .describe('Writes a value into a single field in the PDF')
export const SetFieldValueOutput = z.object({ success: z.boolean() })

export const FocusFieldInput = z
  .object({ field_id: z.string().describe('Field identifier from get_fields') })
  .describe('Scrolls to and visually highlights a field so the user can see what will be filled next')
export const FocusFieldOutput = z.object({
  hint: z
    .object({
      type: z.literal('user_action_expected'),
      message: z.string(),
    })
    .nullable(),
})

export const GoToPageInput = z
  .object({ page: z.number().int().positive().describe('1-based page number') })
  .describe('Scrolls the editor to a given page')
export const GoToPageOutput = z.object({ success: z.boolean() })

export const SubmitDownloadInput = z
  .object({})
  .describe('Finalizes the filled PDF and triggers a download for the user')
export const SubmitDownloadOutput = z.object({ success: z.boolean() })

export type ClientToolName =
  | 'get_fields'
  | 'get_document_content'
  | 'set_field_value'
  | 'focus_field'
  | 'go_to_page'
  | 'submit_download'

export const CLIENT_TOOL_NAMES: ClientToolName[] = [
  'get_fields',
  'get_document_content',
  'set_field_value',
  'focus_field',
  'go_to_page',
  'submit_download',
]

export const isClientToolName = (value: unknown): value is ClientToolName =>
  typeof value === 'string' && (CLIENT_TOOL_NAMES as string[]).includes(value)

export const SYSTEM_PROMPT = `You are Form Copilot, a concise assistant that helps users fill a PDF form step by step inside the SimplePDF editor.

Ground rules:
- On your FIRST turn, call get_fields to inventory the fields, and call get_document_content (extraction_mode="auto") to understand the form. Do both in parallel.
- Guide the user one logical group of fields at a time. Before writing a value, briefly explain what the field is for.
- When you write a field, first call focus_field to show the user what you are about to fill, then call set_field_value.
- NEVER fabricate personal data (names, BSN, addresses, SSN, dates of birth, etc.). Always ask the user for it.
- For checkboxes, set value "true" to tick and "false" to un-tick.
- If the user asks to submit / finalize / download, call submit_download exactly once.
- Keep replies short. Bullet points when listing. Skip pleasantries.
- You can only operate on the currently loaded form; do not claim to have loaded other documents.
`
