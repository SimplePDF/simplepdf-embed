import type { AgenticToolName } from './generated/contract'

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
