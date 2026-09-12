---
"@simplepdf/embed": minor
"@simplepdf/react-embed-pdf": minor
---

Add `webMCP`: register the editor operations as WebMCP tools on the host page.

An in-browser agent (ChatGPT's browser, Chrome with WebMCP) discovers tools on the page it is looking at, not inside iframes. `createEmbed({ webMCP: { enabled: true } })` and `<EmbedPDF webMCP={{ enabled: true }} />` register every operation on the page's `document.modelContext` and forward each call to the editor over the bridge: the PDF bytes stay in the tab and reach no SimplePDF server, while what the agent reads (field values, extracted text, a page render) goes to the agent runtime the person attached. Each tool is the record the editor publishes in its manifest and registers on its own page (the `simplepdf_embed_*` name, description, snake_case input schema and behavior hints), so a page gets the same tools whether the editor is embedded or opened directly. `exclude: ['submit', ...]` withholds operations by SDK method name so a person keeps the decision (a malformed value throws `EmbedConfigError`). Each call resolves with an MCP tool result carrying the editor's wire-shaped Result (`isError` on failure; the annotated page render as an `image` block); the editor validates each call like any other request; `dispose()` unregisters everything. Off by default (`{ enabled: false }` and omitting the option are the same): the WebMCP module loads lazily, once the editor is ready and only when the page exposes a model context, so nobody else downloads it. One WebMCP-enabled embed per page (tool names are page-level).
