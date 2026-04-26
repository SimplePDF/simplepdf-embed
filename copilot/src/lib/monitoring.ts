// Typed monitoring interface. Every log site goes through `monitoring.info /
// warn / error / debug` with a string-literal event name and a payload whose
// shape is validated at compile time against the event dictionary below. The
// `[copilot]` prefix lives here once, not at each call site.
//
// This module is also the single place where log visibility is gated:
// error() always runs so real failures stay visible in production without any
// flag flip; info / warn / debug are gated on VITE_ENABLE_DEVTOOLS so regular
// visitors don't see internal telemetry in their console. Vite substitutes
// the env literal at build time, so the gated branches tree-shake in
// production.
//
// The lib/embed-bridge package needs a BridgeLogger it can call
// unconditionally (it doesn't know about the devtools flag). `bridgeLogger`
// below is the adapter: same always-on-error / gated-chatty behaviour as
// `monitoring`, reshaped into the BridgeLogger contract. That keeps the
// gating decision in one file.

import type { BridgeLogger, LogPayload } from './embed-bridge'

type RateLimitReason = 'lifetime' | 'system_failure'

// Full event dictionary. Adding a new call site = add a new entry here. The
// key is the event name, the value is the payload shape. Every field is
// serialisable; Errors are normalised to `{ detail: string }` or similar at
// the call site before being passed in.
export type EventPayloads = {
  // shared_keys.ts (server)
  'shared_keys.parse_failed': {
    reason: 'empty_env' | 'invalid_json' | 'schema_mismatch' | 'empty_map'
    detail: string
  }
  'shared_keys.reserved_id_rejected': { share_id: string }

  // rate_limit.ts (server)
  'rate_limit.check_threw': { ip_hash: string; detail: string }
  'rate_limit.in_memory_mode': Record<string, never>
  'rate_limit.redis_ready': Record<string, never>
  'rate_limit.redis_error': { detail: string }

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

  // misbehavior.ts (server)
  'misbehavior.flagged': { ip_hash: string; reason: 'non_browser_origin' }

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
  'byok.system_prompt_built': {
    provider: string
    model: string
    instructions_mode: 'append' | 'replace' | null
    instructions_length: number
    system_prompt_length: number
  }

  // key_vault.ts (client)
  'byok_vault.schema_mismatch': { detail: string }
  'byok_vault.loaded': {
    credential_count: number
    active: string | null
    active_has_custom_instructions: boolean
    active_instructions_mode: 'append' | 'replace' | null
    active_instructions_length: number
  }
  'byok_vault.credential_saved': {
    key: string
    has_custom_instructions: boolean
    instructions_mode: 'append' | 'replace' | null
    instructions_length: number
  }
  'byok_vault.load_failed': { detail: string }
  'byok_vault.save_failed': { detail: string }
  'byok_vault.clear_failed': { detail: string }
  'byok_vault.touch_failed': { detail: string }

  // chat_pane.tsx (client) — picker apply checkpoints
  'byok.apply_pending': {
    provider: string
    model: string
    has_custom_instructions: boolean
    instructions_mode: 'append' | 'replace' | null
    instructions_length: number
  }

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
const BRIDGE_PREFIX = '[copilot:bridge]'

const DEVTOOLS_ENABLED = import.meta.env.VITE_ENABLE_DEVTOOLS === 'true'

// Gated print: swallowed unless VITE_ENABLE_DEVTOOLS is set. Used for info,
// warn, debug. Vite folds DEVTOOLS_ENABLED to a literal at build time so the
// body tree-shakes out in production.
const print = (prefix: string, sink: typeof console.info, event: string, payload: LogPayload): void => {
  if (!DEVTOOLS_ENABLED) {
    return
  }
  sink(`${prefix} ${event}`, payload)
}

// Always-on print: real failures stay visible in production without any
// flag flip.
const printError = (prefix: string, event: string, payload: LogPayload): void => {
  console.error(`${prefix} ${event}`, payload)
}

export const monitoring = {
  info: <E extends EventName>(event: E, payload: EventPayloads[E]): void =>
    print(PREFIX, console.info, event, payload),
  warn: <E extends EventName>(event: E, payload: EventPayloads[E]): void =>
    print(PREFIX, console.warn, event, payload),
  error: <E extends EventName>(event: E, payload: EventPayloads[E]): void =>
    printError(PREFIX, event, payload),
  debug: <E extends EventName>(event: E, payload: EventPayloads[E]): void =>
    print(PREFIX, console.debug, event, payload),
}

export const normalizeError = (error: unknown): string => {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`
  }
  return String(error)
}

// Adapter so the lib/embed-bridge package can call a logger unconditionally
// without knowing about the devtools flag. Same gating policy: error always
// prints, info / warn / debug only when VITE_ENABLE_DEVTOOLS is on. The
// `[copilot:bridge]` prefix keeps bridge-sourced logs visually distinct
// from application logs.
export const bridgeLogger: BridgeLogger = {
  debug: (event, payload) => print(BRIDGE_PREFIX, console.debug, event, payload),
  info: (event, payload) => print(BRIDGE_PREFIX, console.info, event, payload),
  warn: (event, payload) => print(BRIDGE_PREFIX, console.warn, event, payload),
  error: (event, payload) => printError(BRIDGE_PREFIX, event, payload),
}
