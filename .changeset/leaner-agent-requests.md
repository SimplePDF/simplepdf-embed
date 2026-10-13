---
"@simplepdf/embed": minor
"@simplepdf/react-embed-pdf": patch
"@simplepdf/web-embed-pdf": patch
---

**Smaller installs, leaner agent requests, readable stack traces.**

- The agentic tools no longer repeat each tool's description inside its input schema: every model request carrying all the AI SDK or TanStack AI tools sends about 4 KB less, and the agentic entry points are about 29% smaller.
- Tool descriptions are about 17% shorter (697 fewer characters across the 17 tools): `setFieldValue` and `batchSetFieldValues` leave the value rules to their `value` parameter, permission notes are gone (a refused call answers with its error code), and `getAnnotatedPage` states that the WebMCP tool returns the render as an image block and the rest of the result as a text block.
- Smaller installs: no source maps, so `@simplepdf/embed` unpacks to 248 KB instead of 596 KB and `@simplepdf/react-embed-pdf` to 74 KB instead of 110 KB. `@simplepdf/react-embed-pdf` is no longer minified, so an error inside it shows readable code in your devtools and error tracker; your bundler still minifies your app.
- `@simplepdf/web-embed-pdf` drops its `browser` field, so bundlers resolve the readable `dist/index.js`; the script-tag build on unpkg stays minified.
- The `/schemas` input schemas no longer carry the operation description at their root; read it from `SIMPLEPDF_TOOLS[name].description`, or from `OPERATIONS` in `@simplepdf/embed/protocol` for every operation including `loadDocument`.
