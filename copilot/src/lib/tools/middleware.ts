import type { BridgeResult } from '@simplepdf/embed'
import type { SimplePDFToolName } from '@simplepdf/embed/tools'

// Copilot-owned tool middleware. The @simplepdf/embed package owns the bridge,
// the tool registry, and the executor; middleware (compaction, prompt-injection
// envelope, toolbar sync, demo-download interception) is host policy and lives
// here. Each layer wraps the package executor without forking the package.

export type ToolInput = Record<string, unknown>

export type MiddlewareContext = {
  toolName: SimplePDFToolName
  input: ToolInput
}

export type ToolMiddleware = (
  context: MiddlewareContext,
  next: () => Promise<BridgeResult<unknown>>,
) => Promise<BridgeResult<unknown>>

// Compose a stack of middleware into a single call. Executes left-to-right: the
// first middleware in the array is the outermost layer.
export const composeMiddleware = (
  layers: readonly ToolMiddleware[],
  inner: (context: MiddlewareContext) => Promise<BridgeResult<unknown>>,
): ((context: MiddlewareContext) => Promise<BridgeResult<unknown>>) => {
  if (layers.length === 0) {
    return inner
  }
  return async (context) => {
    const run = (index: number): Promise<BridgeResult<unknown>> => {
      if (index >= layers.length) {
        return inner(context)
      }
      const layer = layers[index]
      if (layer === undefined) {
        return inner(context)
      }
      return layer(context, () => run(index + 1))
    }
    return run(0)
  }
}
