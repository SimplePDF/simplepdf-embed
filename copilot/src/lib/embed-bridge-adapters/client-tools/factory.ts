import type { BridgeResult, IframeBridge } from '../../embed-bridge'
import { dispatch, type ToolInput } from './dispatch'
import { composeMiddleware, type ToolMiddleware } from './middleware'
import { CLIENT_TOOL_SCHEMAS, isClientToolName } from './schemas'

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
  // Zod input schemas keyed by tool name. Spread into streamText({ tools })
  // alongside descriptions.
  schemas: typeof CLIENT_TOOL_SCHEMAS
  // System prompt passed into createClientTools, re-exported verbatim for
  // the consumer to pass to their LLM.
  systemPrompt: string
  // Main entry: given a raw tool name + input (e.g. from an LLM tool call),
  // run the middleware stack and dispatch to the bridge. Tool names that
  // aren't in the registry come back as `unknown_tool`. In practice the
  // Vercel AI SDK validates tool calls against the registered tool list
  // before this fires, so the unknown branch is defensive only.
  execute: (toolName: string, input: ToolInput) => Promise<BridgeResult<unknown>>
  // Type guard re-export so the consumer can branch on tool names without
  // importing `schemas.ts` separately.
  isClientToolName: typeof isClientToolName
}

export const createClientTools = ({
  bridge,
  systemPrompt,
  middleware = [],
}: CreateClientToolsArgs): ClientTools => {
  const composed = composeMiddleware(middleware, async ({ toolName, input }) => {
    if (!isClientToolName(toolName)) {
      return {
        success: false,
        error: { code: 'unknown_tool', message: `Unknown tool: ${toolName}` },
      }
    }
    return dispatch(bridge, toolName, input)
  })
  return {
    schemas: CLIENT_TOOL_SCHEMAS,
    systemPrompt,
    execute: (toolName, input) => composed({ toolName, input }),
    isClientToolName,
  }
}
