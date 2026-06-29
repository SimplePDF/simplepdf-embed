---
"@simplepdf/embed": minor
"@simplepdf/react-embed-pdf": minor
---

Add a TanStack AI adapter (the `/tanstack-ai` subpath) for client-side tool calling, alongside the existing Vercel AI SDK (`/ai-sdk`) adapter. Both wrap the same generated tool registry + bridge router, so the editor is drivable from either SDK with no duplicated logic.

- `@simplepdf/embed/tanstack-ai`: `simplePDFTanstackToolDefinitions()` (server, for `chat({ tools })`) and `createSimplePDFTanstackTools({ embed })` (browser `.client()` tools for `clientTools(...)` then `useChat({ tools })`).
- `@simplepdf/react-embed-pdf/tanstack-ai`: `useEmbedTanstackTools(embedRef)`, the editor-bound client tools, plus the re-exported server definitions.
- `@tanstack/ai` is a new optional peer, pulled only by the `/tanstack-ai` subpath; the package roots stay free of it (and of `zod`).
