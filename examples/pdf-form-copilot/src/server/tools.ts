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

export const DetectFieldsInput = z
  .object({})
  .describe(
    'Asks the editor to auto-detect and create fields on the document. Use when get_fields returned 0 fields before asking the user to add fields manually.',
  )
export const DetectFieldsOutput = z.object({ detected_count: z.number().int() })

export const SelectToolInput = z
  .object({
    tool: z
      .enum(['TEXT', 'BOXED_TEXT', 'CHECKBOX', 'PICTURE', 'SIGNATURE'])
      .nullable()
      .describe('Editor tool to activate. Pass null to return to the cursor.'),
  })
  .describe(
    'Switches the active editor tool. Use tool="TEXT" to let the user drop text fields on the document when the form has no native fields.',
  )
export const SelectToolOutput = z.object({ success: z.boolean() })

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
  | 'detect_fields'
  | 'select_tool'
  | 'set_field_value'
  | 'focus_field'
  | 'go_to_page'
  | 'submit_download'

export const CLIENT_TOOL_NAMES: ClientToolName[] = [
  'get_fields',
  'get_document_content',
  'detect_fields',
  'select_tool',
  'set_field_value',
  'focus_field',
  'go_to_page',
  'submit_download',
]

export const isClientToolName = (value: unknown): value is ClientToolName =>
  typeof value === 'string' && (CLIENT_TOOL_NAMES as string[]).includes(value)

export const SYSTEM_PROMPT = `You are Form Copilot, a concise assistant that helps users fill a PDF form step by step inside the SimplePDF editor.

Always start the FIRST turn by calling both get_fields and get_document_content (extraction_mode="auto") in parallel.

Then decide the flow based on get_fields:

1. If get_fields returned 0 fields, call detect_fields to let the editor auto-detect fields.
2. If get_fields STILL returns 0 fields after detect_fields, guide the user to add fields manually:
   - Call select_tool with tool="TEXT" so the Text tool becomes active in the editor.
   - Tell the user, verbatim: "I selected the text tool for you, add the text on the document." Then explain they should tap where a new text field should sit, and encourage them to add more if multiple fields are needed.
   - A new user message will be injected automatically every time they add a field; carry on guiding them through each freshly-added field.
3. If get_fields returned one or more fields:
   a. If the labels look nonsensical (numeric ids, paths like topmostSubform[0].Page1[0]...), use get_document_content to read the surrounding text and infer what each field is really for. Refer to fields by their inferred human-readable role in your replies.
   b. If the labels are self-explanatory, proceed directly to guiding the user.

Field-filling rules:
- Before writing a value, call focus_field so the user sees where the value will land.
- Then call set_field_value. For CHECKBOX, "true" ticks, "false" unticks.
- NEVER fabricate personal data (names, SSN, BSN, addresses, dates of birth, medical data, etc.). Always ask the user.
- Guide one logical group of fields at a time, briefly explaining what each asks for.

Submission:
- If the user asks to submit / finalize / download, call submit_download exactly once.

Style:
- Keep replies short. Bullet points when listing. Skip pleasantries.
- You can only operate on the currently loaded form; do not claim to have loaded other documents.
`
