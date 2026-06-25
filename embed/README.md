# @simplepdf/embed

A typed, zero-dependency client for embedding and programmatically driving the [SimplePDF](https://simplepdf.com) editor over its iframe / `postMessage` contract.

Types, schemas, and tools are **generated from a pinned copy of the editor's published manifest** ([`/embed/json`](https://simplepdf.com/embed/json)), so the client cannot drift from the contract.

## Install

```bash
npm install @simplepdf/embed
```

Zero runtime dependencies at the root. Optional peers (`zod`, `react`, `react-dom`) are needed only by the subpaths that use them. `/ai-sdk` produces values for the Vercel AI SDK but never imports `ai`; bring your own.

## Subpaths

| Import | Purpose | Peer |
| --- | --- | --- |
| `@simplepdf/embed` | `mountEmbed`, `createEmbed`, the `Embed` handle, the closed error model + `BridgeResult` types, `unwrap`, `NOOP_LOGGER` | none |
| `@simplepdf/embed/protocol` | wire operation/event constants | none |
| `@simplepdf/embed/schemas` | zod schema for every operation input | `zod` |
| `@simplepdf/embed/tools` | SDK-agnostic agentic tool registry + `routeToolCall` + `isSimplePDFToolName` | `zod` |
| `@simplepdf/embed/ai-sdk` | `simplePDFToolDefinitions()` (server) + `createSimplePDFExecutor({ embed })` (browser) for the Vercel AI SDK | `zod` |
| `@simplepdf/embed/react` | `<EmbedPDF>`, `useEmbed`, `useIframeBridge` | `react`, `react-dom` |

## Conventions

One deliberate naming boundary, so nothing surprises you:

- **Package config is camelCase** (the JS idiom): `mountEmbed` / `createEmbed` options and callbacks. `tenant`, `baseDomain`, `iframeAttrs`, `getIframe`, `onDispose`, the `document` arms.
- **Editor operations are snake_case**, verbatim from the contract: every method input/output on the `embed` handle and every event payload. `data_url`, `download_copy`, `field_ids`, `document_id`.

The operation surface is byte-for-byte [`/embed/json`](https://simplepdf.com/embed/json) and the raw `postMessage` wire, so what you (or an agent) read in the spec is exactly what you send. The editor owns all validation and FIFO ordering; the bridge just posts, correlates by `request_id`, and times out a dead iframe. Every method resolves to a `BridgeResult<T>` and never throws; only construction errors (bad config) throw, synchronously.

## Quick start

`mountEmbed` builds the editor iframe and appends it to a container you provide:

```html
<div id="editor" style="height: 100vh"></div>
```

```ts
import { mountEmbed } from '@simplepdf/embed'

const embed = mountEmbed({
  target: '#editor', // a CSS selector, or the HTMLElement itself
  tenant: 'acme', // your companyIdentifier
  document: { url: 'https://example.com/form.pdf' },
})

embed.on('submission_sent', ({ document_id, submission_id }) => {
  console.log('submitted', document_id, submission_id)
})

const fields = await embed.getFields()
if (fields.success) {
  fields.data.fields // typed FieldRecord[]
}
```

## Mounting

| You want | Use |
| --- | --- |
| We create + insert the iframe | `mountEmbed({ target, … })` |
| You render the iframe yourself | `createEmbed({ getIframe, editorOrigin })` |
| React | `@simplepdf/embed/react` (below) |

```ts
import { createEmbed } from '@simplepdf/embed'

const embed = createEmbed({
  getIframe: () => document.querySelector('iframe'), // re-read on every access
  editorOrigin: 'https://acme.simplepdf.com',
})
```

### `mountEmbed` options

| Option | Type | Notes |
| --- | --- | --- |
| `target` | `string \| HTMLElement` | **required**: container selector or element, resolved once |
| `tenant` | `string` | your companyIdentifier (the `<tenant>.simplepdf.com` subdomain) |
| `document` | `{ url } \| { dataUrl } \| { file }` | initial document (see below) |
| `baseDomain` | `string` | editor base domain (default `https://simplepdf.com`) |
| `locale` | `Locale` | editor UI language |
| `context` | `object` | opaque data echoed back on submissions |
| `iframeAttrs` | `{ title, allow, sandbox, className, style }` | passthrough iframe attributes |
| `logger` | `BridgeLogger` | structured logs (ids + timing only, never payloads) |

`createEmbed` takes `{ getIframe, editorOrigin, logger?, onDispose? }` instead.

## Document source

`document` takes exactly one source, plus optional `name` and `page`:

```ts
mountEmbed({ target, tenant: 'acme', document: { url: 'https://…/form.pdf' } })
mountEmbed({ target, tenant: 'acme', document: { dataUrl: 'data:application/pdf;base64,…' } })
mountEmbed({ target, tenant: 'acme', document: { file: pdfFileOrBlob } })
```

- **`url`**: any `http(s)` URL. Fetched from your page first (50 MB cap); on CORS / size / network failure it falls back to the editor's `?open` loader, so CORS-restricted public URLs still load. `user:pass@` credentials are allowed (they route via `?open`, since `fetch()` can't use them).
- **`file`**: a `File` (e.g. from `<input type="file">`) or any `Blob`. Converted for you, no `FileReader`.
- **`dataUrl`**: a `data:` URL string.

Misuse fails fast with the fix in the message: a `Blob` in `url` tells you to use `{ file }`, a data URL in `url` tells you to use `{ dataUrl }`, a string in `file` tells you to use `{ url }` / `{ dataUrl }`.

## Actions

Every call resolves to `BridgeResult<T>` = `{ success: true; data } | { success: false; error }`:

```ts
const r = await embed.getFields()
if (r.success) r.data.fields // typed FieldRecord[]
else r.error.code // a closed BridgeErrorCode
```

Inputs are the snake_case wire shapes ([`/embed/json`](https://simplepdf.com/embed/json) or `@simplepdf/embed/schemas` carry every field):

```ts
await embed.loadDocument({ data_url, name, page })
await embed.goTo({ page: 3 })
await embed.selectTool({ tool: 'TEXT' }) // 'CHECKBOX' | 'SIGNATURE' | 'PICTURE' | 'COMB_TEXT' | null
await embed.detectFields()
await embed.setFieldValue({ field_id, value })
await embed.deleteFields({ field_ids }) // or { page }, or {} for all
await embed.getDocumentContent({ extraction_mode: 'auto' })
await embed.submit({ download_copy: true })
await embed.movePage({ from_page: 2, to_page: 5 })
await embed.deletePages({ pages: [3] })
await embed.rotatePage({ page: 1 })
await embed.download()
```

Full set: `createField`, `deleteFields`, `deletePages`, `detectFields`, `download`, `focusField`, `getDocumentContent`, `getFields`, `goTo`, `loadDocument`, `movePage`, `rotatePage`, `selectTool`, `setFieldValue`, `submit`. Lifecycle: `embed.state` / `embed.getState()` (`booting → editor_ready → document_loaded`), `embed.iframe`, `embed.dispose()`.

## Events

```ts
const off = embed.on('submission_sent', ({ document_id, submission_id }) => {})
embed.on('page_focused', ({ previous_page, current_page, total_pages }) => {})
embed.on('state_change', (state) => {})
embed.on('disposed', () => {})
off() // unsubscribe (all subscriptions also clear on dispose)
```

## Errors

- **Construction** (programmer error): `mountEmbed` throws `EmbedConfigError` synchronously. `code`: `invalid_target | invalid_tenant | invalid_document`.
- **Operations**: never throw; resolve to `BridgeResult`. `error.code` is a closed `BridgeErrorCode` (the bridge's transport / lifecycle codes union the editor's redacted set). `bad_request:missing_required_fields` carries typed `details`.

Prefer exceptions? `unwrap` returns `data` or throws:

```ts
import { unwrap } from '@simplepdf/embed'
const { fields } = unwrap(await embed.getFields())
```

## React

```tsx
import { EmbedPDF, useEmbed } from '@simplepdf/embed/react'

const embedRef = useEmbed() // RefObject<Embed | null>, for imperative calls

<EmbedPDF
  ref={embedRef}
  tenant="acme"
  document={{ url }}
  onSubmissionSent={({ submission_id }) => {}}
  onStateChange={(state) => {}}
  style={{ height: '100vh' }}
/>

await embedRef.current?.submit({ download_copy: true })
```

Rendering the iframe yourself? `useIframeBridge({ iframeRef, editorOrigin })` returns `{ bridge, bridgeState }`.

## Agentic / tool-calling

Drive the editor from an LLM. Tool inputs are the same snake_case wire shapes, so the model generates exactly what the editor accepts.

```ts
// server (Vercel AI SDK): execute-less tool definitions
import { simplePDFToolDefinitions } from '@simplepdf/embed/ai-sdk'
streamText({ model, tools: simplePDFToolDefinitions() })

// browser: a bridge-bound executor for onToolCall
import { createSimplePDFExecutor } from '@simplepdf/embed/ai-sdk'
const execute = createSimplePDFExecutor({ embed })
```

`@simplepdf/embed/tools` exposes the same registry SDK-agnostically (`routeToolCall`, `isSimplePDFToolName`).

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
