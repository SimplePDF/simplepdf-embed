---
'@simplepdf/web-embed-pdf': minor
---

**Your pages are now ready for AI agents.** While the editor is open, an agent in your visitor's browser (ChatGPT's browser, Chrome with WebMCP) can read and fill the form, move between pages and submit it, with the same permissions as any other integration. It is on by default: add `webmcp="false"` to the script tag to turn it off.

- **More PDF links open in SimplePDF**: `Report.PDF`, `form.pdf?v=2` and `guide.pdf#page=3` used to open in the browser.
- **Japanese and Dutch**: pages in either language open the editor in that language.
- **Stored documents open directly**: a link to a SimplePDF document (`/documents/<id>`) opens it in the editor.
- **Clear errors for invalid company identifiers**: a value that cannot form an editor address (a URL, spaces, dots, underscores) logs an error and opens nothing. An identifier without an account still opens the editor, which explains the problem.
- **Same script, same API**: now built on `@simplepdf/embed`, the engine behind the React component. `window.simplePDF`, the script-tag attributes and the modal work exactly as before.
