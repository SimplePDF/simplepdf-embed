---
"@simplepdf/embed": minor
"@simplepdf/react-embed-pdf": minor
---

Add `enableWebMCP`: register the editor operations as WebMCP tools on the host page.

An in-browser agent (ChatGPT's browser, Chrome with WebMCP) discovers tools on the page it is looking at, not inside iframes. `createEmbed({ enableWebMCP: true })` and `<EmbedPDF enableWebMCP />` register every agentic operation on the page's `document.modelContext` (same names and camelCase inputs as `@simplepdf/embed/tools`) and forward each call to the editor over the bridge: the PDF bytes stay in the tab and reach no SimplePDF server, while what the agent reads (field values, extracted text) goes to the agent runtime the person attached. `{ exclude: ['submit', ...] }` withholds operations so a person keeps the decision (a malformed value throws `EmbedConfigError`). The readers carry the specification's `readOnlyHint` + `untrustedContentHint`, the other tools MCP's `destructiveHint`; each call resolves with an MCP tool result carrying the editor's Result (`isError` on failure); the editor validates each call like any other request; `dispose()` unregisters everything. Off by default: the WebMCP module loads lazily, once the editor is ready and only when the page exposes a model context, so nobody else downloads it. One WebMCP-enabled embed per page (tool names are page-level).
