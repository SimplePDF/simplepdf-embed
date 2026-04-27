import {
  type BridgeResult,
  DeleteFieldsInput,
  DeletePagesInput,
  FocusFieldInput,
  GetDocumentContentInput,
  GoToInput,
  type IframeBridge,
  MovePageInput,
  RotatePageInput,
  SelectToolInput,
  SetFieldValueInput,
} from '../../embed-bridge'
import { composeMiddleware, type ToolMiddleware } from './middleware'
import { type ClientToolName, isClientToolName } from './schemas'

export type ToolInput = Record<string, unknown>

export type CreateClientToolsArgs = {
  // The iframe bridge the dispatcher will drive. Usually comes from the React
  // adapter's useIframeBridge hook or from the raw createBridge() for
  // framework-agnostic callers.
  bridge: IframeBridge
  // System prompt the host app uses with its LLM. The client-tools adapter
  // holds the reference and re-exports it so the consumer can plumb the same
  // string into streamText / chat.completions / etc. without maintaining a
  // separate copy.
  systemPrompt: string
  // Optional middleware stack; executed left-to-right, first layer is the
  // outermost. Use this to add compaction, prompt-injection envelopes,
  // logging, etc. without forking the package.
  middleware?: readonly ToolMiddleware[]
}

export type ClientTools = {
  // System prompt passed into createClientTools, re-exported verbatim for
  // the consumer to pass to their LLM.
  systemPrompt: string
  // Main entry. The caller narrows toolName via `isClientToolName` once at
  // the consumer boundary; the Vercel AI SDK guarantees the LLM only fires
  // registered tools.
  execute: (toolName: ClientToolName, input: ToolInput) => Promise<BridgeResult<unknown>>
  // Type guard re-export so the consumer can branch on tool names without
  // importing `schemas.ts` separately.
  isClientToolName: typeof isClientToolName
}

export const createClientTools = ({
  bridge,
  systemPrompt,
  middleware = [],
}: CreateClientToolsArgs): ClientTools => {
  // One arm per tool. Each arm parses the LLM-supplied input via the
  // bridge schema (single source of truth, lives in
  // embed-bridge/schemas.ts) and forwards the typed payload to the matching
  // bridge method. `satisfies never` keeps the switch exhaustive over
  // ClientToolName at compile time.
  const composed = composeMiddleware(middleware, async ({ toolName, input }) => {
    switch (toolName) {
      case 'get_fields':
        return bridge.getFields()
      case 'get_document_content':
        return bridge.getDocumentContent(GetDocumentContentInput.parse(input))
      case 'detect_fields':
        return bridge.detectFields()
      case 'delete_fields':
        return bridge.deleteFields(DeleteFieldsInput.parse(input))
      case 'select_tool':
        return bridge.selectTool(SelectToolInput.parse(input))
      case 'set_field_value':
        return bridge.setFieldValue(SetFieldValueInput.parse(input))
      case 'focus_field':
        return bridge.focusField(FocusFieldInput.parse(input))
      case 'go_to_page':
        return bridge.goTo(GoToInput.parse(input))
      case 'move_page':
        return bridge.movePage(MovePageInput.parse(input))
      case 'delete_pages':
        return bridge.deletePages(DeletePagesInput.parse(input))
      case 'rotate_page':
        return bridge.rotatePage(RotatePageInput.parse(input))
      case 'submit':
        return bridge.submit({ download_copy: false })
      case 'download':
        return bridge.download()
      default:
        toolName satisfies never
        return {
          success: false,
          error: { code: 'unknown_tool', message: `Unknown tool: ${String(toolName)}` },
        }
    }
  })
  return {
    systemPrompt,
    execute: (toolName, input) => composed({ toolName, input }),
    isClientToolName,
  }
}
