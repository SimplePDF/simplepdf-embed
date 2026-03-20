---
"@simplepdf/react-embed-pdf": major
---

Replaces `createField` with `detectFields` for automatic form field detection. This is a breaking change: the `createField` action and `CreateFieldOptions` type have been removed.

If you are not using `actions.createField(...)` or `sendEvent("CREATE_FIELD", ...)`, you can safely update to this new major version.

```ts
// Before (removed)
await actions.createField({ type: "TEXT", page: 1, x: 100, y: 700, width: 200, height: 30 });

// After
await actions.detectFields();
```
