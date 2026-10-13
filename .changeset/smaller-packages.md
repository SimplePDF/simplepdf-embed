---
"@simplepdf/embed": minor
"@simplepdf/react-embed-pdf": patch
---

**Smaller installs and leaner agent requests.**

- The agentic tools no longer repeat each tool's description inside its input schema: every model request through the AI SDK or TanStack AI tools sends about 3.7 KB less, and the tool entries are about 28% smaller.
- The packages no longer ship source maps: `@simplepdf/embed` unpacks to 263 KB instead of 645 KB, `@simplepdf/react-embed-pdf` to 41 KB instead of 113 KB.
- The `/schemas` input schemas no longer carry the operation description at their root; read it from `SIMPLEPDF_TOOLS[name].description`, or from `OPERATIONS` in `@simplepdf/embed/protocol` for every operation including `loadDocument`.
