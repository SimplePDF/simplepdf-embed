# @simplepdf/embed

Embed and programmatically drive the [SimplePDF](https://simplepdf.com) editor over its iframe / `postMessage` bridge, from any framework, with zero runtime dependencies.

> Using React? Use [`@simplepdf/react-embed-pdf`](../react): `<EmbedPDF>` + `useEmbed` (+ the agentic `tools`), built on this core.

## Quick start

`createEmbed` builds the editor iframe and appends it to a container you provide:

```html
<div id="editor" style="height: 100vh"></div>
```

```ts
import { createEmbed } from '@simplepdf/embed'

const embed = createEmbed({
  target: '#editor', // a CSS selector, or the HTMLElement itself
  companyIdentifier: 'acme', // your <companyIdentifier>.simplepdf.com subdomain ('embed' = free editor)
  document: { url: 'https://example.com/form.pdf' },
})

embed.events.on('SUBMISSION_SENT', (data) => {
  console.log('submitted', data.document_id, data.submission_id)
})

const fields = await embed.actions.getFields()
if (fields.success) {
  fields.data.fields // typed FieldRecord[]
}
```

The handle has three groups: **`embed.actions`** (operations), **`embed.events`** (subscriptions), **`embed.lifecycle`** (teardown).

## Agentic / tool-calling

Drive the editor from an LLM. Tool names + inputs are the same camelCase as the SDK; the bridge lowers them to the wire, so the model generates exactly what `routeToolCall` (and React's `useEmbedTools`) dispatch.

```ts
// server (Vercel AI SDK): execute-less tool definitions
import { simplePDFToolDefinitions } from '@simplepdf/embed/ai-sdk'
streamText({ model, tools: simplePDFToolDefinitions() })

// browser: a bridge-bound executor for onToolCall
import { createSimplePDFExecutor } from '@simplepdf/embed/ai-sdk'
const execute = createSimplePDFExecutor({ embed })
```

`@simplepdf/embed/tools` exposes the same registry SDK-agnostically (`routeToolCall`, `isSimplePDFToolName`). In React, `@simplepdf/react-embed-pdf/ai-sdk`'s `useEmbedTools(embedRef)` is the same registry pre-bound to the live editor.

For TanStack AI, the same registry is exposed via `@simplepdf/embed/tanstack-ai`:

```ts
// server: execute-less definitions so the model is aware of the tools
import { simplePDFToolDefinitions } from '@simplepdf/embed/tanstack-ai'
chat({ adapter, messages, tools: simplePDFToolDefinitions() })

// browser: the same definitions bound to the live editor via .client()
import { clientTools } from '@tanstack/ai-react'
import { createSimplePDFTools } from '@simplepdf/embed/tanstack-ai'
useChat({ connection, tools: clientTools(...createSimplePDFTools({ embed })) })
```

## Install

```bash
npm install @simplepdf/embed
```

Zero runtime dependencies at the root. `zod` is an optional peer, needed by the `/schemas`, `/tools`, `/ai-sdk`, and `/tanstack-ai` subpaths. `/ai-sdk` produces values for the Vercel AI SDK without importing `ai` (bring your own); `/tanstack-ai` uses `@tanstack/ai`'s `toolDefinition` (also an optional peer, pulled only by that subpath).

## Subpaths

| Import | Purpose | Peer |
| --- | --- | --- |
| `@simplepdf/embed` | `createEmbed`, the `Embed` handle, the closed error model + `BridgeResult` types, `unwrap`, `NOOP_LOGGER` | none |
| `@simplepdf/embed/protocol` | wire operation/event constants | none |
| `@simplepdf/embed/schemas` | zod schema for every operation input | `zod` |
| `@simplepdf/embed/tools` | SDK-agnostic agentic tool registry + `routeToolCall` + `isSimplePDFToolName` | `zod` |
| `@simplepdf/embed/ai-sdk` | `simplePDFToolDefinitions()` (server) + `createSimplePDFExecutor({ embed })` (browser) for the Vercel AI SDK | `zod` |
| `@simplepdf/embed/tanstack-ai` | `simplePDFToolDefinitions()` (server) + `createSimplePDFTools({ embed })` (browser) for TanStack AI | `zod`, `@tanstack/ai` |

## Where the editor goes

One function. It does the right thing based on what `target` points at:

- **A container** (a `<div>`, etc.) → it **creates** the iframe inside it, builds the editor URL, loads your document, and `dispose()` removes the iframe. This is the common case.
- **An existing `<iframe>`** you rendered (already pointed at the editor) → it **attaches** to it: no DOM is created, and `dispose()` leaves your iframe in place. Use this when you must own the element (a custom framework render, SSR, a modal you control).

```ts
// Point at a container, we make the iframe:
createEmbed({ target: '#editor', companyIdentifier: 'acme', document: { url } })

// Point at your own iframe, we bridge to it:
// <iframe id="ed" src="https://acme.simplepdf.com/editor"></iframe>
createEmbed({ target: '#ed', companyIdentifier: 'acme' })
```

Either way you get the same typed `Embed` handle.

### Options

| Option | Type | Notes |
| --- | --- | --- |
| `target` | `string \| HTMLElement` | **required**: a container to fill, or an `<iframe>` to attach to |
| `companyIdentifier` | `string` | **required**: your `<companyIdentifier>.simplepdf.com` subdomain (`'embed'` is the free no-account editor) |
| `document` | `{ url } \| { dataUrl } \| { file }` | initial document (see below) |
| `baseDomain` | `string` | the editor's base domain (defaults to `simplepdf.com`) |
| `locale` | `Locale` | editor UI language |
| `context` | `object` | opaque data echoed back on submissions |
| `iframeAttrs` | `{ title, allow, sandbox, className, style }` | passthrough iframe attributes (container case only); `allow` defaults to `clipboard-read; clipboard-write` |
| `logger` | `BridgeLogger` | structured logs (ids + timing only, never payloads) |

## Document source

`document` takes exactly one source, plus optional `name` and `page`:

```ts
createEmbed({ target, companyIdentifier: 'acme', document: { url: 'https://…/form.pdf' } })
createEmbed({ target, companyIdentifier: 'acme', document: { dataUrl: 'data:application/pdf;base64,…' } })
createEmbed({ target, companyIdentifier: 'acme', document: { file: pdfFileOrBlob } })
```

- **`url`**: any `http(s)` URL. Fetched from your page first (50 MB cap); on CORS / size / network failure it falls back to the editor's `?open` loader, so CORS-restricted public URLs still load. `user:pass@` credentials are allowed (they route via `?open`). A **SimplePDF documents URL** on your base-domain family (e.g. `https://acme.simplepdf.com/documents/<id>?prefill=<id>`) is navigated to directly, so the editor loads + prefills the stored document itself (your `context` is carried through).
- **`file`**: a `File` (e.g. from `<input type="file">`) or any `Blob`. Converted for you, no `FileReader`.
- **`dataUrl`**: a `data:` URL string.

Misuse fails fast with the fix in the message: a `Blob` in `url` tells you to use `{ file }`, a data URL in `url` tells you to use `{ dataUrl }`, a string in `file` tells you to use `{ url }` / `{ dataUrl }`.

## Actions

Every call resolves to `BridgeResult<T>` = `{ success: true; data } | { success: false; error }`:

```ts
const r = await embed.actions.getFields()
if (r.success) r.data.fields // typed FieldRecord[]
else r.error.code // a closed BridgeErrorCode
```

`embed.actions.*`: method names + arguments are camelCase (the snake_case wire is generated + transformed for you; [`/embed/json`](https://simplepdf.com/embed/json) or `@simplepdf/embed/schemas` carry every field):

```ts
await embed.actions.loadDocument({ dataUrl, name, page })
await embed.actions.goTo({ page: 3 })
await embed.actions.selectTool({ tool: 'TEXT' }) // 'CHECKBOX' | 'SIGNATURE' | 'PICTURE' | 'COMB_TEXT' | null
await embed.actions.detectFields()
await embed.actions.setFieldValue({ fieldId, value })
await embed.actions.deleteFields({ fieldIds }) // or { page }, or {} for all
await embed.actions.getDocumentContent({ extractionMode: 'auto' })
await embed.actions.submit({ downloadCopy: true })
await embed.actions.movePage({ fromPage: 2, toPage: 5 })
await embed.actions.deletePages({ pages: [3] })
await embed.actions.rotatePage({ page: 1 })
await embed.actions.download()
```

Full set: `createField`, `deleteFields`, `deletePages`, `detectFields`, `download`, `focusField`, `getDocumentContent`, `getFields`, `goTo`, `loadDocument`, `movePage`, `rotatePage`, `selectTool`, `setFieldValue`, `submit`.

**"Fill and read this document for me"** is just these operations in sequence, exactly what the agentic tools expose to a model:

```ts
const fields = await embed.actions.getFields() // read
await embed.actions.setFieldValue({ fieldId: 'f_full_name', value: 'Jane Doe' }) // fill
// walk the user to a signature: navigate → focus → open the signature tool
await embed.actions.goTo({ page: 3 })
await embed.actions.focusField({ fieldId: 'f_signature' })
await embed.actions.selectTool({ tool: 'SIGNATURE' })
```

## Events

`embed.events.on(type, handler)` subscribes to one editor event and hands the handler that event's payload VERBATIM (snake_case), the stable, established contract. It returns an unsubscribe function:

```ts
const off = embed.events.on('SUBMISSION_SENT', (data) => {
  data.document_id // + data.submission_id
})
off() // unsubscribe (all subscriptions also clear on lifecycle.dispose())

// The full set, each handler receives that event's typed payload:
embed.events.on('EDITOR_READY', () => {})
embed.events.on('DOCUMENT_LOADED', (data) => data.document_id)
embed.events.on('PAGE_FOCUSED', (data) => data) // { previous_page, current_page, total_pages }
embed.events.on('SUBMISSION_SENT', (data) => data) // { document_id, submission_id }
```

## Lifecycle

`embed.lifecycle.dispose()` tears down the bridge (removes the iframe in the container case; clears subscriptions + pending requests). Readiness (`booting → editorReady → documentLoaded`) is observable via the `EDITOR_READY` / `DOCUMENT_LOADED` events above.

## Errors

- **Construction** (programmer error): `createEmbed` throws `EmbedConfigError` synchronously. `code`: `invalid_config | invalid_target | invalid_company_identifier | invalid_document`.
- **Operations**: never throw; resolve to `BridgeResult`. `error.code` is a closed `BridgeErrorCode` (the bridge's transport / lifecycle codes union the editor's redacted set). `bad_request:missing_required_fields` carries typed `details`.

Prefer exceptions? `unwrap` returns `data` or throws:

```ts
import { unwrap } from '@simplepdf/embed'
const { fields } = unwrap(await embed.actions.getFields())
```

## React

Use [`@simplepdf/react-embed-pdf`](../react): `<EmbedPDF>` renders the iframe and `useEmbed()` returns `{ embedRef, actions }`; its opt-in `/ai-sdk` subpath adds `useEmbedTools(embedRef)` for the AI SDK. It is built on this core.

## Reference: the editor contract (the spec)

The single source of truth for the available operations and events can be found at **[`https://simplepdf.com/embed/json`](https://simplepdf.com/embed/json)**.

It describes every operation (its `request_type`, input/output JSON Schema, and per-operation error codes), the outbound events, the supported locales, and the **complete closed set of error codes**, each `code` carrying a plain-language description of its meaning. It is the iframe / `postMessage` counterpart to the REST API's OpenAPI spec at [`/api/json`](https://simplepdf.com/api/json).

## Generated code & the pinned contract

`embed-api.json` is a **pinned copy** of the manifest served at [`/embed/json`](https://simplepdf.com/embed/json). `scripts/generate.mjs` derives `src/generated/{contract,schemas,tools,drift}.ts` from it (run automatically on `prebuild` / `pretest`); `src/generated/drift.ts` holds compile-time guards that fail `tsc` the moment one generated representation diverges from another. Re-sync `embed-api.json` from `/embed/json` and run `npm run generate` when the contract changes. Do not hand-edit `src/generated/`.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run generate` | regenerate `src/generated/*` from `embed-api.json` |
| `npm run build` | generate + bundle (tsup, ESM + per-entry `.d.ts`) |
| `npm test` | generate + unit tests (vitest) |
| `npm run test:types` | `tsc --noEmit` |
| `npm run check:size` | build + enforce the per-entry gzip bundle budgets |

MIT licensed.
