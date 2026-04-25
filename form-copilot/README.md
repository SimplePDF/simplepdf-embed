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
<a href="https://cloud.digitalocean.com/apps/new?repo=https://github.com/SimplePDF/simplepdf-embed/tree/main"><img src="https://www.deploytodo.com/do-btn-blue.svg" alt="Deploy to DigitalOcean" /></a>
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
  <a href="https://simplepdf.com/pricing"><img src="https://img.shields.io/badge/SimplePDF-Pro-amber" alt="Powered by SimplePDF Pro"></a>
</p>

---

## About

Form Copilot is a turn-key, MIT-licensed reference implementation that pairs the SimplePDF editor with an AI chat sidebar. The assistant reads the document, fills fields, navigates pages, and submits the PDF, all through the SimplePDF iframe `postMessage` bridge.

Fork it, drop in your own `companyIdentifier`, wire up your AI provider, and ship Form Copilot inside your product without writing the iframe bridge, tool plumbing, or streaming chat from scratch.

## See it live

The hosted demo at **<https://form-copilot.simplepdf.com>** runs on SimplePDF [**Pro**](https://simplepdf.com/pricing). It relies on two capabilities available on the Pro plan and above:

- **White-labelling**: embed the editor with your own chrome (no SimplePDF branding)
- **Programmatic control**: drive the editor over the iframe `postMessage` API (load documents, fill fields, switch tools, submit)

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

- The PDF editor renders inside the SimplePDF iframe. **PDF data never leaves the browser.**
- Form Copilot drives the editor through `postMessage` (focus a field, set a value, navigate, submit)
- LLM streaming runs through your server via the Vercel AI SDK; you choose the provider
- Tool calls are executed in the browser, against the iframe. Your server only proxies the chat stream.

## Built with

- [SimplePDF](https://simplepdf.com): the embedded PDF editor
- [TanStack Start](https://tanstack.com/start): React 19, Vite, Nitro fullstack
- [Vercel AI SDK](https://sdk.vercel.ai): `streamText` + tool calling
- [Anthropic](https://anthropic.com), [OpenAI](https://openai.com), [DeepSeek](https://deepseek.com), or any AI SDK provider
- [Tailwind CSS](https://tailwindcss.com)
- [Biome](https://biomejs.dev) (lint + format), [Vitest](https://vitest.dev) (tests)

## Getting started

> [!TIP]
> Using Claude Code, Codex, or another agentic coding tool? Point it at [`skills/fork-and-go/SKILL.md`](./skills/fork-and-go/SKILL.md) and it will walk you through the entire fork → configure → deploy journey one question at a time. The skill is tool-agnostic markdown; works anywhere your AI assistant can read project files.

### Run the demo locally (no SimplePDF account needed)

> [!TIP]
> The demo runs **as-is** against the SimplePDF workspace that powers <https://form-copilot.simplepdf.com>. That workspace whitelists `http://localhost:3001` (the default dev-server port), so the embedded editor loads without you having to create an account.
>
> Drop this into your `.env`:
>
> ```env
> VITE_SIMPLEPDF_COMPANY_IDENTIFIER=form-copilot
> ```

Then:

```sh
npm install
cp .env.example .env      # then set VITE_SIMPLEPDF_COMPANY_IDENTIFIER as above
npm run dev               # http://localhost:3001
```

In the running app, open the chat sidebar, click **Bring your own provider**, paste a key from Anthropic / OpenAI / DeepSeek (or point at any OpenAI-compatible endpoint like Ollama / LM Studio), and you're filling forms.

### Share it without asking viewers for a key

Sharing the demo with non-technical users (a teammate, a prospect, a friend) is friction-heavy if every visitor has to paste a provider key. To skip that step, set `SHARED_API_KEYS` in your `.env` and append `?share=<id>` to the URL: the server pays for the LLM under your account, the chat opens already wired up, and the Model Picker stays out of the way.

Two providers are supported on the shared-key path:

- Anthropic Claude Haiku 4.5 (`model: "anthropic_haiku_4_5"`)
- DeepSeek V4 Flash (`model: "deepseek_v4_flash"`)

See [`.env.example`](./.env.example) for the JSON shape, the per-share rate-limit options, and the portable base64 one-liner for hosts that mangle embedded quotes (DigitalOcean App Platform, Render, fly.io). Then visit `http://localhost:3001/?share=<id>` and you're set.

### Ship it on your own domain

Running Form Copilot anywhere other than `localhost:3001` or the hosted demo URL requires a SimplePDF [Pro](https://simplepdf.com/pricing) account (or higher) so that:

1. You get your own `companyIdentifier`
2. You can whitelist your serving origin in the SimplePDF dashboard
3. White-labelling and programmatic control (Pro and above) are enabled on your account

Then in `.env`:

- `VITE_SIMPLEPDF_COMPANY_IDENTIFIER`: your company subdomain (the only required env var; base domain defaults to `https://simplepdf.com`)

The iframe will refuse to load on origins that aren't whitelisted, so add your serving origin (e.g. `https://app.example.com`) before deploying.

For multi-container deployments (or any deploy where you want per-IP rate-limit counters to survive restarts), set `REDIS_URL` to a Redis-protocol-compatible instance (Valkey on DO Managed Caching is the canonical fit at $15/mo). When `REDIS_URL` is set, `IP_HASH_SALT` is also required (the server refuses to boot otherwise) so the persisted hashes can't be brute-forced against a leaked snapshot. Generate one with `openssl rand -hex 32`. Without `REDIS_URL`, counters live in memory per container, which is fine for local dev, single-instance hosts, or BYOK-only deployments.

#### One-click deploy to DigitalOcean

[![Deploy to DigitalOcean](https://www.deploytodo.com/do-btn-blue.svg)](https://cloud.digitalocean.com/apps/new?repo=https://github.com/SimplePDF/simplepdf-embed/tree/main)

The button reads [`.do/deploy.template.yaml`](https://github.com/SimplePDF/simplepdf-embed/blob/main/.do/deploy.template.yaml) at the repo root: Node 24 buildpack, single instance, builds from `/form-copilot`. DigitalOcean prompts you for the env vars at setup time:

- `VITE_SIMPLEPDF_COMPANY_IDENTIFIER` (required, no default): your SimplePDF company subdomain (Pro plan or higher)
- `SHARED_API_KEYS` (optional secret): paste a JSON or base64 payload to enable the `?share=<id>` flow; leave empty for BYOK-only
- `REDIS_URL` (optional secret): a Redis-protocol connection URL (Valkey on DO Managed Caching works as-is). Required for multi-container deployments where per-IP rate-limit counters must be shared. Leave empty for single-instance / BYOK-only.
- `IP_HASH_SALT` (required when `REDIS_URL` is set): salts the SHA-256 IP hash so persisted snapshots aren't brute-forceable. Generate with `openssl rand -hex 32`.

Once deployed, copy the `.ondigitalocean.app` URL DigitalOcean assigns and add it to your SimplePDF dashboard's whitelist before opening the app.

### Wire up your AI provider

Server-side streaming lives in `src/routes/api/chat.ts`. Replace the bundled key resolution with whatever your app uses (env var, secret manager, per-tenant config) and pick a provider in `src/server/language_model.ts`. The Vercel AI SDK abstracts everything behind `streamText`.

If you want users to bring their own keys (BYOK), the browser-direct path in `src/lib/byok/` runs `streamText` straight from the browser to the provider; your server is bypassed entirely.

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
| `src/forms/` | Sample forms (replace with your own) |
| `src/routes/__root.tsx` | `<head>` (title, meta, favicon) |

## Privacy by design

The architecture is deliberate:

- **Document data stays in the browser.** SimplePDF processes PDFs client-side. The iframe never uploads document bytes to SimplePDF.
- **Chat traffic flows through your server.** You control the provider, the keys, the logs, and any RAG / internal data layered in.
- **Submission is direct to your storage.** On Premium with [Bring Your Own Storage](https://simplepdf.com/pricing) (S3, Azure Blob, or SharePoint), completed PDFs upload from the browser to your bucket, never to SimplePDF servers.

### How it works in production

```
  ┌──────────── Browser ────────────┐       ┌── Your server ──┐       ┌── Your AI stack ──┐
  │                                 │       │                 │       │                   │
  │   ┌───────────────┐   chat      │       │   LLM proxy     │       │  Provider + keys  │
  │   │  Form Copilot │ ────────────┼─────► │   (streaming)   │ ────► │  RAG + data       │
  │   └───────┬───────┘             │       │                 │       │                   │
  │           │                     │       └─┬───────────────┘       └───────────────────┘
  │           │                     │         ▲
  │           │ ⇅ postMessage       │         │ webhook (optional)
  │           │   (client-side      │         │
  │           │    tool calls)      │         │
  │           ▼                     │       ┌─┴─ SimplePDF server ───┐
  │   ┌───────────────────────┐     │       │                        │
  │   │                       │     │       │   · metadata only ·    │
  │   │                       │ ────┼─────► │   pre-signed URLs      │
  │   │                       │     │       │   never sees the doc   │
  │   │   SimplePDF editor    │     │       └────────────────────────┘
  │   │       (iframe)        │     │
  │   │                       │     │
  │   │                       │     │       ┌───────────── Your storage ─────────────┐
  │   │                       │ ════┼══════►│                                        │
  │   └───────────────────────┘     │       │  S3 / Azure Blob Storage / SharePoint  │
  │                                 │       │  direct upload                         │
  └─────────────────────────────────┘       └────────────────────────────────────────┘
```

Field data flows over `postMessage` between the chat sidebar and the editor iframe (both inside the same browser tab). Chat messages traverse your server, your AI stack, your logs. The SimplePDF server only sees pre-signed upload URLs (metadata, never document content). Completed PDFs go straight from the browser to your storage bucket; an optional webhook notifies your server when a submission lands.

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

MIT. See [LICENSE](./LICENSE). Use it, fork it, ship it inside your product.

The MIT license covers this code. The SimplePDF editor itself is a hosted service: running this app on your own domain requires a SimplePDF account with white-labelling and programmatic control. [See pricing →](https://simplepdf.com/pricing)
