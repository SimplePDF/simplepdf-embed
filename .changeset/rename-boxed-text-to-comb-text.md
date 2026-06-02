---
"@simplepdf/react-embed-pdf": major
---

Renames the `BOXED_TEXT` tool type to `COMB_TEXT`. "Comb" is the Acrobat / PDF-spec term for box-per-character fields (IBAN, dates, CERFA), so `actions.selectTool(...)` and the `SELECT_TOOL` iframe event now use `COMB_TEXT`, and the `ToolType` union exposes `COMB_TEXT` instead of `BOXED_TEXT`.

Already-deployed embeds keep working without a code change: the editor still accepts the legacy `BOXED_TEXT` value at runtime, so this only changes the TypeScript type. If you are not calling `actions.selectTool('BOXED_TEXT')` or `sendEvent("SELECT_TOOL", { tool: "BOXED_TEXT" })`, you can safely update to this new major version.

```ts
// Before
await actions.selectTool('BOXED_TEXT');

// After
await actions.selectTool('COMB_TEXT');
```
