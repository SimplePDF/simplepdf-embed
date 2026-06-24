// Logger contract the bridge calls into. The bridge emits event names as plain
// strings and payload objects; the consumer wires a type-safe sink (or noop) at
// construction time. Zero runtime dependencies.

export type LogPayload = Record<string, unknown>

export type BridgeLogger = {
  debug: (event: string, payload: LogPayload) => void
  info: (event: string, payload: LogPayload) => void
  warn: (event: string, payload: LogPayload) => void
  error: (event: string, payload: LogPayload) => void
}

export const NOOP_LOGGER: BridgeLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}
