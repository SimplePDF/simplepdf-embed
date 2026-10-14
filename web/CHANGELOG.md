# @simplepdf/web-embed-pdf

## 1.10.0

### Minor Changes

- c225115: **Fill several fields in one call: `batchSetFieldValues` sets every value at once, or none of them.**
  - `batchSetFieldValues({ updates: [{ fieldId, value }] })` applies every update in one step, reverted by a single undo in the editor, and resolves with no data.
  - If any update is rejected (an unknown field, an invalid option, a read-only field, an unreadable signature URL, the same field twice), nothing changes: the result fails with `bad_request:batch_validation_failed` and `error.details.failures` lists every rejected update with its `fieldId`, `code` and `message` (typed as `BatchValidationFailedDetails`).
  - Values follow the `setFieldValue` rules and are never typed out.
  - Available everywhere the editor operations are: `embed.actions.batchSetFieldValues`, `useEmbed().actions.batchSetFieldValues`, the `batchSetFieldValues` agentic tool on every tool subpath, and the `simplepdf_embed_batch_set_field_values` WebMCP tool, including on pages using `@simplepdf/web-embed-pdf`.

### Patch Changes

- c225115: **Smaller installs, leaner agent requests, readable stack traces.**
  - The agentic tools no longer repeat each tool's description inside its input schema: with the shorter descriptions below, a model request carrying all the AI SDK or TanStack AI tools sends about 3 KB less (24%) even with the new `batchSetFieldValues` tool, and the agentic entry points are 28 to 29% smaller.
  - Tool descriptions are about 24% shorter (900 fewer characters across the 16 tools of the previous release): they state behavior and leave the details to each parameter, permission notes are gone (a refused call answers with its error code), and they name no tool or key whose spelling differs between surfaces, so they read true whether your agent sees camelCase (AI SDK, TanStack AI) or snake_case (WebMCP). The signature `value` documents that plain text is drawn as a typed signature. `getAnnotatedPage` states that the WebMCP tool returns the render as an image block and the rest of the result as a text block.
  - Smaller installs: no source maps, so `@simplepdf/embed` unpacks to 248 KB instead of 596 KB and `@simplepdf/react-embed-pdf` to 74 KB instead of 110 KB. `@simplepdf/react-embed-pdf` is no longer minified, so an error inside it shows readable code in your devtools and error tracker; your bundler still minifies your app.
  - `@simplepdf/web-embed-pdf` drops its `browser` field, so bundlers resolve the readable `dist/index.js`; the script-tag build on unpkg stays minified.
  - The `/schemas` input schemas no longer carry the operation description at their root; read it from `SIMPLEPDF_TOOLS[name].description`, or from `OPERATIONS` in `@simplepdf/embed/protocol` for every operation including `loadDocument`.
- Updated dependencies [c225115]
- Updated dependencies [c225115]
  - @simplepdf/embed@0.9.0

## 1.9.1

### Patch Changes

- Updated dependencies [dbc84c1]
  - @simplepdf/embed@0.8.0

## 1.9.0

### Minor Changes

- 3afba3b: **Your pages are now ready for AI agents.** While the editor is open, an agent in your visitor's browser (ChatGPT's browser, Chrome with WebMCP) can read and fill the form, move between pages and submit it, with the same permissions as any other integration. It is on by default: add `webmcp="false"` to the script tag to turn it off.
  - **More PDF links open in SimplePDF**: `Report.PDF`, `form.pdf?v=2` and `guide.pdf#page=3` used to open in the browser.
  - **Japanese and Dutch**: pages in either language open the editor in that language.
  - **Stored documents open directly**: a link to a SimplePDF document (`/documents/<id>`) opens it in the editor.
  - **Clear errors for invalid company identifiers**: a value that cannot form an editor address (a URL, spaces, dots, underscores) logs an error and opens nothing. An identifier without an account still opens the editor, which explains the problem.
  - **Same script, same API**: now built on `@simplepdf/embed`, the engine behind the React component. `window.simplePDF`, the script-tag attributes and the modal are unchanged.
