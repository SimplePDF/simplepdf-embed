---
"@simplepdf/embed": minor
"@simplepdf/react-embed-pdf": patch
"@simplepdf/web-embed-pdf": patch
---

**Smaller installs, leaner agent requests, readable stack traces.**
- The agentic tools no longer repeat each tool's description inside its input schema: with the shorter descriptions below, a model request carrying all the AI SDK or TanStack AI tools sends about 3 KB less (24%) even with the new `batchSetFieldValues` tool, and the agentic entry points are 28 to 29% smaller.
- Tool descriptions are about 24% shorter (900 fewer characters across the 16 tools of the previous release): they state behavior and leave the details to each parameter, permission notes are gone (a refused call answers with its error code), and they name no tool or key whose spelling differs between surfaces, so they read true whether your agent sees camelCase (AI SDK, TanStack AI) or snake_case (WebMCP). The signature `value` documents that plain text is drawn as a typed signature. `getAnnotatedPage` states that the WebMCP tool returns the render as an image block and the rest of the result as a text block.
- Smaller installs: no source maps, so `@simplepdf/embed` unpacks to 248 KB instead of 596 KB and `@simplepdf/react-embed-pdf` to 74 KB instead of 110 KB. `@simplepdf/react-embed-pdf` is no longer minified, so an error inside it shows readable code in your devtools and error tracker; your bundler still minifies your app.
- `@simplepdf/web-embed-pdf` drops its `browser` field, so bundlers resolve the readable `dist/index.js`; the script-tag build on unpkg stays minified.
- The `/schemas` input schemas no longer carry the operation description at their root; read it from `SIMPLEPDF_TOOLS[name].description`, or from `OPERATIONS` in `@simplepdf/embed/protocol` for every operation including `loadDocument`.
