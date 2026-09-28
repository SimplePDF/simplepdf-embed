---
'@simplepdf/web-embed-pdf': minor
---

Rebuilt on `@simplepdf/embed`; `window.simplePDF`, the script-tag attributes and the modal are unchanged.

- WebMCP, on by default: while the editor is open, an in-browser agent on your page finds the editor's tools. Turn it off with `webmcp="false"` on the script tag or `setConfig({ webMCP: { enabled: false } })`; `exclude` withholds single operations.
- PDF links open in SimplePDF whatever the extension case, query string or fragment: `Consent.PDF`, `form.pdf?ver=2` and `guide.pdf#page=3` were left to the browser. Links already detected keep opening in SimplePDF.
- Japanese and Dutch pages open the editor in their language instead of English.
- A SimplePDF `/documents/<id>` link opens the stored document directly.
- A `companyIdentifier` that cannot form an editor address (a URL, spaces, dots, underscores) logs an error and opens nothing. An identifier with no account behind it still opens the editor, which shows its own error page, and uppercase keeps working.
