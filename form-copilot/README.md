# PDF Form Copilot

> Form Copilot: AI that helps users fill PDF forms step by step.

Standalone TanStack Start app that combines the SimplePDF editor (left pane) with an AI chat sidebar (right pane). The assistant reads, fills, navigates, and submits the PDF through the SimplePDF iframe `postMessage` bridge. Doubles as the canonical integration example for consumers and as a hosted marketing demo.

- **Framework**: TanStack Start (Vite + Nitro)
- **PDF editor**: embedded iframe at `<company>.simplepdf.com`
- **LLM on the server path**: Claude Haiku 4.5 via the Vercel AI SDK, streamed through a TanStack Start server function
- **LLM on the BYOK path**: `streamText` runs directly in the browser (OpenAI or Anthropic); the API key stays in tab memory and never touches this server
- **Tools**: executed client-side via iframe `postMessage` (no tool execution on the server)
- **Access model**: invite-only via `SHARED_API_KEYS` + `?share=<id>` OR bring-your-own-key via the Model Picker. No open / default-key mode.

## Running locally

```bash
npm install
cp .env.example .env
# Set SHARED_API_KEYS in .env (JSON shape documented below) before the server
# will answer. Alternatively, skip the server path entirely and use the Model
# Picker -> BYOK from the UI.
npm run dev              # defaults to http://localhost:3001
```

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build (Nitro output) |
| `npm run preview` | Preview the production build |
| `npm run test` | Run unit tests (Vitest) |
| `npm run check` | Biome format + lint check |
| `npm run test:types` | `tsc --noEmit` |

## Environment

### Access keys

`SHARED_API_KEYS` is the only server-paid path. The env is a stringified JSON map of share-id to per-share config:

```
SHARED_API_KEYS='{"<share_id>":{"api_key":"sk-ant-...","rate_limit_turns_lifetime":20,"model":"anthropic_haiku_4_5"}}'
```

- `api_key` (required): provider API key used for requests that arrive with `?share=<share_id>`. Anthropic key for `model: "anthropic_haiku_4_5"`, DeepSeek key for `model: "deepseek_v4_flash"`.
- `rate_limit_turns_lifetime` (required): lifetime cap on fresh user turns per IP for that share. Resets on server restart (or persists to S3, see below).
- `model` (required): the demo model this invite runs on. One of `"anthropic_haiku_4_5"` (displayed as "Claude Haiku 4.5") or `"deepseek_v4_flash"` (displayed as "DeepSeek V4 Flash"). The label shown above "Switch AI model" in the chat header is driven entirely by `DEMO_MODELS` in `src/lib/demo_model.ts`, so editing a label there immediately changes the UI.
- The reserved id `__default__` is rejected at parse time.
- Requests without a valid `?share=` return 401.

The share id lives directly in the address bar via `?share=<id>` for the entire session — there is no cookie, no server-side rewrite. The server reads the same `?share=` from the page URL (route loader) and from every `/api/chat` / `/api/summarize` fetch URL. Copy-pasting the URL with `?share=<id>` hands someone else a working invite until the per-share lifetime cap is hit.

Visitors who want the demo without an invite link open the Model Picker inside the app and bring their own key. BYOK runs the stream entirely in the browser; it never hits `/api/chat` or `/api/summarize`.

**Fail-closed rate limit.** If the limiter is mis-configured or its persistence hydration fails, every `/api/chat` and `/api/summarize` request returns 503 `service_unavailable` instead of silently accepting traffic on an empty in-memory counter. The operator is expected to fix the config (or disable persistence) before the server serves anything.

### Client configuration

| Variable | Required | Purpose |
|----------|----------|---------|
| `VITE_SIMPLEPDF_COMPANY_IDENTIFIER` | **Yes** | The `<company>.<base_domain>` subdomain that serves the embedded editor. Exposed to the client because the iframe `src` is built browser-side. Get your own company identifier: https://simplepdf.com/auth/signup. Missing / empty = app throws at startup. |
| `VITE_SIMPLEPDF_BASE_DOMAIN` | **Yes** | Full base URL (protocol + host + optional port), e.g. `https://simplepdf.com` or `http://simplepdf.nil:3105`. The company identifier above is spliced in as a subdomain. Missing / empty / invalid URL = app throws at startup. |
| `VITE_ENABLE_DEVTOOLS` | No | Set to `true` to surface the TanStack Router devtools panel in local dev. |

### Rate-limit persistence (optional; all seven must be set together)

| Variable | Purpose |
|----------|---------|
| `IP_HASH_SALT` | **Required when the S3 vars below are set.** Salts the SHA-256 IP hash; prevents brute-force of a leaked persisted blob. Server refuses to start if S3 persistence is configured without it. |
| `S3_ENDPOINT` | e.g. `https://fra1.digitaloceanspaces.com` |
| `S3_REGION` | e.g. `us-east-1` |
| `S3_BUCKET` | e.g. `beautiful-space` |
| `S3_RATE_LIMIT_KEY` | e.g. `simple-pdf/rate-limits/form-copilot.json` |
| `S3_ACCESS_KEY_ID` | Spaces / S3 access key |
| `S3_SECRET_ACCESS_KEY` | Spaces / S3 secret |

With all seven set, per-(share, IP) counters are loaded at boot and written every 30s (debounced). Without them, counters live only in memory and reset with the server process.

## Architecture at a glance

```
Browser
  Copilot chat -- postMessage --> SimplePDF editor iframe
     |
     |-- /api/chat (same-origin only) --> server function
     |                                      -> Anthropic via Vercel AI SDK
     |                                      -> per-share rate limiter
     |
     |-- BYOK path: streamText in browser --> OpenAI / Anthropic directly
                                              (never hits our server)
```

- Every server route (`/api/chat`, `/api/summarize`, the `readDemoGate` server function) enforces a same-origin check. Spoofable from curl but the intent is to constrain the browser path to the hosting origin.
- Tool-call round trips happen client-side; the server only proxies the stream.
- Tool results are wrapped in a `{ __untrusted_data, data }` envelope before reaching the LLM. The system prompt includes a matching rule.
- On the BYOK path, `get_document_content` returns the full document; on the shared-key path, it caps at one page / 1200 chars to stay under the per-share token budget.

## Design notes

See [`plans/P059-pdf-form-copilot.md`](../../../plans/P059-pdf-form-copilot.md) in the parent repo for the full design history, decision log, and code-review remediation trail.
