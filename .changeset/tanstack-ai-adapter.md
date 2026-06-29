---
"@simplepdf/embed": minor
"@simplepdf/react-embed-pdf": minor
---

Add a TanStack AI adapter (the `/tanstack-ai` subpath) for client-side tool calling, alongside the existing Vercel AI SDK (`/ai-sdk`) adapter. Both wrap the same generated tool registry + bridge router, so the editor is drivable from either SDK with no duplicated logic.

- `@simplepdf/embed/tanstack-ai`: `simplePDFToolDefinitions()` (server, for `chat({ tools })`) and `createSimplePDFTools({ embed })` (browser `.client()` tools for `clientTools(...)` then `useChat({ tools })`).
- `@simplepdf/react-embed-pdf/tanstack-ai`: `useEmbedTools(embedRef)`, the editor-bound client tools. Server definitions stay in the React-free core `@simplepdf/embed/tanstack-ai`, so a server route never pulls React in.
- `@tanstack/ai` is a new optional peer, pulled only by the `/tanstack-ai` subpath; the package roots stay free of it (and of `zod`).
- **Public exports trimmed to the strict minimum.** These are breaking removals, but the only consumer is copilot (migrated in lockstep), so they ship as a minor rather than a major:
  - `@simplepdf/embed` root drops the internal helpers `buildEditorDomain`, `encodeContext`, `isBridgeResultLike`.
  - `@simplepdf/embed/protocol` drops the internal `INTERNAL_PROTOCOL` / `InternalProtocolType` (used only by the bridge).
  - `@simplepdf/react-embed-pdf` root no longer re-exports the whole `@simplepdf/embed` core or the wire-protocol vocabulary; import those from `@simplepdf/embed` / `@simplepdf/embed/protocol` directly.
  - `@simplepdf/react-embed-pdf/ai-sdk` no longer re-exports `simplePDFToolDefinitions` (import it from `@simplepdf/embed/ai-sdk`); the browser-side `createSimplePDFExecutor` stays. Server tool-definitions now live only in the React-free core, so a server route never pulls React in.
