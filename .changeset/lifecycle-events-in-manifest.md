---
'@simplepdf/embed': minor
---

`EDITOR_READY` and `DOCUMENT_LOADED` now come from the editor manifest (`/embed/json` `events`), like `PAGE_FOCUSED` and `SUBMISSION_SENT`: `OUTBOUND_EVENTS` / `OutboundEventType` on `@simplepdf/embed/protocol` list all four (a widening: exhaustive consumers of `OutboundEventType` gain two members), and the root exports the `EditorReadyPayload` / `DocumentLoadedPayload` types. The `EditorEvent` shapes are unchanged.
