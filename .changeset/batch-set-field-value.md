---
"@simplepdf/embed": minor
"@simplepdf/react-embed-pdf": minor
"@simplepdf/web-embed-pdf": minor
---

**Fill several fields in one call: `batchSetFieldValues` sets every value at once, or none of them.**
- `batchSetFieldValues({ updates: [{ fieldId, value }] })` applies every update in one step, reverted by a single undo in the editor, and resolves with no data.
- If any update is rejected (an unknown field, an invalid option, a read-only field, an unreadable signature URL, the same field twice), nothing changes: the result fails with `bad_request:batch_validation_failed` and `error.details.failures` lists every rejected update with its `fieldId`, `code` and `message` (typed as `BatchValidationFailedDetails`).
- Values follow the `setFieldValue` rules and are never typed out.
- Available everywhere the editor operations are: `embed.actions.batchSetFieldValues`, `useEmbed().actions.batchSetFieldValues`, the `batchSetFieldValues` agentic tool on every tool subpath, and the `simplepdf_embed_batch_set_field_values` WebMCP tool, including on pages using `@simplepdf/web-embed-pdf`.
