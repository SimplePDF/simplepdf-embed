# @simplepdf/react-embed-pdf

## 1.14.0

### Minor Changes

- c225115: **Fill several fields in one call: `batchSetFieldValues` sets every value at once, or none of them.**
  - `batchSetFieldValues({ updates: [{ fieldId, value }] })` applies every update in one step, reverted by a single undo in the editor, and resolves with no data.
  - If any update is rejected (an unknown field, an invalid option, a read-only field, an unreadable signature URL, the same field twice), nothing changes: the result fails with `bad_request:batch_validation_failed` and `error.details.failures` lists every rejected update with its `fieldId`, `code` and `message` (typed as `BatchValidationFailedDetails`).
  - Values follow the `setFieldValue` rules and are never typed out.
  - Available everywhere the editor operations are: `embed.actions.batchSetFieldValues`, `useEmbed().actions.batchSetFieldValues`, the `batchSetFieldValues` agentic tool on every tool subpath, and the `simplepdf_embed_batch_set_field_values` WebMCP tool, including on pages using `@simplepdf/web-embed-pdf`.

### Patch Changes

- c225115: **Smaller installs, leaner agent requests, readable stack traces.**
  - The agentic tools no longer repeat each tool's description inside its input schema: with the shorter descriptions below, a model request carrying all the AI SDK or TanStack AI tools sends about 3 KB less (24%) even with the new `batchSetFieldValues` tool, and the agentic entry points are 28 to 29% smaller.
  - Tool descriptions are about 24% shorter (900 fewer characters across the 16 tools of the previous release): they state behavior and leave the details to each parameter, permission notes are gone (a refused call answers with its error code), and they name no tool or key whose spelling differs between surfaces, so they read true whether your agent sees camelCase (AI SDK, TanStack AI) or snake_case (WebMCP). The signature `value` documents that plain text is drawn as a typed signature. `getAnnotatedPage` states that the WebMCP tool returns the render as an image block and the rest of the result as a text block.
  - Smaller installs: no source maps, so `@simplepdf/embed` unpacks to 248 KB instead of 596 KB and `@simplepdf/react-embed-pdf` to 74 KB instead of 110 KB. `@simplepdf/react-embed-pdf` is no longer minified, so an error inside it shows readable code in your devtools and error tracker; your bundler still minifies your app.
  - `@simplepdf/web-embed-pdf` drops its `browser` field, so bundlers resolve the readable `dist/index.js`; the script-tag build on unpkg stays minified.
  - The `/schemas` input schemas no longer carry the operation description at their root; read it from `SIMPLEPDF_TOOLS[name].description`, or from `OPERATIONS` in `@simplepdf/embed/protocol` for every operation including `loadDocument`.
- Updated dependencies [c225115]
- Updated dependencies [c225115]
  - @simplepdf/embed@0.9.0

## 1.13.1

### Patch Changes

- Updated dependencies [dbc84c1]
  - @simplepdf/embed@0.8.0

## 1.13.0

### Minor Changes

- 06a5946: Add `webMCP`: register the editor operations as WebMCP tools on the host page.

  An in-browser agent (ChatGPT's browser, Chrome with WebMCP) discovers tools on the page it is looking at, not inside iframes. `createEmbed({ webMCP: { enabled: true } })` and `<EmbedPDF mode="inline" webMCP={{ enabled: true }} />` register every operation (`loadDocument` included) on the page's model context and forward each call to the editor over the bridge. Each tool is the record the editor publishes in its manifest and registers on its own page (the `simplepdf_embed_*` name, description, snake_case input schema and behavior hints), so a page gets the same tools whether the editor is embedded or opened directly. `exclude: ['submit', ...]` withholds operations by SDK method name so a person keeps the decision; a malformed value, an unknown key or an unknown name throws `EmbedConfigError`. Every operation runs in the browser and nothing the agent reads is computed server-side; document storage follows your account's configuration exactly as it does without WebMCP. Each call resolves with an MCP tool result carrying the editor's wire-shaped Result (`isError` on failure; the annotated page render as an `image` block); a call aborted before it ran rejects; `dispose()` unregisters everything. Off by default (`{ enabled: false }` and omitting the option are the same): the WebMCP module loads lazily, once the editor is ready and only when the page exposes a model context. One WebMCP-enabled embed per page (tool names are page-level).

- 06a5946: Add `getAnnotatedPage({ page })` (the editor's `GET_ANNOTATED_PAGE`): a PNG render of one page with every field outlined and numbered, plus a `badges` map from each number to its `field_id`, so a vision model can label fields by looking at the printed form. Available as `embed.actions.getAnnotatedPage` / `useEmbed().actions.getAnnotatedPage`, as the `getAnnotatedPage` agentic tool on every tool subpath, and as a WebMCP tool (a reader: `readOnlyHint` + `untrustedContentHint`).

  The contract pin follows the live manifest: `loadDocument` also accepts an http(s) URL the editor fetches and its description states that it discards the current document and every edit in it; `getFields` points agents at `get_annotated_page`.

### Patch Changes

- Updated dependencies [06a5946]
- Updated dependencies [06a5946]
- Updated dependencies [06a5946]
  - @simplepdf/embed@0.7.0

## 1.12.1

### Patch Changes

- 9bc37de: Pin `@simplepdf/embed` to an exact version (`0.6.0`) instead of the `^0.6.0` caret. A published `@simplepdf/react-embed-pdf` now always installs the exact embed build it was tested against, giving us full control over the embed rollout: react ships a known embed version, and moving it is a deliberate release step rather than a caret range resolved at the consumer's install time.

## 1.12.0

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

### Patch Changes

- Updated dependencies [e91b4c7]
  - @simplepdf/embed@0.6.0

## 1.11.0

### Minor Changes

- 980906d: Rebuilt on the `@simplepdf/embed` core, adding an AI-SDK-native agentic surface — a non-breaking superset of the existing component API.

  `@simplepdf/react-embed-pdf` no longer hand-rolls its own iframe bridge; it is a thin React layer over the shared `@simplepdf/embed` core (the same core `web-embed-pdf` and future framework adapters sit on).

  **The existing `<EmbedPDF>` contract is preserved (drop-in):** the props (`companyIdentifier`, `documentURL`, `mode` — still defaulting to `"modal"`, `onEmbedEvent`, `locale`, `baseDomain`, `context`, `className`, `style`) and, crucially, `onEmbedEvent` still emits the editor's events VERBATIM: `{ type: 'EDITOR_READY' | 'DOCUMENT_LOADED' | 'PAGE_FOCUSED' | 'SUBMISSION_SENT', data }` with snake_case payloads. `useEmbed()` still returns `{ embedRef, actions }`.

  **New (additive):**

  - A new opt-in `@simplepdf/react-embed-pdf/ai-sdk` subpath exposes the agentic surface: `useEmbedTools(embedRef)` binds the tool registry to the live editor for the Vercel AI SDK (`useChat({ tools })`), plus `simplePDFToolDefinitions` (server) and `createSimplePDFExecutor`. It mirrors `@simplepdf/embed`'s `/ai-sdk`, so the package root stays zod-free.
  - `useEmbed().actions` now exposes the FULL editor surface (camelCase): `createField`, `getFields`, `setFieldValue`, `focusField`, `movePage`, `rotatePage`, `deletePages`, `download`, … — not just the original six.
  - A typed `document` prop (`{ url } | { dataUrl } | { file }`), the same shape as `createEmbed`. It also accepts data URLs and File/Blob, and a SimplePDF documents URL loads directly (prefill etc.). `documentURL` is now `@deprecated` (still works) in favor of it.
  - An optional `logger` prop surfaces the bridge's structured lifecycle/error logging.
  - The forwarded `ref` (`embedRef.current`) stays the flat actions handle — `embedRef.current.selectTool(...)`, etc. — now exposing the full camelCase action set. (The framework-free `@simplepdf/embed` core groups its handle as `embed.actions` / `embed.events` / `embed.lifecycle`; the React layer flattens it to keep the existing ref contract.)

  **Imperative actions stay backward-compatible.** `selectTool` and `submit` gained camelCase argument shapes to match the rest of the SDK (`selectTool({ tool })`, `submit({ downloadCopy })`), but the previous forms — `selectTool(toolType)` and `submit({ downloadCopyOnDevice })` — still work as deprecated overloads that normalize to the new shape, so existing `useEmbed().actions` callers don't change. A relative `documentURL` / trigger `href` (e.g. `/form.pdf`) is still accepted — it is resolved against the page URL, as before.

  One behavioral note: calling an action before `<EmbedPDF>` has mounted now resolves to `{ success: false, error: { code: 'unexpected:iframe_not_mounted' } }` (the previous form returned `bad_request:embed_ref_not_available`). Code that checks `result.success` is unaffected; only code branching on the exact pre-mount error string needs updating.

  Packaging is preserved: still dual CJS + ESM, so `require()` consumers keep working. `zod` remains a peer dependency, now required **only** by the agentic `/ai-sdk` subpath (it validates tool input) — the package root (`<EmbedPDF>`, `useEmbed`) is zod-free, so a non-agentic app never loads it. Install `zod` only if you import `/ai-sdk`; npm 7+ adds it automatically, pnpm / Yarn PnP users add it explicitly.

### Patch Changes

- Updated dependencies [980906d]
  - @simplepdf/embed@0.5.0

## 1.10.0

### Minor Changes

- cae5ce6: Adds new programmatic actions to the React embed component for advanced integrations: goTo, createField, removeFields, getDocumentContent
