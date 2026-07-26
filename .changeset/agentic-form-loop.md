---
"@simplepdf/embed": minor
"@simplepdf/react-embed-pdf": minor
---

Make the full form-building loop drivable through the editor contract: detect, see, adjust, verify.

- **BREAKING — `create_field` coordinate semantics**: `x`/`y` are now the field's TOP-LEFT corner in PDF points with y growing DOWNWARD (previously the PDF-native bottom-left origin, y growing upward). This is the same convention `get_fields` reports, so created geometry now reads back identically — a create-then-read round-trip returns the numbers you passed.
- `get_fields` now returns each field's geometry (`x`, `y`, `width`, `height`), its comb cell layout for `COMB_TEXT` fields, and a `pages` array with every page's current 1-based position and displayed size in PDF points.
- `get_fields` accepts `include_annotated_pages` (plus an optional `pages` filter): returns PNG page renders with a numbered badge over every field and a `badges` (badge → `field_id`) map, so an agent can visually verify placement. Gated exactly like `get_document_content` (page renders are content reads).
- `create_field` accepts an optional `name` (the sidebar label) for every type, and an explicit `comb: { cell_offsets, cell_width }` layout for `COMB_TEXT` fields, validated so the layout round-trips verbatim.
- The undocumented `detect_fields` `debug_mode` diagnostic is gone from the wire.
