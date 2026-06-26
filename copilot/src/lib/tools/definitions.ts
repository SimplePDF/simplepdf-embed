import { simplePDFToolDefinitions, type SimplePDFToolName } from '@simplepdf/react-embed-pdf/ai-sdk'
import type { FinalisationAction } from '../../server/tools'
import { IS_DEMO_MODE } from '../mode'

// The finalisation tool name + verb depend on deployment mode. The demo
// (companyIdentifier === 'copilot') exposes only `download`; a SimplePDF
// customer fork exposes only `submit` and routes through the SUBMIT iframe
// event. The system prompt is parameterised so the LLM gets the exact tool name
// in scope.
export const FINALISATION_ACTION: FinalisationAction = IS_DEMO_MODE
  ? { toolName: 'download', verb: 'download' }
  : { toolName: 'submit', verb: 'submit' }

type SimplePDFToolDefinitions = ReturnType<typeof simplePDFToolDefinitions>
type ToolDefinition = SimplePDFToolDefinitions[keyof SimplePDFToolDefinitions]

// Copilot's LLM tool set: the agentic tools from @simplepdf/embed minus
// createField (copilot never asks the model to create fields), with the
// mode-appropriate finalisation tool (submit XOR download). Returned as the
// plain { name: { description, inputSchema } } record streamText consumes.
export const buildCopilotToolDefinitions = (): Record<string, ToolDefinition> => {
  const all = simplePDFToolDefinitions()
  const isExposed = (name: string): boolean => {
    if (name === 'createField') {
      return false
    }
    if (name === 'submit') {
      return FINALISATION_ACTION.toolName === 'submit'
    }
    if (name === 'download') {
      return FINALISATION_ACTION.toolName === 'download'
    }
    return true
  }
  return Object.fromEntries(Object.entries(all).filter(([name]) => isExposed(name)))
}

// The exact set of tool names copilot exposes to the model — the executable
// allowlist. The browser-side executor is gated on this (defense in depth: the
// model only ever sees this set in its server tool definitions, but the executor
// must not run anything outside it either, e.g. createField or the inactive
// finalisation tool).
const COPILOT_TOOL_NAMES: ReadonlySet<string> = new Set(Object.keys(buildCopilotToolDefinitions()))

export const isCopilotToolName = (value: unknown): value is SimplePDFToolName =>
  typeof value === 'string' && COPILOT_TOOL_NAMES.has(value)
