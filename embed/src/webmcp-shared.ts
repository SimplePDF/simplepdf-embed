// What the zero-dep root needs to know about WebMCP without loading the module:
// the option shape and where a model context lives.

import type { MethodName } from './generated/contract'

// Every value a page may expose as its model context, document first (the canonical
// install location since Chrome 150; `navigator.modelContext` is the deprecated alias
// older runtimes still expose). The bridge checks presence, the module validity.
export const modelContextCandidates = (): unknown[] => {
  const candidates: unknown[] = []
  if ('modelContext' in document) {
    candidates.push(document.modelContext)
  }
  if ('modelContext' in navigator) {
    candidates.push(navigator.modelContext)
  }
  return candidates
}

// `{ enabled: true }` registers every operation; `exclude` withholds the listed ones
// by SDK method name (e.g. `submit` when only a person may finalize). `{ enabled: false }`
// and omitted are one state. The object is the home of every WebMCP-specific setting.
export type WebMCPOptions = { enabled: false } | { enabled: true; exclude?: readonly MethodName[] }

// The one decoder of the option shape: the bridge (start or not), the WebMCP module
// (what to withhold) and the React layer (a remount key) all read this instead of
// re-deriving the `undefined | { enabled: false } | { enabled: true, exclude? }` cases.
/** @internal Shared with @simplepdf/react-embed-pdf; not part of the consumer contract. */
export const normalizeWebMCPOptions = (
  options: WebMCPOptions | undefined,
): { enabled: false } | { enabled: true; exclude: readonly MethodName[] } => {
  if (options === undefined) {
    return { enabled: false }
  }
  switch (options.enabled) {
    case false:
      return { enabled: false }
    case true:
      return { enabled: true, exclude: options.exclude ?? [] }
    default:
      options satisfies never
      return { enabled: false }
  }
}
