---
"@simplepdf/embed": minor
"@simplepdf/react-embed-pdf": minor
---

Add `enableWebMCP`: register the editor operations as WebMCP tools on the host page.

An in-browser agent (ChatGPT's browser, Chrome with WebMCP) discovers tools on the page it is looking at, not inside iframes. `createEmbed({ enableWebMCP: true })` and `<EmbedPDF enableWebMCP />` register every agentic operation on the page's `document.modelContext` (same names and camelCase inputs as `@simplepdf/embed/tools`) and forward each call to the editor over the bridge, so the agent reads and fills the document in the tab and the PDF never leaves the browser. `{ exclude: ['submit', ...] }` withholds operations so a person keeps the decision. Every tool carries an explicit behavior hint (`readOnlyHint` / `destructiveHint`), the editor validates each call like any other request, and `dispose()` unregisters everything. Off by default; the WebMCP code is loaded lazily, so an embedder that does not opt in downloads none of it.
