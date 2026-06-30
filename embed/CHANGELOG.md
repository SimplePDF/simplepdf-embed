# @simplepdf/embed

## 0.6.0

### Minor Changes

- e91b4c7: Add a TanStack AI adapter (the `/tanstack-ai` subpath) for client-side tool calling, alongside the existing Vercel AI SDK (`/ai-sdk`) adapter. Both wrap the same generated tool registry + bridge router, so the editor is drivable from either SDK with no duplicated logic.

  - `@simplepdf/embed/tanstack-ai`: `simplePDFToolDefinitions()` (server, for `chat({ tools })`) and `createSimplePDFTools({ embed })` (browser `.client()` tools for `clientTools(...)` then `useChat({ tools })`).
  - `@simplepdf/react-embed-pdf/tanstack-ai`: `useEmbedTools(embedRef)`, the editor-bound client tools. Server definitions stay in the React-free core `@simplepdf/embed/tanstack-ai`, so a server route never pulls React in.
  - `@tanstack/ai` is a new optional peer, pulled only by the `/tanstack-ai` subpath; the package roots stay free of it (and of `zod`).
  - **Public exports trimmed to the strict minimum.** These are breaking removals, but the only consumer is copilot (migrated in lockstep), so they ship as a minor rather than a major:
    - `@simplepdf/embed` root drops the internal helpers `buildEditorDomain`, `encodeContext`, `isBridgeResultLike`.
    - `@simplepdf/embed/protocol` drops the internal `INTERNAL_PROTOCOL` / `InternalProtocolType` (used only by the bridge).
    - `@simplepdf/react-embed-pdf` root no longer re-exports the whole `@simplepdf/embed` core or the wire-protocol vocabulary; import those from `@simplepdf/embed` / `@simplepdf/embed/protocol` directly.
    - `@simplepdf/react-embed-pdf/ai-sdk` no longer re-exports `simplePDFToolDefinitions` (import it from `@simplepdf/embed/ai-sdk`); the browser-side `createSimplePDFExecutor` stays. Server tool-definitions now live only in the React-free core, so a server route never pulls React in.

## 0.5.0

### Minor Changes

- 980906d: camelCase SDK surface grouped into `actions` / `events` / `lifecycle`, `companyIdentifier`, and direct loading of SimplePDF documents URLs.

  - **Grouped handle**: `createEmbed` returns `{ actions, events, lifecycle }` — `embed.actions.*` (operations), `embed.events.on(type, handler)` (subscriptions), `embed.lifecycle.dispose()` (teardown).
  - **camelCase everywhere on the SDK**, with the snake_case wire kept behind a transform owned by the bridge: method names + their arguments + results + the agentic tool names/args are camelCase (`embed.actions.getFields()`, `embed.actions.setFieldValue({ fieldId, value })`, `embed.actions.submit({ downloadCopy })`, `tools.getDocumentContent`). The editor's snake_case wire is generated from `embed-api.json` and transformed at the postMessage boundary — consumers never see it.
  - **Events are the deliberate exception**: `embed.events.on(type, handler)` delivers the editor's outbound payloads VERBATIM (snake_case fields, e.g. `document_id`) for `EDITOR_READY` / `DOCUMENT_LOADED` / `PAGE_FOCUSED` / `SUBMISSION_SENT`, so the React layer's `onEmbedEvent` is unchanged.
  - **`companyIdentifier`** replaces `tenant` in `createEmbed` (it is the consumer's own SimplePDF subdomain — `tenant` read as if SimplePDF were multi-tenant per consumer).
  - **Documents URLs load directly**: when `document.url` is a `<tenant>.<baseDomain>/documents/<id>` URL (https, single tenant label), `createEmbed` navigates the iframe straight to it (carrying `?context=`) instead of host-fetching — so prefilled/stored documents open as themselves.
  - The React layer moved OUT of this package into `@simplepdf/react-embed-pdf` (the `/react` subpath is removed); the editor iframe is granted `clipboard-read; clipboard-write` by default.
