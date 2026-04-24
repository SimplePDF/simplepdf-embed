import type { BridgeResult } from '../../embed-bridge'
import type { ToolInput } from './dispatch'

// Onion-style middleware. Each layer receives a context (tool name + input)
// and `next()` which triggers the inner dispatcher. Layers can short-circuit
// (return without calling next), pre-process the input (wrap next with a
// modified context), post-process the result (await next, transform, return),
// or observe (await next, log, return).
//
// Typical layers in the example:
//   - compactionMiddleware: post-processes get_fields / get_document_content
//     to fit a token budget.
//   - envelopeMiddleware: wraps successful results in a `{ __untrusted_data,
//     data }` envelope for prompt-injection hardening.

export type MiddlewareContext = {
  toolName: string
  input: ToolInput
}

export type ToolMiddleware = (
  context: MiddlewareContext,
  next: () => Promise<BridgeResult<unknown>>,
) => Promise<BridgeResult<unknown>>

// Compose a stack of middleware into a single call. Executes left-to-right:
// the first middleware in the array is the outermost layer.
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
