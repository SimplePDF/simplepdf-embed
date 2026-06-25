---
"@simplepdf/embed": minor
---

Initial release of `@simplepdf/embed` — a typed, zero-dependency bridge over the SimplePDF editor's iframe / `postMessage` contract.

Its types, zod schemas, and agentic tool registry are generated from a pinned copy of the editor contract (`embed-api.json`), so the client cannot drift from the spec. Subpaths: root (`createEmbed` / `mountEmbed` + the closed error model + `unwrap`), `/protocol`, `/schemas` (zod), `/tools` (SDK-agnostic router + `isSimplePDFToolName`), `/ai-sdk` (`simplePDFToolDefinitions()` + `createSimplePDFExecutor()` for the Vercel AI SDK), and `/react` (`useIframeBridge`, `<EmbedPDF>`, `useEmbed`). The root entry carries no runtime dependencies (≤ 6 KB gzip); peer deps (`zod`, `react`) are confined to the subpaths that need them.
