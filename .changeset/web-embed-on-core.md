---
'@simplepdf/web-embed-pdf': minor
---

Rebuilt on `@simplepdf/embed`; `window.simplePDF`, the script-tag attributes and the modal are unchanged.

- WebMCP, off by default: add the `webmcp` attribute to the script tag, or call `setConfig({ webMCP: { enabled: true } })` (optionally with `exclude`), and an in-browser agent on your page finds the editor's tools while it is open.
- PDF links open in SimplePDF whatever the extension case, query string or fragment: `Consent.PDF`, `form.pdf?ver=2` and `guide.pdf#page=3` were left to the browser. Links already detected keep opening in SimplePDF.
- Japanese and Dutch pages open the editor in their language instead of English.
- A SimplePDF `/documents/<id>` link opens the stored document directly.
- An invalid `companyIdentifier` logs an error instead of opening an editor that cannot load.
