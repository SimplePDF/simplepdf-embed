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
import type { BridgeResult, IframeActions } from './types'

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
// editor action. The switch is exhaustive over SimplePDFToolName: a new agentic
// operation forces a matching arm at compile time. Takes the actions group (not the
// whole Embed) so any actions-shaped handle works (e.g. the React flat ref).
export const routeToolCall = (
  actions: IframeActions,
  toolName: SimplePDFToolName,
  input: unknown,
): Promise<BridgeResult<unknown>> => {
  switch (toolName) {
    case 'createField':
      return dispatch(CreateFieldInput, input, (value) => actions.createField(value))
    case 'deleteFields':
      // All-optional: coerce a missing payload to {} (delete every field) like the
      // other no-required-input tools, so the model can omit it.
      return dispatch(DeleteFieldsInput, input ?? {}, (value) => actions.deleteFields(value))
    case 'deletePages':
      return dispatch(DeletePagesInput, input, (value) => actions.deletePages(value))
    // No-input + all-optional tools coerce a missing input to {} (the AI SDK
    // sends {} for them); required-input tools below keep `input` so a missing
    // payload fails validation.
    case 'detectFields':
      return dispatch(DetectFieldsInput, input ?? {}, () => actions.detectFields())
    case 'download':
      return dispatch(DownloadInput, input ?? {}, () => actions.download())
    case 'focusField':
      return dispatch(FocusFieldInput, input, (value) => actions.focusField(value))
    case 'getDocumentContent':
      return dispatch(GetDocumentContentInput, input ?? {}, (value) => actions.getDocumentContent(value))
    case 'getFields':
      return dispatch(GetFieldsInput, input ?? {}, () => actions.getFields())
    case 'goTo':
      return dispatch(GoToInput, input, (value) => actions.goTo(value))
    case 'movePage':
      return dispatch(MovePageInput, input, (value) => actions.movePage(value))
    case 'rotatePage':
      return dispatch(RotatePageInput, input, (value) => actions.rotatePage(value))
    case 'selectTool':
      return dispatch(SelectToolInput, input, (value) => actions.selectTool(value))
    case 'setFieldValue':
      return dispatch(SetFieldValueInput, input, (value) => actions.setFieldValue(value))
    case 'submit':
      return dispatch(SubmitInput, input, (value) => actions.submit(value))
    default:
      toolName satisfies never
      return Promise.resolve({
        success: false,
        error: { code: 'bad_request:invalid_input', message: `Unknown tool: ${String(toolName)}` },
      })
  }
}
