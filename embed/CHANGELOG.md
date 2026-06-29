# @simplepdf/embed

## 0.5.0

### Minor Changes

- 980906d: camelCase SDK surface grouped into `actions` / `events` / `lifecycle`, `companyIdentifier`, and direct loading of SimplePDF documents URLs.

  - **Grouped handle**: `createEmbed` returns `{ actions, events, lifecycle }` — `embed.actions.*` (operations), `embed.events.on(type, handler)` (subscriptions), `embed.lifecycle.dispose()` (teardown).
  - **camelCase everywhere on the SDK**, with the snake_case wire kept behind a transform owned by the bridge: method names + their arguments + results + the agentic tool names/args are camelCase (`embed.actions.getFields()`, `embed.actions.setFieldValue({ fieldId, value })`, `embed.actions.submit({ downloadCopy })`, `tools.getDocumentContent`). The editor's snake_case wire is generated from `embed-api.json` and transformed at the postMessage boundary — consumers never see it.
  - **Events are the deliberate exception**: `embed.events.on(type, handler)` delivers the editor's outbound payloads VERBATIM (snake_case fields, e.g. `document_id`) for `EDITOR_READY` / `DOCUMENT_LOADED` / `PAGE_FOCUSED` / `SUBMISSION_SENT`, so the React layer's `onEmbedEvent` is unchanged.
  - **`companyIdentifier`** replaces `tenant` in `createEmbed` (it is the consumer's own SimplePDF subdomain — `tenant` read as if SimplePDF were multi-tenant per consumer).
  - **Documents URLs load directly**: when `document.url` is a `<tenant>.<baseDomain>/documents/<id>` URL (https, single tenant label), `createEmbed` navigates the iframe straight to it (carrying `?context=`) instead of host-fetching — so prefilled/stored documents open as themselves.
  - The React layer moved OUT of this package into `@simplepdf/react-embed-pdf` (the `/react` subpath is removed); the editor iframe is granted `clipboard-read; clipboard-write` by default.
