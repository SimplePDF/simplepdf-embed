// TanStack AI adapter. The same generated registry + bridge router as the Vercel
// `/ai-sdk` adapter, in TanStack's isomorphic tool shape: server-registerable
// definitions for `chat({ tools })`, and browser `.client()` tools bound to the live
// editor for `clientTools(...)` -> `useChat({ tools })`. The zod input schemas drop
// in directly (TanStack accepts any Standard Schema); `@tanstack/ai` is the only
// added peer, pulled solely by this subpath.

import { type AnyClientTool, toolDefinition } from '@tanstack/ai'
import { TOOL_DEFINITIONS, type SimplePDFToolName } from './generated/tools'
import { isSimplePDFToolName, routeToolCall } from './tools'
import type { Embed } from './types'

export type { SimplePDFToolName } from './generated/tools'

const TOOL_NAMES: readonly SimplePDFToolName[] = Object.keys(TOOL_DEFINITIONS).filter(isSimplePDFToolName)

// One shared definition per tool (name + description + zod input schema): the unit
// `chat({ tools })` registers and `.client()` / `.server()` instantiate from.
const define = (name: SimplePDFToolName) =>
  toolDefinition({
    name,
    description: TOOL_DEFINITIONS[name].description,
    inputSchema: TOOL_DEFINITIONS[name].inputSchema,
  })

// Server: execute-less definitions for `chat({ tools })`, so the model is aware of
// the tools. A fresh array each call so the host can pick/omit (e.g. gate submit XOR
// download) without mutating shared state.
export const simplePDFTanstackToolDefinitions = (): ReturnType<typeof define>[] => TOOL_NAMES.map(define)

// Browser: the same definitions bound to the live editor via `.client()`, for
// `clientTools(...)` -> `useChat({ tools })`. Each call validates input against the
// tool schema and dispatches to the matching editor action, resolving to a BridgeResult.
export const createSimplePDFTanstackTools = ({ embed }: { embed: Embed }): AnyClientTool[] =>
  TOOL_NAMES.map((name) => define(name).client((input) => routeToolCall(embed.actions, name, input)))
