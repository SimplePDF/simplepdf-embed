---
'@simplepdf/embed': patch
'@simplepdf/react-embed-pdf': patch
'@simplepdf/web-embed-pdf': patch
---

**PDFs over 50 MB now load from a URL like any other.** They used to skip the fetch from your page and go to the editor by URL, which failed for documents behind your login or only readable from your site. Documents of every size are now fetched from your page first, as smaller ones always were.
