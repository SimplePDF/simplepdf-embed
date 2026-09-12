// Registers the editor operations as WebMCP tools on the HOST page's model context
// and executes each call over the bridge's wire dispatch, so the
// editor validates the agent's input exactly as it validates every other request.
// The host page is where an in-browser agent looks: tools registered inside the
// editor iframe are not discovered, which is why the SDK lifts them here. Each tool
// is the manifest's record, the one the editor registers on its own page: same name,
// description, snake_case input schema and hints, and the same wire-shaped Result.
//
// Loaded lazily by the bridge, once the editor is ready and only when `webMCP` is
// enabled and the page exposes a model context, so nothing here (nor the record
// table it reads) is downloaded otherwise.
// CF: https://webmachinelearning.github.io/webmcp/

import type { MethodName, WireType } from './generated/contract'
import { METHOD_NAMES } from './generated/method-names'
import { WEBMCP_TOOLS, type WebMCPToolRecord } from './generated/webmcp-tools'
import type { BridgeLogger } from './logger'
import type { BridgeResult } from './types'
import { modelContextCandidates } from './webmcp-shared'

// The MCP tool-result envelope. The specification serializes whatever `execute`
// resolves with as JSON text; this shape is what runtimes that map results onto MCP's
// CallToolResult read (and what the editor's own in-page tools return): a failed
// Result additionally flagged `isError`, a page render carried as an `image` block.
type ToolContent = { type: 'text'; text: string } | { type: 'image'; data: string; mimeType: 'image/png' }
type CallToolResult = { content: ToolContent[]; isError?: boolean }
type WebMCPTool = Omit<WebMCPToolRecord, 'wireType'> & { execute: (input: unknown) => Promise<CallToolResult> }
type ModelContext = {
  registerTool: (tool: WebMCPTool, options: { signal: AbortSignal }) => unknown
}

const PNG_DATA_URL_PREFIX = 'data:image/png;base64,'

const isModelContext = (value: unknown): value is ModelContext =>
  typeof value === 'object' && value !== null && 'registerTool' in value && typeof value.registerTool === 'function'

const readModelContext = (): ModelContext | null => modelContextCandidates().find(isModelContext) ?? null

const toTextToolResult = (result: BridgeResult<unknown>): CallToolResult => ({
  content: [{ type: 'text', text: JSON.stringify(result) }],
  ...(result.success ? {} : { isError: true }),
})

// The render travels once, as the image block a vision-capable runtime shows the
// model; the text block keeps the rest of the result (page, size, badges). Anything
// but a successful PNG render takes the plain text envelope.
const toAnnotatedPageToolResult = (result: BridgeResult<unknown>): CallToolResult => {
  if (!result.success) {
    return toTextToolResult(result)
  }
  const render: unknown = result.data
  if (typeof render !== 'object' || render === null || !('image_data_url' in render)) {
    return toTextToolResult(result)
  }
  const { image_data_url: imageDataUrl, ...renderWithoutImage } = render
  if (typeof imageDataUrl !== 'string' || !imageDataUrl.startsWith(PNG_DATA_URL_PREFIX)) {
    return toTextToolResult(result)
  }
  return {
    content: [
      { type: 'image', data: imageDataUrl.slice(PNG_DATA_URL_PREFIX.length), mimeType: 'image/png' },
      { type: 'text', text: JSON.stringify({ success: true, data: renderWithoutImage }) },
    ],
  }
}

const toCallToolResult = (wireType: WireType, result: BridgeResult<unknown>): CallToolResult =>
  wireType === 'GET_ANNOTATED_PAGE' ? toAnnotatedPageToolResult(result) : toTextToolResult(result)

// A model context is a page-level singleton keyed by tool name, so two embeds on one
// page would collide; the first registration of a name wins and the rest are reported.
// Each name records the signal that owns it, so only its owner ever frees it.
const liveTools = new Map<string, AbortSignal>()

const freeTool = (name: string, owner: AbortSignal): void => {
  if (liveTools.get(name) === owner) {
    liveTools.delete(name)
  }
}

// Returns whether a usable model context was found (and the tools handed to it), so
// the bridge can keep probing on later lifecycle transitions when it was not.
export const registerWebMCPTools = ({
  dispatch,
  exclude,
  signal,
  logger,
}: {
  // Resolves with the editor's wire-shaped Result (snake_case, what the record's
  // description promises), not the SDK's camelCased one.
  dispatch: (wireType: WireType, data: unknown) => Promise<BridgeResult<unknown>>
  exclude: readonly MethodName[]
  signal: AbortSignal
  logger: BridgeLogger
}): boolean => {
  if (signal.aborted) {
    return false
  }
  const modelContext = readModelContext()
  if (modelContext === null) {
    logger.info('webmcp.unavailable', { reason: 'invalid_model_context' })
    return false
  }
  const excluded = new Set<MethodName>(exclude)
  for (const method of METHOD_NAMES) {
    if (excluded.has(method)) {
      continue
    }
    const record = WEBMCP_TOOLS[method]
    if (liveTools.has(record.name)) {
      logger.warn('webmcp.tool_already_registered', { tool: record.name })
      continue
    }
    const tool: WebMCPTool = {
      name: record.name,
      description: record.description,
      inputSchema: record.inputSchema,
      annotations: record.annotations,
      // A nullish input becomes an empty payload (the no-input operations' wire shape).
      execute: async (input) => toCallToolResult(record.wireType, await dispatch(record.wireType, input ?? {})),
    }
    liveTools.set(tool.name, signal)
    signal.addEventListener('abort', () => freeTool(tool.name, signal), { once: true })
    // Registration is best-effort: a runtime that rejects one tool must not take the
    // others down or escape as an unhandled rejection.
    void (async (): Promise<void> => {
      try {
        await modelContext.registerTool(tool, { signal })
      } catch (error) {
        freeTool(tool.name, signal)
        logger.error('webmcp.register_tool_failed', {
          tool: tool.name,
          message: error instanceof Error ? error.message : String(error),
        })
      }
    })()
  }
  return true
}
