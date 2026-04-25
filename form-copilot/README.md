<br/>
<br/>
<div align="center">
  <a href="https://simplepdf.com" target="_blank">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://cdn.simplepdf.com/simple-pdf/assets/simplepdf-github-white.png?">
    <img src="https://cdn.simplepdf.com/simple-pdf/assets/simplepdf-github.png?" width="280" alt="Logo"/>
  </picture>
  </a>
</div>
<br/>
<div align="center">
AI that helps users fill PDF forms step by step, inside the SimplePDF editor.
</div>
<br/>
<br/>
<p align="center">
<br/>
<a href="https://form-copilot.simplepdf.com" rel="dofollow"><strong>Try the live demo »</strong></a>
<br/>
<br/>
<a href="https://simplepdf.com/pricing">Pricing</a>
  ·
<a href="https://discord.gg/n6M8jb5GEP">Join our Discord</a>
  ·
<a href="https://twitter.com/simple_pdf">Follow us on Twitter</a>
</p>
<br/>
<br/>

<p align="center">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-purple" alt="License: MIT"></a>
  <a href="https://simplepdf.com/pricing"><img src="https://img.shields.io/badge/SimplePDF-Premium-amber" alt="Powered by SimplePDF Premium"></a>
</p>

---

## About

Form Copilot is a turn-key, MIT-licensed reference implementation that pairs the SimplePDF editor with an AI chat sidebar. The assistant reads the document, fills fields, navigates pages, and submits the PDF, all through the SimplePDF iframe `postMessage` bridge.

Fork it, drop in your own `companyIdentifier`, wire up your AI provider, and ship Form Copilot inside your product without writing the iframe bridge, tool plumbing, or streaming chat from scratch.

## See it live

The hosted demo at **<https://form-copilot.simplepdf.com>** runs on SimplePDF [**Premium**](https://simplepdf.com/pricing). It relies on two Premium-only capabilities:

- **White-labelling** — embed the editor with your own chrome (no SimplePDF branding)
- **Programmatic control** — drive the editor over the iframe `postMessage` API (load documents, fill fields, switch tools, submit)

To run this code on your own domain, you need a SimplePDF account that includes those capabilities. [Compare plans →](https://simplepdf.com/pricing)

## How it works

```
Browser
  ┌─ Chat sidebar (Form Copilot)
  │     │
  │     └─ postMessage ──> SimplePDF editor iframe
  │
  └─ /api/chat ──> your server
                     └─ Vercel AI SDK ──> Anthropic / OpenAI / DeepSeek
```

- The PDF editor renders inside the SimplePDF iframe — **PDF data never leaves the browser**
- Form Copilot drives the editor through `postMessage` (focus a field, set a value, navigate, submit)
- LLM streaming runs through your server via the Vercel AI SDK; you choose the provider
- Tool calls are executed in the browser, against the iframe — your server only proxies the chat stream

## Built with

- [SimplePDF](https://simplepdf.com) — the embedded PDF editor
- [TanStack Start](https://tanstack.com/start) — React 19, Vite, Nitro fullstack
- [Vercel AI SDK](https://sdk.vercel.ai) — `streamText` + tool calling
- [Anthropic](https://anthropic.com), [OpenAI](https://openai.com), [DeepSeek](https://deepseek.com), or any AI SDK provider
- [Tailwind CSS](https://tailwindcss.com)
- [Biome](https://biomejs.dev) (lint + format), [Vitest](https://vitest.dev) (tests)

## Getting started

### Prerequisites

- Node.js 24.x
- A SimplePDF [Premium](https://simplepdf.com/pricing) account (for white-labelling + programmatic control on your domain)
- An API key from your AI provider of choice

### Setup

1. Clone this directory (or fork the [parent repo](https://github.com/SimplePDF/simplepdf-embed))

2. Install dependencies:

   ```sh
   npm install
   ```

3. Create your `.env`:

   ```sh
   cp .env.example .env
   ```

   Required:

   - `VITE_SIMPLEPDF_COMPANY_IDENTIFIER` — your SimplePDF company subdomain
   - `VITE_SIMPLEPDF_BASE_DOMAIN` — `https://simplepdf.com`

   Then add your serving origin (e.g. `https://app.example.com`) to the embed whitelist in your SimplePDF dashboard. The iframe will refuse to load on origins that aren't whitelisted.

4. Run:

   ```sh
   npm run dev          # http://localhost:3001
   ```

### Wire up your AI provider

Server-side streaming lives in `src/routes/api/chat.ts`. Replace the bundled key resolution with whatever your app uses (env var, secret manager, per-tenant config) and pick a provider in `src/server/language_model.ts`. The Vercel AI SDK abstracts everything behind `streamText`.

If you want users to bring their own keys (BYOK), the browser-direct path in `src/lib/byok/` runs `streamText` straight from the browser to the provider — your server is bypassed entirely.

## Tools exposed to the LLM

The chat sidebar advertises these tools to the model. Each runs inside the iframe via `postMessage`; the server only proxies the stream.

| Tool | Purpose |
|------|---------|
| `get_fields` | List form fields currently on the document |
| `get_document_content` | Extract text content per page |
| `detect_fields` | Auto-detect missing fields on scanned PDFs |
| `focus_field` | Highlight + scroll to a field |
| `set_field_value` | Write a value into a field |
| `select_tool` | Switch the editor toolbar (TEXT, CHECKBOX, SIGNATURE, etc.) |
| `go_to_page` | Navigate pages |
| `submit_download` | Finalize and download the filled PDF |

Tool input + output schemas: `src/lib/embed-bridge-adapters/client-tools.ts`. System prompt: `src/server/tools.ts`.

## Common fork points

| File | What lives there |
|------|------------------|
| `src/server/tools.ts` | System prompt + tool registry |
| `src/server/language_model.ts` | AI provider wiring |
| `src/components/chat_pane.tsx` | Chat UI + streaming + tool routing |
| `src/lib/byok/` | Browser-direct provider plumbing (delete if you don't need BYOK) |
| `src/locales/` | 22 locale files (en / fr / de / es / it / pt / nl / ja / …) |
| `src/forms/` | Sample forms — replace with your own |
| `src/routes/__root.tsx` | `<head>` (title, meta, favicon) |

## Privacy by design

The architecture is deliberate:

- **Document data stays in the browser.** SimplePDF processes PDFs client-side. The iframe never uploads document bytes to SimplePDF.
- **Chat traffic flows through your server.** You control the provider, the keys, the logs, and any RAG / internal data layered in.
- **Submission is direct to your storage.** On Premium with [Bring Your Own Storage](https://simplepdf.com/pricing) (S3, Azure Blob, or SharePoint), completed PDFs upload from the browser to your bucket — never to SimplePDF servers.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build (Nitro `node-server` preset) |
| `npm start` | Run the production build |
| `npm run preview` | Preview the production build via Vite |
| `npm test` | Run Vitest unit tests |
| `npm run check` | Biome format + lint |

## License

MIT — see [LICENSE](./LICENSE). Use it, fork it, ship it inside your product.

The MIT license covers this code. The SimplePDF editor itself is a hosted service — running this app on your own domain requires a SimplePDF account with white-labelling and programmatic control. [See pricing →](https://simplepdf.com/pricing)
