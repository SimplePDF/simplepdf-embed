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
    if (typeof error.code !== 'string' || typeof error.message !== 'string') {
      return false
    }
    // The code must carry one of the closed category prefixes. We deliberately do
    // NOT enumerate the full closed set here: that would pull the generated code
    // list into the zero-dep root and reject any newly-added editor code before a
    // manifest re-sync. The exact code (like `data` and the typed `details`) is
    // trusted to the same-origin editor; the prefix check rejects garbage frames.
    return /^(bad_request|forbidden|unexpected):/.test(error.code)
  }
  return false
}
