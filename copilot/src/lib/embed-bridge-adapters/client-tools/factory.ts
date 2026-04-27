import type { BridgeResult, IframeBridge } from '../../embed-bridge'
import { dispatch, type ToolInput } from './dispatch'
import { composeMiddleware, type ToolMiddleware } from './middleware'
import { type ClientToolName, CLIENT_TOOL_SCHEMAS, isClientToolName } from './schemas'

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
  // Main entry: middleware stack + bridge dispatch. The caller is expected
  // to narrow toolName via `isClientToolName` BEFORE calling execute (the
  // Vercel AI SDK guarantees the LLM only fires registered tools, so the
  // narrow is a one-line type assertion at the consumer). Pushing the
  // narrow up means there is no redundant runtime check here, and the
  // dispatcher stays a pure router with `satisfies never` exhaustiveness.
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
  const composed = composeMiddleware(middleware, ({ toolName, input }) => dispatch(bridge, toolName, input))
  return {
    schemas: CLIENT_TOOL_SCHEMAS,
    systemPrompt,
    execute: (toolName, input) => composed({ toolName, input }),
    isClientToolName,
  }
}
