# PDF Form Copilot

> Form Copilot: AI that helps users fill PDF forms step by step.

Standalone TanStack Start app that combines the SimplePDF editor (left pane) with an AI chat sidebar (right pane). The assistant can read, fill, navigate, and submit the PDF through the SimplePDF iframe `postMessage` bridge.

- **Framework**: TanStack Start (Vite + Nitro)
- **PDF editor**: embedded iframe at `pdf-form-copilot.simplepdf.com`
- **LLM**: Claude Haiku 4.5 via the Vercel AI SDK (`ai` + `@ai-sdk/anthropic`), streamed through a TanStack Start server function
- **Tools**: executed client-side via iframe `postMessage` (no tool execution on the server)
- **Rate limit**: per-IP, in-memory (single-instance deploy)

This example doubles as a hosted demo and a reference implementation for consumers. See [`plans/P059-pdf-form-copilot.md`](../../../../plans/P059-pdf-form-copilot.md) in the parent repo for design notes.

## Running locally

```bash
npm install
cp .env.example .env     # add your ANTHROPIC_API_KEY before Phase 3
npm run dev              # http://localhost:3001
```

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start the dev server on port 3001 |
| `npm run build` | Production build |
| `npm run preview` | Preview the production build |
| `npm run test` | Run unit tests (Vitest) |
| `npm run check` | Biome format + lint check |

## Environment

| Variable | Required | Purpose |
|----------|----------|---------|
| `ANTHROPIC_API_KEY` | Phase 3+ | Server-only; passed to the Vercel AI SDK's Anthropic provider. Never exposed to the client bundle. |
| `VITE_SIMPLEPDF_COMPANY_IDENTIFIER` | No (defaults to `pdf-form-copilot`) | The `<company>.simplepdf.com` subdomain that serves the embedded editor. Exposed to the client because the iframe `src` is built browser-side. |

## Status

Scaffold only (Phase 1 of the plan). The chat sidebar is a placeholder until Phase 3 lands.
