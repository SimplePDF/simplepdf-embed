// @simplepdf/react-embed-pdf — the React home for embedding the SimplePDF editor,
// built on the framework-free @simplepdf/embed core. This root entry is zod-free (like
// the core's main entry); the agentic tools live in the opt-in `/ai-sdk` (Vercel,
// `useEmbedTools`) and `/tanstack-ai` (TanStack, `useEmbedTanstackTools`) subpaths, which
// pull zod (and `@tanstack/ai` for `/tanstack-ai`), so a non-agentic app never loads them.

export { EmbedPDF, useEmbed } from './embed-pdf';
export type { EmbedActions, EmbedEvent, EmbedPDFProps } from './embed-pdf';

// Framework-free core: the full typed surface (Embed, BridgeResult / BridgeError,
// the per-op Input/Output types, FieldRecord, FieldType, OverlayToolType, Locale,
// …) plus createEmbed + helpers for non-React / imperative use.
export * from '@simplepdf/embed';

export {
  EDITOR_ERROR_CODES,
  EXTRACTION_MODES,
  FIELD_TYPES,
  INTERNAL_PROTOCOL,
  LOCALES,
  OPERATIONS,
  OUTBOUND_EVENT_TYPES,
  OUTBOUND_EVENTS,
  OVERLAY_TOOL_TYPES,
  REQUEST_TYPES,
  WIRE_TYPES,
} from '@simplepdf/embed/protocol';
export type { InternalProtocolType, OutboundEventType, RequestType, WireType } from '@simplepdf/embed/protocol';
