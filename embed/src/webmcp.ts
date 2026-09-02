// Registers the editor operations as WebMCP tools on the HOST page's model context
// (`document.modelContext`; `navigator.modelContext` is the deprecated alias older
// runtimes expose) and executes each call over the bridge's wire dispatch, so the
// editor validates the agent's input exactly as it validates every other request.
// The host page is where an in-browser agent looks: tools registered inside the
// editor iframe are not discovered, which is why the SDK lifts them here.
//
// Loaded lazily by the bridge only when `enableWebMCP` is set, so an embedder that
// does not opt in downloads none of this (nor the operations table it reads).
// CF: https://webmachinelearning.github.io/webmcp/

import { OPERATIONS, type AgenticToolName, type WireType } from './generated/contract'
import type { BridgeLogger } from './logger'
import type { BridgeResult } from './types'

// `true` registers every agentic operation; `exclude` withholds the listed ones
// (e.g. `submit` when only a person may finalize). `false` / omitted registers nothing.
export type WebMCPOptions = boolean | { exclude: readonly AgenticToolName[] }

// The slice of the WebMCP surface this module touches, typed structurally so the
// zero-dependency root pulls in no type package.
type ToolAnnotations = { readOnlyHint?: boolean; destructiveHint?: boolean }
type CallToolResult = { content: Array<{ type: 'text'; text: string }>; isError?: boolean }
type ToolInputSchema = {
  readonly type: 'object'
  readonly properties?: Readonly<Record<string, unknown>>
  readonly required?: readonly string[]
}
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

// MCP planners treat an unset destructiveHint as true, so every operation declares
// one: true for the ones that remove or reorder content or finalize the document;
// readOnlyHint marks the pure readers. The Record makes a new operation a compile
// error until it is annotated.
const TOOL_ANNOTATIONS = {
  createField: { destructiveHint: false },
  deleteFields: { destructiveHint: true },
  deletePages: { destructiveHint: true },
  detectFields: { destructiveHint: false },
  download: { destructiveHint: false },
  focusField: { destructiveHint: false },
  getDocumentContent: { readOnlyHint: true },
  getFields: { readOnlyHint: true },
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

// The editor Result, serialized as the JSON-text CallToolResult an agent reads; a
// failed Result is additionally flagged `isError` (the MCP convention).
const toCallToolResult = (result: BridgeResult<unknown>): CallToolResult => ({
  content: [{ type: 'text', text: JSON.stringify(result) }],
  ...(result.success ? {} : { isError: true }),
})

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
  const modelContext = readModelContext()
  if (modelContext === null || signal.aborted) {
    return
  }
  const excluded = new Set<AgenticToolName>(options === true ? [] : options.exclude)
  for (const operation of OPERATIONS) {
    if (!isAgenticOperation(operation) || excluded.has(operation.method)) {
      continue
    }
    const tool: WebMCPTool = {
      name: operation.method,
      description: operation.description,
      inputSchema: operation.input_schema,
      annotations: TOOL_ANNOTATIONS[operation.method],
      // A no-input tool may be called without arguments; the wire always carries an object.
      execute: async (input) => toCallToolResult(await dispatch(operation.wire_type, input ?? {})),
    }
    // Registration is best-effort: a runtime that rejects one tool must not take the
    // others down or escape as an unhandled rejection.
    void (async (): Promise<void> => {
      try {
        await modelContext.registerTool(tool, { signal })
      } catch (error) {
        logger.error('webmcp.register_tool_failed', {
          tool: tool.name,
          message: error instanceof Error ? error.message : String(error),
        })
      }
    })()
  }
}
