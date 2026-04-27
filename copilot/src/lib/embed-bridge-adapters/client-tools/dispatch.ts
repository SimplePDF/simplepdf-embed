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
    case 'delete_fields': {
      const rawIds = input.field_ids
      const fieldIds = ((): string[] | null | 'invalid' => {
        if (rawIds === undefined || rawIds === null) {
          return null
        }
        if (Array.isArray(rawIds) && rawIds.every((id): id is string => typeof id === 'string')) {
          return rawIds
        }
        return 'invalid'
      })()
      if (fieldIds === 'invalid') {
        return {
          success: false,
          error: { code: 'bad_input', message: 'field_ids must be an array of strings' },
        }
      }
      const page = typeof input.page === 'number' ? input.page : null
      return bridge.deleteFields({ fieldIds, page })
    }
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
    case 'move_page': {
      const fromPage = typeof input.from_page === 'number' ? input.from_page : null
      const toPage = typeof input.to_page === 'number' ? input.to_page : null
      if (fromPage === null || toPage === null) {
        return {
          success: false,
          error: { code: 'bad_input', message: 'from_page and to_page must be numbers' },
        }
      }
      return bridge.movePage({ fromPage, toPage })
    }
    case 'delete_pages': {
      const rawPages = input.pages
      if (
        !Array.isArray(rawPages) ||
        rawPages.length === 0 ||
        !rawPages.every((page): page is number => typeof page === 'number' && Number.isInteger(page) && page > 0)
      ) {
        return {
          success: false,
          error: { code: 'bad_input', message: 'pages must be a non-empty array of positive integers' },
        }
      }
      return bridge.deletePages({ pages: rawPages })
    }
    case 'rotate_page': {
      const page = typeof input.page === 'number' ? input.page : null
      if (page === null) {
        return {
          success: false,
          error: { code: 'bad_input', message: 'page must be a number' },
        }
      }
      return bridge.rotatePage({ page })
    }
    case 'submit':
      return bridge.submit({ downloadCopy: false })
    case 'download':
      return bridge.download()
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
