// Wire protocol constants. The PUBLIC operation + outbound-event vocabulary is
// generated from embed-api.json (the editor iframe lib is the source); the
// INTERNAL protocol frames the editor uses to drive the bridge are hand-authored
// here and are never part of the public operation/event surface. Zero runtime
// dependencies.

import { OPERATIONS, OUTBOUND_EVENTS } from './generated/contract'

export type {
  OutboundEventType,
  RequestType,
  WireType,
} from './generated/contract'
export { OPERATIONS, OUTBOUND_EVENTS } from './generated/contract'

// Internal protocol message types (editor-owned, hand-authored). These drive the
// bridge lifecycle and request correlation; they are intentionally excluded from
// the public operation/event vocabulary and from embed-api.json.
export const INTERNAL_PROTOCOL = {
  EDITOR_READY: 'EDITOR_READY',
  DOCUMENT_LOADED: 'DOCUMENT_LOADED',
  REQUEST_RESULT: 'REQUEST_RESULT',
} as const

export type InternalProtocolType = (typeof INTERNAL_PROTOCOL)[keyof typeof INTERNAL_PROTOCOL]

// Convenience derived constants (the wire type each op posts; the request_type
// that doubles as the agentic tool name).
export const WIRE_TYPES = OPERATIONS.map((operation) => operation.wire_type)
export const REQUEST_TYPES = OPERATIONS.map((operation) => operation.request_type)
export const OUTBOUND_EVENT_TYPES = OUTBOUND_EVENTS.map((event) => event.event_type)
