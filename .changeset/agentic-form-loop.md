---
"@simplepdf/embed": minor
"@simplepdf/react-embed-pdf": minor
---

Make the full form-building loop drivable through the editor contract: detect, see, adjust, verify.

- `get_fields` returns each field's `geometry` object (`x`, `y`, `width`, `height`, plus the comb cell layout for `COMB_TEXT` fields) in PDF points with a top-left origin (y grows downward), and a `pages` array with every page's current 1-based position and displayed size. `geometry` is `null` on plans without programmatic geometry access (Pro and above); ids, names, types, values, and page dimensions remain available for fill flows.
- `get_fields` accepts `include_annotated_pages` (plus an optional `pages` filter): returns PNG page renders with a numbered badge over every field and a `badges` (badge → `field_id`) map, so an agent can visually verify placement. Gated like `get_document_content` (page renders are content reads) and by the geometry plan gate.
- `create_field` places fields using the same top-left, y-down PDF-point convention `get_fields` reports, so a create-then-read round-trip returns the numbers you passed. It accepts an optional `name` (the sidebar label) for every type, and an explicit `comb: { cell_offsets, cell_width }` layout for `COMB_TEXT` fields. Requires a plan with programmatic geometry access.
