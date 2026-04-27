import { z } from 'zod'

// Zod schemas for every iframe operation. The bridge OWNS the contract:
// shape AND description. Adapters (LLM tool calls, React SDK, etc.)
// consume these schemas verbatim — they don't redefine descriptions or
// shapes. Adding a new iframe operation = add a schema here, add the
// matching method to IframeBridge, add the bridge.ts implementation,
// register the LLM tool name in client-tools/schemas.ts.
//
// One file, one schema per operation. The shape is the snake_case payload
// that travels over postMessage; nothing converts keys between layers.

export const SupportedFieldTypeSchema = z.enum(['TEXT', 'BOXED_TEXT', 'CHECKBOX', 'PICTURE', 'SIGNATURE'])

export const NoInput = z.object({})

export const GetFieldsInput = NoInput.describe('Lists every fillable field currently on the document')

export const GetDocumentContentInput = z
  .object({
    extraction_mode: z.enum(['auto', 'ocr']).default('auto'),
  })
  .describe('Returns extracted text per page. Use "ocr" for scanned documents, otherwise "auto"')

export const DetectFieldsInput = NoInput.describe(
  'Asks the editor to auto-detect and create fields on the document. Use when get_fields returned 0 fields before asking the user to add fields manually.',
)

export const DeleteFieldsInput = z
  .object({
    field_ids: z.array(z.string()).optional().describe('Specific field identifiers to delete (omit to target by page or all)'),
    page: z.number().int().positive().optional().describe('1-indexed visible page to clear (omit to target specific ids or all)'),
  })
  .describe(
    'Deletes fields from the document. Pass field_ids to delete specific fields, page to clear a single page, or both omitted to delete every field. Destructive: only call when the user explicitly asks.',
  )

export const SelectToolInput = z
  .object({
    tool: SupportedFieldTypeSchema.nullable().describe('Editor tool to activate. Pass null to return to the cursor.'),
  })
  .describe(
    'Switches the active editor tool. Use tool="TEXT" for free-form text, "BOXED_TEXT" for box-per-character fields (e.g. IBAN), or any of the other field types to let the user drop fields on a document without native AcroFields.',
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

export const GoToInput = z
  .object({ page: z.number().int().positive().describe('1-based page number') })
  .describe('Scrolls the editor to a given page')

export const MovePageInput = z
  .object({
    from_page: z.number().int().positive().describe('Visible page to move (1-indexed)'),
    to_page: z.number().int().positive().describe('Target visible position (1-indexed)'),
  })
  .describe(
    'Reorders pages in the document. Destructive: only call when the user explicitly asks to reorder a page.',
  )

export const DeletePagesInput = z
  .object({
    pages: z
      .array(z.number().int().positive())
      .nonempty()
      .describe('Visible pages to delete (1-indexed). Must be a non-empty array.'),
  })
  .describe(
    'Permanently removes one or more pages (and any fields on them) from the document. Destructive: only call when the user explicitly asks to delete pages. At least one visible page must remain — passing every visible page returns event_not_allowed.',
  )

export const RotatePageInput = z
  .object({ page: z.number().int().positive().describe('Visible page to rotate (1-indexed)') })
  .describe(
    'Rotates a page 90° clockwise. Destructive: only call when the user explicitly asks to rotate a page. Repeat to reach 180° / 270°.',
  )

export const SubmitInput = z
  .object({ download_copy: z.boolean() })
  .describe(
    'Finalizes the filled PDF and submits it to the host application (storage, webhook, etc.). Use only when the user asks to submit or finalize.',
  )

export const DownloadInput = NoInput.describe(
  'Finalizes the filled PDF and triggers an in-browser download for the user. Use only when the user asks to download.',
)

export const LoadDocumentInput = z
  .object({
    data_url: z.string(),
    name: z.string().optional(),
    page: z.number().int().positive().optional(),
  })
  .describe('Loads a PDF document into the editor by URL or data-URL.')
