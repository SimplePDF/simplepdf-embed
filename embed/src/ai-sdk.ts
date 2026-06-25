// Vercel AI SDK adapter. A thin layer over the same bridge methods + generated
// registry: server-side execute-less tool definitions, and a browser-side
// bridge-bound executor. No system prompt, no middleware (host-owned).
//
// The definitions are plain { description, inputSchema } objects (the shape
// streamText({ tools }) and the model SDKs consume directly) rather than the
// `ai` `tool()` helper, so the adapter is fully decoupled from the SDK — the
// package never imports `ai`. The consumer brings their own `ai` install and
// passes these shapes to streamText / useChat.

import { TOOL_DEFINITIONS } from './generated/tools'
import { isSimplePDFToolName, routeToolCall } from './tools'
import type { BridgeResult, Embed } from './types'

export type { SimplePDFToolName } from './generated/tools'

// Server-side: execute-less tool definitions for streamText({ tools }). The model
// generates the calls; the browser executes them via createSimplePDFExecutor.
// Returns a FRESH record each call so the host can safely pick/omit tools (e.g.
// mode-gate submit XOR download) without mutating the shared registry.
export const simplePDFToolDefinitions = (): typeof TOOL_DEFINITIONS => ({ ...TOOL_DEFINITIONS })

// Browser-side: a bridge-bound dispatcher for useChat({ onToolCall }). Validates
// the tool name + input and routes to the bridge, returning a typed BridgeResult.
export const createSimplePDFExecutor = ({
  embed,
}: {
  embed: Embed
}): ((toolName: string, input: unknown) => Promise<BridgeResult<unknown>>) => {
  return (toolName, input) => {
    if (!isSimplePDFToolName(toolName)) {
      return Promise.resolve({
        success: false,
        error: { code: 'bad_request:invalid_input', message: `Unknown tool: ${toolName}` },
      })
    }
    return routeToolCall(embed, toolName, input)
  }
}
