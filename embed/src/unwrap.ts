import type { BridgeError, BridgeResult } from './types'

// Opt-in Result -> throw helper for consumers who prefer exceptions over the
// Result pattern. Zero runtime dependencies.
export class BridgeUnwrapError extends Error {
  readonly error: BridgeError
  constructor(error: BridgeError) {
    super(error.message)
    this.name = 'BridgeUnwrapError'
    this.error = error
  }
}

export const unwrap = <TData>(result: BridgeResult<TData>): TData => {
  if (result.success) {
    return result.data
  }
  throw new BridgeUnwrapError(result.error)
}
