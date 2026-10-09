---
'@simplepdf/embed': minor
---

**Fill text fields instantly: `setFieldValue` takes an optional `animate` flag.**
- `animate: false` sets a text value in one step and resolves right away, for headless or batch filling where speed matters.
- Omitted or `true` keeps today's behavior: the value is typed out character by character, so a person watching the editor can follow along.
- Checkbox, option, signature, picture and `null` values are always set at once.
- Available everywhere the operation is: `embed.actions.setFieldValue`, `useEmbed().actions.setFieldValue`, the `setFieldValue` agentic tool on every tool subpath, and the `simplepdf_embed_set_field_value` WebMCP tool.
- The contract follows the live editor: operations sent before a document is loaded answer `bad_request:no_document_loaded`, and `loadDocument` resolves once the document and its fields are ready, failing with the new `bad_request:failed_to_load_document` when the document cannot be loaded.
