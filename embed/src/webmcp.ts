// Registers the editor operations as WebMCP tools on the HOST page's model context
// (`document.modelContext`; `navigator.modelContext` is the deprecated alias older
// runtimes expose) and executes each call over the bridge's wire dispatch, so the
// editor validates the agent's input exactly as it validates every other request.
// The host page is where an in-browser agent looks: tools registered inside the
// editor iframe are not discovered, which is why the SDK lifts them here.
//
// Loaded lazily by the bridge, once the editor is ready and only when `enableWebMCP`
// is set and the page exposes a model context, so nothing here (nor the schema table
// it reads) is downloaded otherwise.
// CF: https://webmachinelearning.github.io/webmcp/

import { OPERATIONS, type AgenticToolName, type WireType } from './generated/contract'
import { TOOL_INPUT_SCHEMAS, type ToolInputSchema } from './generated/tool-input-schemas'
import type { BridgeLogger } from './logger'
import type { BridgeResult } from './types'

// `true` registers every agentic operation; `exclude` withholds the listed ones
// (e.g. `submit` when only a person may finalize). `false` / omitted registers nothing.
export type WebMCPOptions = boolean | { exclude: readonly AgenticToolName[] }

// The slice of the WebMCP surface this module touches, typed structurally so the
// zero-dependency root pulls in no type package. `readOnlyHint` and
// `untrustedContentHint` are the specification's annotations; `destructiveHint` is
// MCP's, read by runtimes that carry MCP's hint vocabulary and ignored by the others.
type ToolAnnotations = { readOnlyHint?: boolean; untrustedContentHint?: boolean; destructiveHint?: boolean }
// The MCP tool-result envelope. The specification serializes whatever `execute`
// resolves with; this shape is what the runtimes in the field read (and what the
// editor's own in-page tools return), a failed Result additionally flagged `isError`.
type CallToolResult = { content: Array<{ type: 'text'; text: string }>; isError?: boolean }
type WebMCPTool = {
  name: string
  description: string
  inputSchema: ToolInputSchema
  annotations: ToolAnnotations
  execute: (input: unknown) => Promise<CallToolResult>
}
type ModelContext = {
  registerTool: (tool: WebMCPTool, options: { signal: AbortSignal }) => unknown
}

type Operation = (typeof OPERATIONS)[number]
type AgenticOperation = Extract<Operation, { is_agentic_tool: true }>

// The two readers return document-derived content (field values, extracted text),
// which is untrusted from the page's perspective. Every writer declares whether it
// removes or reorders content or finalizes the document; setting a field value is
// not destructive here because the person reviews every value in the editor before
// the one irreversible step, submit. The Record makes a new operation a compile
// error until it is annotated. Kept identical to the editor's in-page tool hints.
// CF: WEBMCP_TOOL_ANNOTATIONS in the editor's lib/iframe/handlers.ts (SimplePDF editor repository)
const TOOL_ANNOTATIONS = {
  createField: { destructiveHint: false },
  deleteFields: { destructiveHint: true },
  deletePages: { destructiveHint: true },
  detectFields: { destructiveHint: false },
  download: { destructiveHint: false },
  focusField: { destructiveHint: false },
  getDocumentContent: { readOnlyHint: true, untrustedContentHint: true },
  getFields: { readOnlyHint: true, untrustedContentHint: true },
  goTo: { destructiveHint: false },
  movePage: { destructiveHint: true },
  rotatePage: { destructiveHint: true },
  selectTool: { destructiveHint: false },
  setFieldValue: { destructiveHint: false },
  submit: { destructiveHint: true },
} satisfies Record<AgenticToolName, ToolAnnotations>

const isAgenticOperation = (operation: Operation): operation is AgenticOperation => operation.is_agentic_tool

const isModelContext = (value: unknown): value is ModelContext =>
  typeof value === 'object' && value !== null && 'registerTool' in value && typeof value.registerTool === 'function'

const readModelContext = (): ModelContext | null => {
  if ('modelContext' in document && isModelContext(document.modelContext)) {
    return document.modelContext
  }
  if ('modelContext' in navigator && isModelContext(navigator.modelContext)) {
    return navigator.modelContext
  }
  return null
}

const toCallToolResult = (result: BridgeResult<unknown>): CallToolResult => ({
  content: [{ type: 'text', text: JSON.stringify(result) }],
  ...(result.success ? {} : { isError: true }),
})

// A model context is a page-level singleton keyed by tool name, so two embeds on one
// page would collide; the first registration of a name wins and the rest are reported.
const liveToolNames = new Set<string>()

export const registerWebMCPTools = ({
  dispatch,
  options,
  signal,
  logger,
}: {
  dispatch: (wireType: WireType, data: unknown) => Promise<BridgeResult<unknown>>
  options: Exclude<WebMCPOptions, false>
  signal: AbortSignal
  logger: BridgeLogger
}): void => {
  if (signal.aborted) {
    return
  }
  const modelContext = readModelContext()
  if (modelContext === null) {
    logger.warn('webmcp.unavailable', { reason: 'invalid_model_context' })
    return
  }
  const excluded = new Set<AgenticToolName>(options === true ? [] : options.exclude)
  for (const operation of OPERATIONS) {
    if (!isAgenticOperation(operation) || excluded.has(operation.method)) {
      continue
    }
    if (liveToolNames.has(operation.method)) {
      logger.warn('webmcp.tool_already_registered', { tool: operation.method })
      continue
    }
    const tool: WebMCPTool = {
      name: operation.method,
      description: operation.description,
      inputSchema: TOOL_INPUT_SCHEMAS[operation.method],
      annotations: TOOL_ANNOTATIONS[operation.method],
      // A nullish input becomes an empty payload (the no-input operations' wire shape).
      execute: async (input) => toCallToolResult(await dispatch(operation.wire_type, input ?? {})),
    }
    liveToolNames.add(tool.name)
    signal.addEventListener('abort', () => liveToolNames.delete(tool.name), { once: true })
    // Registration is best-effort: a runtime that rejects one tool must not take the
    // others down or escape as an unhandled rejection.
    void (async (): Promise<void> => {
      try {
        await modelContext.registerTool(tool, { signal })
      } catch (error) {
        liveToolNames.delete(tool.name)
        logger.error('webmcp.register_tool_failed', {
          tool: tool.name,
          message: error instanceof Error ? error.message : String(error),
        })
      }
    })()
  }
}
