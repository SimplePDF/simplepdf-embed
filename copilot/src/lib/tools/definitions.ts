import { type SimplePDFToolName, simplePDFToolDefinitions } from '@simplepdf/embed/ai-sdk'
import type { FinalisationAction } from '../../server/tools'
import { IS_DEMO_MODE } from '../mode'
import type { ToolInput } from './middleware'

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

// Copilot's LLM tool set, opted into one by one so an SDK bump never hands the
// model a tool copilot has not reviewed. Left out: createField (copilot never asks
// the model to create fields) and getAnnotatedPage (its PNG would reach the model
// as base64 text, copilot has no image path for it). The finalisation tool follows
// the mode (submit XOR download). Returned as the plain
// { name: { description, inputSchema } } record streamText consumes.
const SHARED_TOOL_NAMES = [
  'batchSetFieldValues',
  'deleteFields',
  'deletePages',
  'detectFields',
  'focusField',
  'getDocumentContent',
  'getFields',
  'goTo',
  'movePage',
  'rotatePage',
  'selectTool',
  'setFieldValue',
] satisfies readonly SimplePDFToolName[]

export const buildCopilotToolDefinitions = (): Record<string, ToolDefinition> => {
  const all = simplePDFToolDefinitions()
  const names: readonly SimplePDFToolName[] = [...SHARED_TOOL_NAMES, FINALISATION_ACTION.toolName]
  return Object.fromEntries(names.map((name) => [name, all[name]]))
}

// The exact set of tool names copilot exposes to the model — the executable
// allowlist. The browser-side executor is gated on this (defense in depth: the
// model only ever sees this set in its server tool definitions, but the executor
// must not run anything outside it either, e.g. createField or the inactive
// finalisation tool).
const COPILOT_TOOL_NAMES: ReadonlySet<string> = new Set(Object.keys(buildCopilotToolDefinitions()))

export const isCopilotToolName = (value: unknown): value is SimplePDFToolName =>
  typeof value === 'string' && COPILOT_TOOL_NAMES.has(value)

// Copilot pins the flags its UX depends on, whatever the model sends: the agent
// never also downloads a copy on submit, and a single setFieldValue always types
// its text out so the person watching follows the field being filled. A batch
// (bulk mode) has no such flag: the editor sets its values at once.
export const pinCopilotFlags = (toolName: SimplePDFToolName, input: ToolInput): ToolInput => {
  switch (toolName) {
    case 'submit':
      return { ...input, downloadCopy: false }
    case 'setFieldValue':
      return { ...input, animate: true }
    case 'batchSetFieldValues':
    case 'createField':
    case 'deleteFields':
    case 'deletePages':
    case 'detectFields':
    case 'download':
    case 'focusField':
    case 'getAnnotatedPage':
    case 'getDocumentContent':
    case 'getFields':
    case 'goTo':
    case 'movePage':
    case 'rotatePage':
    case 'selectTool':
      return input
    default:
      toolName satisfies never
      return input
  }
}
