---
"@simplepdf/embed": minor
"@simplepdf/react-embed-pdf": minor
---

Add a TanStack AI adapter (the `/tanstack-ai` subpath) for client-side tool calling, alongside the existing Vercel AI SDK (`/ai-sdk`) adapter. Both wrap the same generated tool registry + bridge router, so the editor is drivable from either SDK with no duplicated logic.

- `@simplepdf/embed/tanstack-ai`: `simplePDFToolDefinitions()` (server, for `chat({ tools })`) and `createSimplePDFTools({ embed })` (browser `.client()` tools for `clientTools(...)` then `useChat({ tools })`).
- `@simplepdf/react-embed-pdf/tanstack-ai`: `useEmbedTools(embedRef)`, the editor-bound client tools. Server definitions stay in the React-free core `@simplepdf/embed/tanstack-ai`, so a server route never pulls React in.
- `@tanstack/ai` is a new optional peer, pulled only by the `/tanstack-ai` subpath; the package roots stay free of it (and of `zod`).
- `@simplepdf/react-embed-pdf` `/ai-sdk` no longer re-exports `simplePDFToolDefinitions`; import the server-side definitions from the React-free core `@simplepdf/embed/ai-sdk` (re-exporting them from the React package pulled React into server routes). The browser-side `createSimplePDFExecutor` is still re-exported, so both React adapters are consistent: server defs live only in the core. Released as a minor: the only consumer is copilot, updated in lockstep.
