// What the zero-dep root needs to know about WebMCP without loading the module:
// the option shape and where a model context lives.

import type { AgenticToolName } from './generated/contract'

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

// `true` registers every agentic operation; `exclude` withholds the listed ones
// (e.g. `submit` when only a person may finalize). `false` / omitted registers nothing.
export type WebMCPOptions = boolean | { exclude: readonly AgenticToolName[] }

// The one decoder of the option shape: the bridge (start or not), the WebMCP module
// (what to withhold) and the React layer (a remount key) all read this instead of
// re-deriving the `undefined | false | true | { exclude }` cases.
/** @internal Shared with @simplepdf/react-embed-pdf; not part of the consumer contract. */
export const normalizeWebMCPOptions = (
  options: WebMCPOptions | undefined,
): { enabled: false } | { enabled: true; exclude: readonly AgenticToolName[] } => {
  if (options === undefined || options === false) {
    return { enabled: false }
  }
  if (options === true) {
    return { enabled: true, exclude: [] }
  }
  return { enabled: true, exclude: options.exclude }
}
