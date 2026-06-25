// Wire protocol constants. The PUBLIC operation + outbound-event vocabulary is
// generated from embed-api.json (the editor iframe lib is the source); the
// INTERNAL protocol frames the editor uses to drive the bridge are hand-authored
// here and are never part of the public operation/event surface. Zero runtime
// dependencies.

import { OPERATIONS, OUTBOUND_EVENTS } from './generated/contract'

export type {
  ExtractionMode,
  FieldType,
  Locale,
  OutboundEventType,
  OverlayToolType,
  RequestType,
  WireType,
} from './generated/contract'
export { OPERATIONS, OUTBOUND_EVENTS } from './generated/contract'
// Contract vocabulary as runtime const arrays (their derived types are exported
// above). Lets consumers iterate the editor's field-type / overlay-tool / locale
// / error-code sets instead of restating the literals.
export {
  EDITOR_ERROR_CODES,
  EXTRACTION_MODES,
  FIELD_TYPES,
  LOCALES,
  OVERLAY_TOOL_TYPES,
} from './generated/contract'
// The internal protocol constants live in their own module (so the bridge / root
// entry never pulls the OPERATIONS table); the public /protocol surface re-exports them.
export { INTERNAL_PROTOCOL } from './internal-protocol'
export type { InternalProtocolType } from './internal-protocol'

// Convenience derived constants (the wire type each op posts; the request_type
// that doubles as the agentic tool name).
export const WIRE_TYPES = OPERATIONS.map((operation) => operation.wire_type)
export const REQUEST_TYPES = OPERATIONS.map((operation) => operation.request_type)
export const OUTBOUND_EVENT_TYPES = OUTBOUND_EVENTS.map((event) => event.event_type)
