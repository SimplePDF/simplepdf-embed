---
'@simplepdf/embed': minor
'@simplepdf/react-embed-pdf': minor
---

Add `getAnnotatedPage({ page })` (the editor's `GET_ANNOTATED_PAGE`): a PNG render of one page with every field outlined and numbered, plus a `badges` map from each number to its `field_id`, so a vision model can label fields by looking at the printed form. Available as `embed.actions.getAnnotatedPage` / `useEmbed().actions.getAnnotatedPage`, as the `getAnnotatedPage` agentic tool on every tool subpath, and as a WebMCP tool (a reader: `readOnlyHint` + `untrustedContentHint`).

The contract pin follows the live manifest: `loadDocument` also accepts an http(s) URL the editor fetches and its description states that it discards the current document and every edit in it; `getFields` points agents at `get_annotated_page`.
