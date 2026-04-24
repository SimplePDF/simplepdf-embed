import type { BridgeResult, IframeBridge, SupportedFieldType } from '../../embed-bridge'
import { type ClientToolName, isClientToolName } from './schemas'

export type ToolInput = Record<string, unknown>

const isSupportedFieldType = (value: unknown): value is SupportedFieldType =>
  value === 'TEXT' ||
  value === 'BOXED_TEXT' ||
  value === 'CHECKBOX' ||
  value === 'PICTURE' ||
  value === 'SIGNATURE'

const isSelectableTool = (value: unknown): value is SupportedFieldType | null =>
  value === null || isSupportedFieldType(value)

// Core dispatcher. Given a tool name and the raw input object the LLM
// produced, route to the matching bridge method. Input-shape violations
// surface as typed `bad_input` BridgeResult failures; the dispatcher never
// throws.
export const dispatch = async (
  bridge: IframeBridge,
  toolName: ClientToolName,
  input: ToolInput,
): Promise<BridgeResult<unknown>> => {
  switch (toolName) {
    case 'get_fields':
      return bridge.getFields()
    case 'get_document_content': {
      const extractionMode: 'auto' | 'ocr' = input.extraction_mode === 'ocr' ? 'ocr' : 'auto'
      return bridge.getDocumentContent({ extractionMode })
    }
    case 'detect_fields':
      return bridge.detectFields()
    case 'select_tool': {
      const rawTool = input.tool
      if (rawTool !== undefined && !isSelectableTool(rawTool)) {
        return {
          success: false,
          error: { code: 'bad_input', message: `Unsupported tool: ${String(rawTool)}` },
        }
      }
      const tool: SupportedFieldType | null = rawTool ?? null
      return bridge.selectTool({ tool })
    }
    case 'set_field_value': {
      const fieldId = typeof input.field_id === 'string' ? input.field_id : null
      const value = typeof input.value === 'string' ? input.value : null
      if (fieldId === null) {
        return {
          success: false,
          error: { code: 'bad_input', message: 'field_id is required' },
        }
      }
      return bridge.setFieldValue({ fieldId, value })
    }
    case 'focus_field': {
      const fieldId = typeof input.field_id === 'string' ? input.field_id : null
      if (fieldId === null) {
        return {
          success: false,
          error: { code: 'bad_input', message: 'field_id is required' },
        }
      }
      return bridge.focusField({ fieldId })
    }
    case 'go_to_page': {
      const page = typeof input.page === 'number' ? input.page : null
      if (page === null) {
        return {
          success: false,
          error: { code: 'bad_input', message: 'page must be a number' },
        }
      }
      return bridge.goTo({ page })
    }
    case 'submit_download':
      return bridge.submit({ downloadCopy: true })
    default:
      toolName satisfies never
      return {
        success: false,
        error: { code: 'unknown_tool', message: `Unknown tool: ${String(toolName)}` },
      }
  }
}

// Optional safety wrapper around `dispatch` that accepts an arbitrary tool
// name (e.g. coming from an LLM tool call where the type isn't narrowed yet)
// and rejects unknown names with a typed error.
export const safeDispatch = async (
  bridge: IframeBridge,
  toolName: string,
  input: ToolInput,
): Promise<BridgeResult<unknown>> => {
  if (!isClientToolName(toolName)) {
    return {
      success: false,
      error: { code: 'unknown_tool', message: `Unknown tool: ${toolName}` },
    }
  }
  return dispatch(bridge, toolName, input)
}
