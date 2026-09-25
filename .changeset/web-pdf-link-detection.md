---
'@simplepdf/web-embed-pdf': patch
---

Open PDF links in SimplePDF whatever the extension case, query string or fragment: `Consent.PDF`, `form.pdf?ver=2` and `guide.pdf#page=3` were left to the browser. Links already detected (a URL ending in `.pdf`, such as `download.php?file=form.pdf`) keep opening in SimplePDF.
