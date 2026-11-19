---
'@simplepdf/embed': minor
---

**`submit` tells you when a recipient link was already submitted: `forbidden:recipient_link_used`.**

- A recipient link (`?link=<id>`) takes one submission. A `submit` on a document opened through a link that has already been submitted (in another tab, by another person, or between opening and submitting) now fails with `forbidden:recipient_link_used` instead of the generic `unexpected:internal_error`.
- Nothing was sent, so do not retry. The editor keeps everything the person entered and shows a dialog saying the document was already submitted, with "Download your answers" when your configuration allows downloads.
- The code is part of the closed `BridgeErrorCode` / `EDITOR_ERROR_CODES` set and of the `submit` operation's `error_codes` in `@simplepdf/embed/protocol`, so an exhaustive `switch` over `error.code` now has one more case to handle.
