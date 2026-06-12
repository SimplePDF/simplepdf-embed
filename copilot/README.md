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
<a href="https://copilot.simplepdf.com" rel="dofollow"><strong>Try the live demo »</strong></a>
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

SimplePDF Copilot is a turn-key, MIT-licensed reference implementation that pairs the SimplePDF editor with an AI chat sidebar. The assistant reads the document, fills fields, navigates pages, and submits the PDF, all through the SimplePDF iframe `postMessage` bridge.

Fork it, drop in your own `companyIdentifier`, wire up your AI provider, and ship SimplePDF Copilot inside your product without writing the iframe bridge, tool plumbing, or streaming chat from scratch.

## See it live

The hosted demo at **<https://copilot.simplepdf.com>** runs on SimplePDF [**Pro**](https://simplepdf.com/pricing). It relies on two capabilities available on the Pro plan and above:

- **White-labelling**: embed the editor with your own chrome (no SimplePDF branding)
- **Programmatic control**: drive the editor over the iframe `postMessage` API (load documents, fill fields, switch tools, submit)

To run this code on your own domain, you need a SimplePDF account that includes those capabilities. [Compare plans →](https://simplepdf.com/pricing)

## How it works

```
Browser
  ┌─ Chat sidebar (SimplePDF Copilot)
  │     │
  │     └─ postMessage ──> SimplePDF editor iframe
  │
  └─ /api/chat ──> your server
                     └─ Vercel AI SDK ──> Anthropic / OpenAI / DeepSeek
```

- The PDF editor renders inside the SimplePDF iframe. **PDF data never leaves the browser.**
- SimplePDF Copilot drives the editor through `postMessage` (focus a field, set a value, navigate, submit)
- LLM streaming runs through your server via the Vercel AI SDK; you choose the provider
- Tool calls are executed in the browser, against the iframe. Your server only proxies the chat stream.
- **Voice input is different — it is a deliberate audio egress, on one of two paths.** Dictating into the composer records a short audio clip in the browser; recording starts when you tap the mic, and when you confirm it (✓) the clip is transcribed and the editable transcript drops into the textarea. Two routes, each named in the recorder before the audio is sent:
  - **Demo (server):** when the deployment is in demo mode (operator keys configured), the clip uploads to `/api/transcribe`, which forwards it to OpenAI (`gpt-4o-transcribe`) and returns the transcript. So **audio leaves the browser to SimplePDF's server and then OpenAI** (the server keeps no audio, logs no transcript).
  - **BYOK (browser-direct):** configure a Speech-to-Text provider (OpenAI or a custom OpenAI-compatible endpoint) in the model picker's Speech-to-Text tab; the clip is sent **directly from the browser to that endpoint, never to SimplePDF**. The key lives only in this browser's encrypted vault — a demo/reference feature (a browser-held key is exposed to anything on the page).
  - In both cases PDF bytes still stay on-device, and audio is sent only when you confirm the recording (never automatically). The recorder prompt names the actual audio recipient before you confirm: the **demo** prompt reads "Speak to SimplePDF Copilot…" (its server→OpenAI flow is the one described above, and "What is this demo?" documents it); the **BYOK** prompt reads "Speak to OpenAI…" or "Speak to &lt;your endpoint&gt;…" (sent directly to that provider, not to SimplePDF).

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
> The demo runs **as-is** against the SimplePDF workspace that powers <https://copilot.simplepdf.com>. That workspace whitelists exactly one local origin: **`http://localhost:3001`** (the default dev-server port).
>
> Drop this into your `.env`:
>
> ```env
> VITE_SIMPLEPDF_COMPANY_IDENTIFIER=spdf-copilot
> ```

Then:

```sh
npm install
cp .env.example .env      # then set VITE_SIMPLEPDF_COMPANY_IDENTIFIER as above
npm run dev               # http://localhost:3001
```

In the running app, open the chat sidebar, click **Bring your own provider**, paste a key from Anthropic / OpenAI / DeepSeek (or point at any OpenAI-compatible endpoint like Ollama / LM Studio), and you're filling forms.

> [!IMPORTANT]
> **Keep the dev port at 3001.** The SimplePDF demo workspace whitelists exactly one local origin, `http://localhost:3001`, and the editor will only load on a parent page served from that exact host and port. The browser enforces this on iframe load: any other port (e.g. 3000, 5173) or any other host is refused. The `dev` script in `package.json` pins port 3001; don't override it with `--port` flags. To run on your own domain or a different port, you need a SimplePDF [Pro](https://simplepdf.com/pricing) account so you can set your own `companyIdentifier` and whitelist your origin in the SimplePDF dashboard.

### Run the demo without asking viewers for a key

Asking every visitor to paste a provider key is friction-heavy. To skip that, put the deployment **in demo mode**: configure a single chat key/model/turn-cap plus a transcription key in your `.env`, and the server pays for chat + voice under your account for every visitor. There are no invite links — demo mode is simply on whenever both are configured. The chat opens already wired up and the Model Picker stays out of the way (visitors can still bring their own key to override).

Demo mode requires **both**:

- `DEMO_CHAT_API_KEY` + `DEMO_CHAT_MODEL` + `DEMO_RATE_LIMIT_TURNS` — the chat key, the model, and the per-IP turn cap.
- `TRANSCRIPTION_OPENAI_API_KEY` — the voice transcription key (transcription-only, never your chat key).

Two chat models are supported on the demo path:

- Anthropic Claude Haiku 4.5 (`DEMO_CHAT_MODEL=anthropic_haiku_4_5`)
- DeepSeek V4 Flash (`DEMO_CHAT_MODEL=deepseek_v4_flash`)

Leave the demo vars unset and the deployment runs **BYOK-only**: every visitor brings their own key via the Model Picker. Note: with no invite gating, demo mode is open to anyone who can reach the page, so the **per-IP turn cap (`DEMO_RATE_LIMIT_TURNS`) is the cost control** — size it accordingly. See [`.env.example`](./.env.example) for the exact vars.

### Voice input (dictation)

The chat composer shows a microphone whenever the browser can record. Clicking it needs **both** a Chat model and a Speech-to-Text provider configured (a transcript you can't send is useless), so it opens the model picker on whichever is missing, else it records. Two transcription routes:

- **Demo (server):** when the deployment is in demo mode (the demo vars above are set, including `TRANSCRIPTION_OPENAI_API_KEY`), the clip is transcribed via `/api/transcribe` on the operator's key. Voice and chat share the same demo entitlement, so both require the keys to be configured; without the transcription key the deployment isn't in demo mode and voice + demo chat are unavailable (BYOK still works).
- **BYOK (browser-direct):** in the picker's **Speech-to-Text** tab, configure OpenAI (`gpt-4o-mini-transcribe` / `gpt-4o-transcribe`) or a custom OpenAI-compatible endpoint. The clip is transcribed directly browser→provider, never touching SimplePDF's server. No env var needed.

See the privacy notes above for the per-route audio-egress disclosure.

### Load a specific document via `?url=`

To open a specific document instead of the bundled demo forms, append `?url=<document-url>`. The value is used verbatim as the editor iframe `src`, so pass a valid SimplePDF document URL (e.g. a `/documents/<id>` link, optionally with a `?prefill=<id>`):

```
http://localhost:3001/?url=https%3A%2F%2Fdemo.simplepdf.com%2Fdocuments%2Fc28f061b-1974-4251-ba7a-d08bedc3ef28%3Fprefill%3D35fdf39e-2e06-4712-bb9d-f62d2f88ce50
```

URL-encode the value whenever it carries its own query string (e.g. `?prefill=`), otherwise the nested params get parsed as part of the page URL and dropped.

The value must be an absolute `http(s)` URL on your configured base-domain family (`*.simplepdf.com` by default, or whatever host `VITE_SIMPLEPDF_BASE_DOMAIN` resolves to). Third-party origins are rejected on purpose: the iframe is granted clipboard access and is wired to the `postMessage` bridge, so framing an arbitrary site would hand it both. A malformed or off-domain `?url=` silently falls back to the default demo form. `?url=` combines with `?lang=`; when set, it wins for what the editor loads.

### Ship it on your own domain

Running SimplePDF Copilot anywhere other than `localhost:3001` or the hosted demo URL requires a SimplePDF [Pro](https://simplepdf.com/pricing) account (or higher) so that:

1. You get your own `companyIdentifier`
2. You can whitelist your serving origin in the SimplePDF dashboard
3. White-labelling and programmatic control (Pro and above) are enabled on your account

Then in `.env`:

- `VITE_SIMPLEPDF_COMPANY_IDENTIFIER`: your company subdomain (the only required env var; base domain defaults to `https://simplepdf.com`)

The iframe will refuse to load on origins that aren't whitelisted, so add your serving origin (e.g. `https://app.example.com`) before deploying.

For multi-container deployments (or any deploy where you want per-IP rate-limit counters to survive restarts), set `REDIS_URL` to a Redis-protocol-compatible instance (Valkey on DO Managed Caching is the canonical fit at $15/mo). When `REDIS_URL` is set, `IP_HASH_SALT` is also required (the server refuses to boot otherwise) so the persisted hashes can't be brute-forced against a leaked snapshot. Generate one with `openssl rand -hex 32`. Without `REDIS_URL`, counters live in memory per container, which is fine for local dev, single-instance hosts, or BYOK-only deployments.

> **DO App Platform gotcha — wire the database from the App side.** If you're using DO Managed Caching, **don't** start by adding a Trusted Source on the cluster. Open your App Platform app → **Settings** → **App Spec** → **+ Create or Attach Database** → pick the existing cluster (or provision a new one). DO then auto-handles trusted sources, VPC routing, and injects the connection string into the app's env. Wiring from the cluster side leaves the App on a public-egress IP that can't be matched to a Trusted Source, and you'll get `ETIMEDOUT` even with the source allowlisted. Same shape as adding a custom domain: it has to be done from the App, not from the resource.
>
> Once attached, DO injects the connection string as `DATABASE_URL` (the bind variable's default name) — **rename it** to `REDIS_URL` in the App's env vars, OR add a separate `REDIS_URL` entry whose value is `${cluster-name.DATABASE_URL}` to alias it. The copilot server only reads `REDIS_URL`.

#### One-click deploy to DigitalOcean

[![Deploy to DigitalOcean](https://www.deploytodo.com/do-btn-blue.svg)](https://cloud.digitalocean.com/apps/new?repo=https://github.com/SimplePDF/simplepdf-embed/tree/main)

The button reads [`.do/deploy.template.yaml`](https://github.com/SimplePDF/simplepdf-embed/blob/main/.do/deploy.template.yaml) at the repo root: Node 24 buildpack, single instance, builds from `/copilot`. DigitalOcean prompts you for the env vars at setup time:

- `VITE_SIMPLEPDF_COMPANY_IDENTIFIER` (required, no default): your SimplePDF company subdomain (Pro plan or higher)
- `DEMO_CHAT_API_KEY` / `DEMO_CHAT_MODEL` / `DEMO_RATE_LIMIT_TURNS` + `TRANSCRIPTION_OPENAI_API_KEY` (optional secrets): set **all** of them to put the deployment in demo mode (the server pays for chat + voice, capped per IP by the turn count); leave unset for BYOK-only
- `REDIS_URL` (optional secret): a Redis-protocol connection URL (Valkey on DO Managed Caching works as-is). Required for multi-container deployments where per-IP rate-limit counters must be shared. Leave empty for single-instance / BYOK-only.
- `IP_HASH_SALT` (required when `REDIS_URL` is set): salts the SHA-256 IP hash so persisted snapshots aren't brute-forceable. Generate with `openssl rand -hex 32`.
- `TRANSCRIPTION_OPENAI_API_KEY` (optional secret): an OpenAI key for the **demo** voice path only (`gpt-4o-transcribe` via `/api/transcribe`). Never the chat key, never a BYOK key. It is part of demo mode (see the combined bullet above): without it the deployment is **not** in demo mode, so demo chat **and** voice are both off and every visitor falls back to BYOK (which is browser-direct and needs no server key).

Once deployed, copy the `.ondigitalocean.app` URL DigitalOcean assigns and add it to your SimplePDF dashboard's whitelist before opening the app.

#### Other deploy targets

The stack runs unmodified anywhere a Node 24 server can. Tested + documented targets:

- **DigitalOcean App Platform** (one-click button above)
- **Cloudflare Containers** (GA since April 2026, Workers Paid plan): wrap the build in a small Dockerfile and `npx wrangler containers deploy`. Cloudflare's edge sits in front for free, with WAF rate-limiting and global caching. See <https://developers.cloudflare.com/containers/>.
- **Vercel**: the nitro `node-server` preset works on Vercel's Node runtime. `vercel deploy` from the `copilot/` folder.
- **Render**, **fly.io**, **Railway**: point at the repo, set build = `npm run build`, start = `npm start`, configure env vars in the dashboard. fly.io expects a Dockerfile.
- **Self-hosted Docker**: `npm run build` produces `.output/`. `node .output/server/index.mjs`, expose port 3000.

The skill at [`skills/fork-and-go/SKILL.md`](./skills/fork-and-go/SKILL.md) walks you through whichever target you pick.

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
| `select_tool` | Switch the editor toolbar (`TEXT`, `COMB_TEXT`, `CHECKBOX`, `SIGNATURE`, `PICTURE`) |
| `go_to_page` | Navigate to a specific page (1-indexed) |
| `move_page` | Reorder a visible page (`from_page` → `to_page`, both 1-indexed). Destructive — only fired on explicit user request |
| `delete_page` | Remove a visible page and its fields (last remaining page can't be deleted). Destructive — only fired on explicit user request |
| `rotate_page` | Rotate a visible page 90° clockwise per call. Destructive — only fired on explicit user request |
| `submit` (Pro mode) / `download` (demo mode) | Finalize: real iframe `SUBMIT` on a Pro fork (lands in BYOS + webhooks) vs. an in-browser `DOWNLOAD` on the hosted demo |

Tool input + output schemas live under `src/lib/embed-bridge-adapters/client-tools/`. System prompt: `src/server/tools.ts`. The bridge that posts these events into the iframe: `src/lib/embed-bridge/bridge.ts`. Public iframe contract these tools exercise: [`documentation/IFRAME.md`](../documentation/IFRAME.md).

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
- **Voice input is the one exception, and it is opt-in.** Dictation sends the recorded audio clip out of the browser — unlike PDF bytes, dictated audio (which can contain PII/PHI) leaves the device. Two routes, each disclosed before recording: the **demo** route uploads to SimplePDF's server and on to OpenAI (the server keeps no audio and logs no transcript text — only an IP hash, byte size, and elapsed time); the **BYOK** route sends audio **directly to the user's chosen provider, never to SimplePDF** (SimplePDF makes no retention claim for user-selected providers — that's the provider's policy). Audio is sent only on an explicit Record.

### Using the demo account

What's actually running when you open <https://copilot.simplepdf.com> or `npm run dev` against the demo's shared `companyIdentifier`:

<!-- Column invariants (alignment is manual): Browser outer wall at col 37; brand box 21 chars wide with the down-arrow at col 17; demo server box 32 chars wide; Hosted AI box 21 chars wide; SimplePDF server bottom box 27 chars wide. Renaming a label or padding a cell requires re-balancing connector dashes / inner padding. -->

```
  ┌──────────── Browser ────────────┐       ┌── SimplePDF Copilot server ──┐       ┌── Hosted AI ──────┐
  │                                 │       │                              │       │                   │
  │   ┌───────────────────┐   chat  │       │  LLM proxy                   │       │                   │
  │   │ SimplePDF Copilot │ ────────┼─────► │  (or BYOK direct)            │ ────► │     Demo LLM      │
  │   └─────────┬─────────┘         │       │                              │       │                   │
  │             │                   │       └──────────────────────────────┘       └───────────────────┘
  │             │                   │
  │             │ ⇅ postMessage     │
  │             │   (client-side    │       ┌─── SimplePDF server ────┐
  │             │    tool calls)    │       │                         │
  │             ▼                   │       │                         │
  │   ┌───────────────────────┐     │       │  Telemetry and metadata │
  │   │                       │ ────┼─────► │           only          │
  │   │   SimplePDF editor    │     │       │                         │
  │   │       (iframe)        │     │       │                         │
  │   │                       │     │       └─────────────────────────┘
  │   └───────────────────────┘     │
  │                                 │
  └─────────────────────────────────┘
```

Field data stays in the browser via `postMessage` between the chat sidebar and the editor iframe. Chat traffic flows through the demo's hosted server to a hosted AI provider, or browser-direct when you bring your own API key. The SimplePDF server records only telemetry and metadata; no webhooks, no document storage, no document content.

### Using your own SimplePDF account

What you ship when you fork this repo onto your own [Pro](https://simplepdf.com/pricing) account: your server, your AI stack, your storage, optional webhooks back to your backend.

<!-- Column invariants (alignment is manual): Browser outer wall at col 37; brand box 21 chars wide with the down-arrow at col 17; "Your server" box 19 chars wide; "Your AI stack" box 21 chars wide; "SimplePDF server" box 26 chars wide; "Your storage" box 42 chars wide. Renaming a label or padding a cell requires re-balancing connector dashes / inner padding. -->

```
  ┌──────────── Browser ────────────┐       ┌── Your server ──┐       ┌── Your AI stack ──┐
  │                                 │       │                 │       │                   │
  │   ┌───────────────────┐   chat  │       │   LLM proxy     │       │  Provider + keys  │
  │   │ SimplePDF Copilot │ ────────┼─────► │   (streaming)   │ ────► │  RAG + data       │
  │   └─────────┬─────────┘         │       │                 │       │                   │
  │             │                   │       └─┬───────────────┘       └───────────────────┘
  │             │                   │         ▲
  │             │ ⇅ postMessage     │         │ webhook (optional)
  │             │   (client-side    │         │
  │             │    tool calls)    │         │
  │             ▼                   │       ┌─┴─ SimplePDF server ───┐
  │   ┌───────────────────────┐     │       │                        │
  │   │                       │     │       │  Telemetry + metadata  │
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

Chat messages traverse your server, your AI stack, your logs. The SimplePDF server only sees pre-signed upload URLs (metadata, never document content). Completed PDFs go straight from the browser to your storage bucket; an optional webhook notifies your server when a submission lands.

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
