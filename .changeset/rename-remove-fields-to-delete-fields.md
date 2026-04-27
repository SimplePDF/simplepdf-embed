---
"@simplepdf/react-embed-pdf": major
---

Renames `actions.removeFields` to `actions.deleteFields` and the corresponding iframe event from `REMOVE_FIELDS` to `DELETE_FIELDS`. The result payload field is renamed from `removed_count` to `deleted_count`. Aligns naming with the new `DELETE_PAGES` event so all destructive operations use `delete_*` consistently.

If you are not using `actions.removeFields(...)` or `sendEvent("REMOVE_FIELDS", ...)`, you can safely update to this new major version.

```ts
// Before
const result = await actions.removeFields({ page: 1 });
if (result.success) {
  console.log(result.data.removed_count);
}

// After
const result = await actions.deleteFields({ page: 1 });
if (result.success) {
  console.log(result.data.deleted_count);
}
```
