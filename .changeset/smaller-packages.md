---
"@simplepdf/embed": minor
"@simplepdf/react-embed-pdf": patch
---

**Smaller installs and leaner agent requests.**

- The agentic tools no longer repeat each tool's description inside its input schema: every model request carrying all the AI SDK or TanStack AI tools sends about 4 KB less, and the agentic entry points are about 29% smaller.
- Tool descriptions are about 17% shorter (697 fewer characters across the 17 tools): `setFieldValue` and `batchSetFieldValues` leave the value rules to their `value` parameter, permission notes are gone (a refused call answers with its error code), and `getAnnotatedPage` states that the WebMCP tool returns the render as an image block and the rest of the result as a text block.
- `@simplepdf/embed` and `@simplepdf/react-embed-pdf` no longer ship source maps: `@simplepdf/embed` unpacks to 263 KB instead of 645 KB, `@simplepdf/react-embed-pdf` to 41 KB instead of 113 KB.
- The `/schemas` input schemas no longer carry the operation description at their root; read it from `SIMPLEPDF_TOOLS[name].description`, or from `OPERATIONS` in `@simplepdf/embed/protocol` for every operation including `loadDocument`.
