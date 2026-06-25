// SDK-agnostic agentic tool surface: the generated registry (tool name ->
// { description, inputSchema }), a type guard, and a router that validates input
// against the tool schema and dispatches to the matching bridge method. No
// system prompt, no middleware (host-owned). zod is a peer dependency (used to
// validate agentic input before dispatch; the thin root bridge does not validate).

import type { z } from 'zod'
import { TOOL_DEFINITIONS, type SimplePDFToolName } from './generated/tools'
import {
  CreateFieldInput,
  DeleteFieldsInput,
  DeletePagesInput,
  DetectFieldsInput,
  DownloadInput,
  FocusFieldInput,
  GetDocumentContentInput,
  GetFieldsInput,
  GoToInput,
  MovePageInput,
  RotatePageInput,
  SelectToolInput,
  SetFieldValueInput,
  SubmitInput,
} from './generated/schemas'
import type { BridgeResult, Embed } from './types'

export { TOOL_DEFINITIONS as SIMPLEPDF_TOOLS } from './generated/tools'
export type { SimplePDFToolName } from './generated/tools'

const AGENTIC_TOOL_NAMES: ReadonlySet<string> = new Set(Object.keys(TOOL_DEFINITIONS))

export const isSimplePDFToolName = (value: unknown): value is SimplePDFToolName =>
  typeof value === 'string' && AGENTIC_TOOL_NAMES.has(value)

const dispatch = <TSchema extends z.ZodType>(
  schema: TSchema,
  input: unknown,
  call: (value: z.infer<TSchema>) => Promise<BridgeResult<unknown>>,
): Promise<BridgeResult<unknown>> => {
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return Promise.resolve({
      success: false,
      error: { code: 'bad_request:invalid_input', message: parsed.error.message },
    })
  }
  return call(parsed.data)
}

// Validate the agentic input against the tool schema, then call the matching
// bridge method. The switch is exhaustive over SimplePDFToolName: a new agentic
// operation forces a matching arm at compile time.
export const routeToolCall = (embed: Embed, toolName: SimplePDFToolName, input: unknown): Promise<BridgeResult<unknown>> => {
  switch (toolName) {
    case 'create_field':
      return dispatch(CreateFieldInput, input, (value) => embed.createField(value))
    case 'delete_fields':
      return dispatch(DeleteFieldsInput, input, (value) => embed.deleteFields(value))
    case 'delete_pages':
      return dispatch(DeletePagesInput, input, (value) => embed.deletePages(value))
    // No-input + all-optional tools coerce a missing input to {} (the AI SDK
    // sends {} for them); required-input tools below keep `input` so a missing
    // payload fails validation.
    case 'detect_fields':
      return dispatch(DetectFieldsInput, input ?? {}, () => embed.detectFields())
    case 'download':
      return dispatch(DownloadInput, input ?? {}, () => embed.download())
    case 'focus_field':
      return dispatch(FocusFieldInput, input, (value) => embed.focusField(value))
    case 'get_document_content':
      return dispatch(GetDocumentContentInput, input ?? {}, (value) => embed.getDocumentContent(value))
    case 'get_fields':
      return dispatch(GetFieldsInput, input ?? {}, () => embed.getFields())
    case 'go_to':
      return dispatch(GoToInput, input, (value) => embed.goTo(value))
    case 'move_page':
      return dispatch(MovePageInput, input, (value) => embed.movePage(value))
    case 'rotate_page':
      return dispatch(RotatePageInput, input, (value) => embed.rotatePage(value))
    case 'select_tool':
      return dispatch(SelectToolInput, input, (value) => embed.selectTool(value))
    case 'set_field_value':
      return dispatch(SetFieldValueInput, input, (value) => embed.setFieldValue(value))
    case 'submit':
      return dispatch(SubmitInput, input, (value) => embed.submit(value))
    default:
      toolName satisfies never
      return Promise.resolve({
        success: false,
        error: { code: 'bad_request:invalid_input', message: `Unknown tool: ${String(toolName)}` },
      })
  }
}
