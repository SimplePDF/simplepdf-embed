---
"@simplepdf/react-embed-pdf": minor
---

Rebuilt on the `@simplepdf/embed` core, adding an AI-SDK-native agentic surface — a non-breaking superset of the 1.x component API.

`@simplepdf/react-embed-pdf` no longer hand-rolls its own iframe bridge; it is a thin React layer over the shared `@simplepdf/embed` core (the same core `web-embed-pdf` and future framework adapters sit on).

**The 1.x `<EmbedPDF>` contract is preserved (drop-in):** the props (`companyIdentifier`, `documentURL`, `mode` — still defaulting to `"modal"`, `onEmbedEvent`, `locale`, `baseDomain`, `context`, `className`, `style`) and, crucially, `onEmbedEvent` still emits the editor's events VERBATIM: `{ type: 'EDITOR_READY' | 'DOCUMENT_LOADED' | 'PAGE_FOCUSED' | 'SUBMISSION_SENT', data }` with snake_case payloads. `useEmbed()` still returns `{ embedRef, actions }`.

**New (additive):**

- A new opt-in `@simplepdf/react-embed-pdf/ai-sdk` subpath exposes the agentic surface: `useEmbedTools(embedRef)` binds the tool registry to the live editor for the Vercel AI SDK (`useChat({ tools })`), plus `simplePDFToolDefinitions` (server) and `createSimplePDFExecutor`. It mirrors `@simplepdf/embed`'s `/ai-sdk`, so the package root stays zod-free.
- `useEmbed().actions` now exposes the FULL editor surface (camelCase): `createField`, `getFields`, `setFieldValue`, `focusField`, `movePage`, `rotatePage`, `deletePages`, `download`, … — not just the original six.
- A typed `document` prop (`{ url } | { dataUrl } | { file }`), the same shape as `createEmbed`. It also accepts data URLs and File/Blob, and a SimplePDF documents URL loads directly (prefill etc.). `documentURL` is now `@deprecated` (still works) in favor of it.
- An optional `logger` prop surfaces the bridge's structured lifecycle/error logging.
- The forwarded `ref` (`embedRef.current`) stays the flat 1.x actions handle — `embedRef.current.selectTool(...)`, etc. — now exposing the full camelCase action set. (The framework-free `@simplepdf/embed` core groups its handle as `embed.actions` / `embed.events` / `embed.lifecycle`; the React layer flattens it to keep the 1.x ref contract.)

**Imperative actions stay backward-compatible.** `selectTool` and `submit` gained camelCase argument shapes to match the rest of the SDK (`selectTool({ tool })`, `submit({ downloadCopy })`), but the 1.x forms — `selectTool(toolType)` and `submit({ downloadCopyOnDevice })` — still work as deprecated overloads that normalize to the new shape, so existing `useEmbed().actions` callers don't change. A relative `documentURL` / trigger `href` (e.g. `/form.pdf`) is still accepted — it is resolved against the page URL, as in 1.x.

One behavioral note: calling an action before `<EmbedPDF>` has mounted now resolves to `{ success: false, error: { code: 'unexpected:iframe_not_mounted' } }` (1.x used `bad_request:embed_ref_not_available`). Code that checks `result.success` is unaffected; only code branching on the exact pre-mount error string needs updating.

Packaging is preserved: still dual CJS + ESM, so `require()` consumers keep working. `zod` remains a peer dependency, now required **only** by the agentic `/ai-sdk` subpath (it validates tool input) — the package root (`<EmbedPDF>`, `useEmbed`) is zod-free, so a non-agentic app never loads it. Install `zod` only if you import `/ai-sdk`; npm 7+ adds it automatically, pnpm / Yarn PnP users add it explicitly.
