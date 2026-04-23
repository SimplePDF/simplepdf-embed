// Typed monitoring interface. Every log site goes through `monitoring.info /
// warn / error / debug` with a string-literal event name and a payload whose
// shape is validated at compile time against the event dictionary below. The
// `[copilot]` prefix lives here once, not at each call site.
//
// All levels are gated behind `import.meta.env.DEV` so production builds
// strip the call bodies entirely. Vite substitutes the constant at build
// time and the branch tree-shakes; nothing reaches stdout in prod.

type RateLimitReason = 'lifetime' | 'system_failure'

// Full event dictionary. Adding a new call site = add a new entry here. The
// key is the event name, the value is the payload shape. Every field is
// serialisable; Errors are normalised to `{ detail: string }` or similar at
// the call site before being passed in.
export type EventPayloads = {
  // shared_keys.ts (server)
  'shared_keys.parse_failed': { reason: 'invalid_json' | 'schema_mismatch' }
  'shared_keys.reserved_id_rejected': { share_id: string }

  // rate_limit.ts (server)
  'rate_limit.hydrated': { entries: number }
  'rate_limit.hydration_failed': { detail: string }
  'rate_limit.check_threw': { ip_hash: string; detail: string }

  // rate_limit_persistence.ts (server)
  'rate_limit.flushed': { entries: number }
  'rate_limit.flush_failed': { detail: string }
  'rate_limit.load_invalid_shape': Record<string, never>
  'rate_limit.load_failed': { detail: string }

  // chat.ts (server)
  'chat.blocked_system_failure': { ip_hash: string | null; detail: string }
  'chat.rate_limited': { ip_hash: string; reason: RateLimitReason }
  'chat.finished': {
    ip_hash: string
    input_tokens: number | undefined
    output_tokens: number | undefined
    cached_input_tokens: number | undefined
    elapsed_ms: number
  }
  'chat.streaming': {
    ip_hash: string
    counted_against_limit: boolean
    remaining_lifetime: number | null
    message_count: number
    language: string
  }

  // summarize.ts (server)
  'summarize.blocked_system_failure': { ip_hash: string | null; detail: string }
  'summarize.rate_limit_threw': { ip_hash: string; detail: string }
  'summarize.done': {
    ip_hash: string
    input_chars: number
    output_chars: number
    language: string
  }

  // chat_pane.tsx (client)
  'chat.error': { detail: string }
  'chat.tool_call': { tool_name: string; input: Record<string, unknown> }
  'chat.tool_done': { tool_name: string; elapsed_ms: number; data: unknown }
  'chat.tool_failed': {
    tool_name: string
    elapsed_ms: number
    input: Record<string, unknown>
    error: { code: string; message: string }
  }
  'chat.queued_tool_execution_failed': { detail: string }
  'chat.turn_start': Record<string, never>
  'chat.first_token': { elapsed_ms: number }
  'chat.turn_done': { elapsed_ms: number }

  // byok_transport.ts (client)
  'byok.stream_error': { detail: string }

  // iframe_bridge.ts (client)
  'iframe.request_sent': { request_id: string; type: string; timeout_ms: number }
  'iframe.request_timed_out': { request_id: string; type: string; elapsed_ms: number }
  'iframe.request_received': {
    request_id: string
    type: string
    elapsed_ms: number
    success: boolean
  }
  'iframe.request_missing_pending': { request_id: string }
  'iframe.ignored_cross_origin_message': { origin: string; expected: string }
  'editor.ready_via_event': Record<string, never>
  'editor.ready_via_probe': Record<string, never>
  'editor.ready_fallback_timeout': { timeout_ms: number }
  'document.loaded_via_probe': Record<string, never>
  'document.loaded_via_event': Record<string, never>

  // routes/index.tsx (client)
  'base_domain.invalid': { raw: string }
}

export type EventName = keyof EventPayloads

const PREFIX = '[copilot]'

// Build-time constant. Vite replaces `import.meta.env.DEV` with `true` /
// `false` literal; the `if (!ENABLED) return` below then tree-shakes the
// body in production bundles.
const ENABLED = import.meta.env.DEV === true

const emit = <E extends EventName>(sink: typeof console.info, event: E, payload: EventPayloads[E]): void => {
  if (!ENABLED) {
    return
  }
  sink(`${PREFIX} ${event}`, payload)
}

export const monitoring = {
  info: <E extends EventName>(event: E, payload: EventPayloads[E]): void =>
    emit(console.info, event, payload),
  warn: <E extends EventName>(event: E, payload: EventPayloads[E]): void =>
    emit(console.warn, event, payload),
  error: <E extends EventName>(event: E, payload: EventPayloads[E]): void =>
    emit(console.error, event, payload),
  debug: <E extends EventName>(event: E, payload: EventPayloads[E]): void =>
    emit(console.debug, event, payload),
}

export const normalizeError = (error: unknown): string => {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`
  }
  return String(error)
}
