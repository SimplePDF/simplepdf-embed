# @simplepdf/embed

A typed, zero-dependency client for embedding and programmatically driving the [SimplePDF](https://simplepdf.com) editor over its iframe/`postMessage` contract.

The editor's interface contract (operations, events, locales, error codes) is published as a machine-readable manifest. This package is a thin, typed wrapper over that contract — its types, schemas, and tools are **generated from a pinned copy of the manifest** (`embed-api.json`), so the generated client cannot drift from that pinned contract. (The pinned copy is re-synced from the editor on each release — see "Generated code & the pinned contract" below.)

## Install

```bash
npm install @simplepdf/embed
```

The root entry has **zero runtime dependencies**. The optional peers (`zod`, `react`, `react-dom`) are only needed for the subpaths that use them. The `/ai-sdk` subpath produces values for the Vercel AI SDK but never imports it — bring your own `ai` install.

## Subpaths

| Import | Purpose | Peer |
| --- | --- | --- |
| `@simplepdf/embed` | `mountEmbed`, `createBridge`, the `Embed` handle, the closed error model, `unwrap`-free `BridgeResult` types, `isBridgeResultLike`, `NOOP_LOGGER` | none |
| `@simplepdf/embed/protocol` | wire operation/event constants + the internal protocol frames | none |
| `@simplepdf/embed/schemas` | zod schemas for every operation input | `zod` |
| `@simplepdf/embed/tools` | SDK-agnostic agentic tool registry + router + `isSimplePDFToolName` | `zod` |
| `@simplepdf/embed/ai-sdk` | `simplePDFToolDefinitions()` (server, execute-less) + `createSimplePDFExecutor({ embed })` (browser) for the Vercel AI SDK | `zod` |
| `@simplepdf/embed/react` | `useIframeBridge`, `<EmbedPDF>`, `useEmbed` | `react`, `react-dom` |
| `@simplepdf/embed/unwrap` | opt-in `Result` → throw helper | none |

## Quick start

```ts
import { mountEmbed } from '@simplepdf/embed'

const embed = mountEmbed({
  target: '#editor',
  tenant: 'acme', // your companyIdentifier
  document: { url: 'https://example.com/form.pdf' },
})

embed.on('submission_sent', ({ document_id, submission_id }) => {
  console.log('submitted', document_id, submission_id)
})

const fields = await embed.getFields()
if (fields.success) {
  // fields.data.fields: typed FieldRecord[]
}
```

Every method returns a typed `BridgeResult<T>` (a `{ success: true; data }` / `{ success: false; error }` union) and never throws. `mountEmbed` validates its construction config synchronously and throws an `EmbedConfigError` on programmer error (bad target/tenant/document URL).

## Design

- **The editor owns the logic; the bridge is thin.** The editor validates input, orders requests (FIFO), and always replies with a typed `Result`. The bridge just posts the request, correlates the reply by `request_id`, and times out a dead iframe. The root carries no validator (and so no zod) — input validation lives at the editor, with an additional zod pre-flight only at the agentic `/tools` boundary.
- **Closed, typed error union.** `BridgeErrorCode = BridgeOwnedErrorCode | EditorErrorCode`. The editor codes are generated from the manifest's customer-facing (redacted) set; the bridge owns the transport/lifecycle codes.

## Generated code & the pinned contract

`embed-api.json` is a **pinned copy** of the editor's published interface manifest (`client/lib/iframe/embed-api.json` in the SimplePDF monorepo). `scripts/generate.mjs` derives `src/generated/{contract,schemas,tools,drift}.ts` from it; the codegen runs automatically on `prebuild` and `pretest`. `src/generated/drift.ts` holds compile-time guards that fail `tsc` the moment a generated representation diverges from another.

When the editor contract changes, re-sync the pinned `embed-api.json` from the editor and run `npm run generate`. Do not hand-edit anything under `src/generated/`.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run generate` | regenerate `src/generated/*` from `embed-api.json` |
| `npm run build` | generate + bundle (tsup, ESM + per-entry `.d.ts`) |
| `npm test` | generate + unit tests (vitest) |
| `npm run test:types` | `tsc --noEmit` |
| `npm run check:size` | build + enforce the per-entry gzip bundle budgets |

MIT licensed.
