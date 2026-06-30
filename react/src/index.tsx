// @simplepdf/react-embed-pdf: the React home for embedding the SimplePDF editor, built on
// the framework-free @simplepdf/embed core. This root entry is zod-free (like the core's
// main entry); the agentic tools live in the opt-in `/ai-sdk` (Vercel AI SDK) and
// `/tanstack-ai` (TanStack AI) subpaths, both exposing `useEmbedTools`, which pull zod (and
// `@tanstack/ai` for `/tanstack-ai`), so a non-agentic app never loads them.

export { EmbedPDF, useEmbed } from './embed-pdf';
export type { EmbedActions, EmbedEvent, EmbedPDFProps } from './embed-pdf';

// Core types a React consumer names directly (the document source, the field + tool enums).
// The imperative core (createEmbed, the bridge helpers) and the wire-protocol vocabulary stay
// in @simplepdf/embed: a React app uses <EmbedPDF> / useEmbed, so they are intentionally not
// re-exported here. Import them from @simplepdf/embed directly if a non-React path needs them.
export type { EmbedDocument, FieldType, OverlayToolType } from '@simplepdf/embed';
