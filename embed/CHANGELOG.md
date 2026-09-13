# @simplepdf/embed

## 0.7.0

### Minor Changes

- 06a5946: Add `webMCP`: register the editor operations as WebMCP tools on the host page.

  An in-browser agent (ChatGPT's browser, Chrome with WebMCP) discovers tools on the page it is looking at, not inside iframes. `createEmbed({ webMCP: { enabled: true } })` and `<EmbedPDF mode="inline" webMCP={{ enabled: true }} />` register every operation (`loadDocument` included) on the page's model context and forward each call to the editor over the bridge. Each tool is the record the editor publishes in its manifest and registers on its own page (the `simplepdf_embed_*` name, description, snake_case input schema and behavior hints), so a page gets the same tools whether the editor is embedded or opened directly. `exclude: ['submit', ...]` withholds operations by SDK method name so a person keeps the decision; a malformed value, an unknown key or an unknown name throws `EmbedConfigError`. Every operation runs in the browser and nothing the agent reads is computed server-side; document storage follows your account's configuration exactly as it does without WebMCP. Each call resolves with an MCP tool result carrying the editor's wire-shaped Result (`isError` on failure; the annotated page render as an `image` block); a call aborted before it ran rejects; `dispose()` unregisters everything. Off by default (`{ enabled: false }` and omitting the option are the same): the WebMCP module loads lazily, once the editor is ready and only when the page exposes a model context. One WebMCP-enabled embed per page (tool names are page-level).

- 06a5946: Add `getAnnotatedPage({ page })` (the editor's `GET_ANNOTATED_PAGE`): a PNG render of one page with every field outlined and numbered, plus a `badges` map from each number to its `field_id`, so a vision model can label fields by looking at the printed form. Available as `embed.actions.getAnnotatedPage` / `useEmbed().actions.getAnnotatedPage`, as the `getAnnotatedPage` agentic tool on every tool subpath, and as a WebMCP tool (a reader: `readOnlyHint` + `untrustedContentHint`).

  The contract pin follows the live manifest: `loadDocument` also accepts an http(s) URL the editor fetches and its description states that it discards the current document and every edit in it; `getFields` points agents at `get_annotated_page`.

- 06a5946: `EDITOR_READY` and `DOCUMENT_LOADED` now come from the editor manifest (`/embed/json` `events`), like `PAGE_FOCUSED` and `SUBMISSION_SENT`: `OUTBOUND_EVENTS` / `OutboundEventType` on `@simplepdf/embed/protocol` list all four (a widening: exhaustive consumers of `OutboundEventType` gain two members), and the root exports the `EditorReadyPayload` / `DocumentLoadedPayload` types. The `EditorEvent` shapes are unchanged.

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
