import type { BridgeResult } from './types'

// Runtime guard for the result envelope received from the editor. The payload is
// JSON parsed from the editor origin; same-origin policy narrows the attacker
// surface, but a page on that origin could still forge a frame. We validate the
// discriminator + the error shape; the `data` payload stays unknown and is
// narrowed by the caller's typed method signature.
export const isBridgeResultLike = (value: unknown): value is BridgeResult<unknown> => {
  if (typeof value !== 'object' || value === null || !('success' in value)) {
    return false
  }
  if (value.success === true) {
    // `data` is optional on the wire: the editor omits it for void operations.
    // The bridge normalizes a missing `data` to null downstream, so the guard
    // accepts both shapes rather than flipping a void success into a failure.
    return true
  }
  if (value.success === false) {
    if (!('error' in value)) {
      return false
    }
    const error = value.error
    if (typeof error !== 'object' || error === null) {
      return false
    }
    if (!('code' in error) || !('message' in error)) {
      return false
    }
    // We validate only the code+message discriminant. The typed `details` carried
    // by bad_request:missing_required_fields is trusted to the same-origin editor
    // (the same trust boundary that covers the success `data`); we don't re-derive
    // it at runtime.
    return typeof error.code === 'string' && typeof error.message === 'string'
  }
  return false
}
