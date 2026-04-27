import type { BridgeResult, IframeBridge, SupportedFieldType } from '../../embed-bridge'
import type { ClientToolName } from './schemas'

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
// produced, route to the matching bridge method. The dispatcher does NO
// input validation — it is a pure router. The Zod tool schemas catch
// shape violations at the AI SDK boundary BEFORE this runs, and the
// iframe handler in `client/lib/iframe/handlers.ts` is the canonical
// runtime validator (it owns range rules + visiblePageCount). Layering
// a third validation step here would just duplicate one of those and
// drift over time.
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
    case 'delete_fields':
      return bridge.deleteFields({ fieldIds: input.field_ids, page: input.page })
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
    case 'set_field_value':
      return bridge.setFieldValue({ fieldId: input.field_id, value: input.value })
    case 'focus_field':
      return bridge.focusField({ fieldId: input.field_id })
    case 'go_to_page':
      return bridge.goTo({ page: input.page })
    case 'move_page':
      return bridge.movePage({ fromPage: input.from_page, toPage: input.to_page })
    case 'delete_pages':
      return bridge.deletePages({ pages: input.pages })
    case 'rotate_page':
      return bridge.rotatePage({ page: input.page })
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
