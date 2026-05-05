# @simplepdf/react-embed-pdf

## 2.0.0

### Major Changes

- 4b86b72: Renames `actions.removeFields` to `actions.deleteFields` and the corresponding iframe event from `REMOVE_FIELDS` to `DELETE_FIELDS`. The result payload field is renamed from `removed_count` to `deleted_count`. Aligns naming with the new `DELETE_PAGES` event so all destructive operations use `delete_*` consistently.

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

- 9069558: Replaces `createField` with `detectFields` for automatic form field detection. This is a breaking change: the `createField` action and `CreateFieldOptions` type have been removed.

  If you are not using `actions.createField(...)` or `sendEvent("CREATE_FIELD", ...)`, you can safely update to this new major version.

  ```ts
  // Before (removed)
  await actions.createField({ type: 'TEXT', page: 1, x: 100, y: 700, width: 200, height: 30 });

  // After
  await actions.detectFields();
  ```

## 1.10.0

### Minor Changes

- cae5ce6: Adds new programmatic actions to the React embed component for advanced integrations: goTo, createField, removeFields, getDocumentContent
