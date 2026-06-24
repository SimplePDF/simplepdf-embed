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

// A consumer-provided logger must never affect bridge behavior: wrap every method
// so a throwing logger is swallowed (it can otherwise turn an already-posted,
// irreversible request into a failure, or break listener iteration / cleanup).
// Each call goes through the original object, so a receiver-dependent
// (`this`-using) logger keeps working.
export const makeSafeLogger = (logger: BridgeLogger): BridgeLogger => {
  const guard =
    (level: 'debug' | 'info' | 'warn' | 'error') =>
    (event: string, payload: LogPayload): void => {
      try {
        logger[level](event, payload)
      } catch {
        // A logging failure is never allowed to surface.
      }
    }
  return { debug: guard('debug'), info: guard('info'), warn: guard('warn'), error: guard('error') }
}
