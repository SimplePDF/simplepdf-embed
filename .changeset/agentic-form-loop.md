---
"@simplepdf/embed": minor
"@simplepdf/react-embed-pdf": minor
---

Make the full form-building loop drivable through the editor contract: detect, see, adjust, verify.

- `get_fields` returns each field's `geometry` object (`x`, `y`, `width`, `height`, plus the comb cell layout for `COMB_TEXT` fields) in PDF points with a top-left origin (y grows downward), and a `pages` array with every page's current 1-based position and displayed size. Geometry is always present, alongside ids, names, types, and values.
- New `get_annotated_area` operation: renders a page (or a sub-area of it, with an optional `zoom`) as a PNG with a numbered badge over every field overlapping it, plus a `badges` (badge → `field_id`) map, so an agent can visually verify placement and zoom in on fine detail such as comb cells. Coordinates use the same top-left, y-down PDF-point convention as `get_fields`/`create_field`; the response echoes the rendered area and its pixel size. This is a Premium capability (`Plan.ENTERPRISE`) and, like `get_document_content`, requires the embedding origin to be whitelisted.
- `create_field` places fields using the same top-left, y-down PDF-point convention `get_fields` reports, so a create-then-read round-trip returns the numbers you passed. It accepts an explicit `comb: { cell_offsets, cell_width }` layout for `COMB_TEXT` fields.
