---
name: fork-and-go
description: >-
  Guided walkthrough for forking and deploying your own SimplePDF Copilot:
  hosting choice, Pro-account confirmation, AI-provider wiring, demo
  customization, deploy, and the SimplePDF whitelist step. Use when a developer
  wants to fork, self-host, ship, or deploy SimplePDF Copilot.
---

# Fork and Go

A guided walkthrough for SimplePDF Pro customers forking and deploying their own SimplePDF Copilot.

## Purpose

Walk a developer through forking the SimplePDF Copilot reference implementation into their own product. Covers hosting choice, Pro-account confirmation, AI-provider wiring, demo customization, deploy, and the SimplePDF whitelist step. End state: a running SimplePDF Copilot at their chosen URL, talking to their AI provider, whitelisted on their account.

## Triggers

To get the `/fork-and-go` slash command in Claude Code, copy this folder into the project's `.claude/skills/` — or just point the agent at this file.

Invoke when the user types `/fork-and-go` or any natural-language equivalent:

- "Help me fork SimplePDF Copilot"
- "How do I deploy SimplePDF Copilot?"
- "I want to ship SimplePDF Copilot inside my app"
- "Set up SimplePDF Copilot for me"
- "Walk me through deploying SimplePDF Copilot"

---

## Open with a short greeting

Before any question, greet the user in one or two friendly sentences:

- Say what you're about to help them with: getting SimplePDF Copilot running in their setup.
- Set expectations: you'll ask a couple of quick questions, then walk them through wiring it.
- Be warm but concise. No bullet lists, no headers, no markdown formatting in the greeting itself.

Example shape: _"Let me help you get SimplePDF Copilot running in your setup. I'll ask a few quick questions to figure out the right path, then we'll wire it together step by step."_

After the greeting, ask the FIRST question (Q1 below).

---

## ⛔ ONE question per turn: non-negotiable

This is the single most important rule in this entire skill. **Each of your replies MUST contain at most ONE question.** Then STOP and wait for the user to answer.

If a section asks more than one thing, ask the FIRST one only and remember the rest for your next turn.

Forbidden patterns:

- "Where will you host this? And do you have Pro?" → 2 questions. Forbidden.
- "Once you tell me X, I'll need Y and Z." → previewing future questions counts as asking them. Forbidden.
- A bulleted list of 3 things to confirm → 3 questions. Forbidden.
- "Local or hosted, and if hosted, which platform?" → 2 questions. Ask only the first.

The ONLY exception: a clarifying restatement of the SAME question (e.g. "Local only: meaning just `npm run dev` on your dev machine: or hosted somewhere?"). That's one question with a definition, not two questions.

If you catch yourself drafting more than one question, delete everything after the first one. Do not soften with "and one more thing" or "while you're at it".

---

## Use AskUserQuestion for choices

When asking the user to pick between known options, use the `AskUserQuestion` tool whenever it is available, never a plain text list. Free-text answers (e.g. "what's your companyIdentifier?") use a regular question. If `AskUserQuestion` is not available, ask the same single question as concise plain text.

`AskUserQuestion` header chips: keep them under 12 chars. Examples: `Host`, `Plan`, `Provider`, `Customize`.

When recommending a default option, mark it with `(Recommended)` in the label and put it first.

---

## Conversational style

- **Don't** front-load explanations, prerequisites, or all the steps. Reveal info only when relevant to the next decision.
- Keep replies short: a sentence or two plus the one question.
- No "here's everything you'll need" preambles. No recap of what they just told you. No checklist of what's about to happen.
- Skip steps the user has clearly handled (e.g. don't re-ask if they've already mentioned `pnpm` in their first reply).
- Match their energy: terse if they're terse; warmer if they're chatty.

The goal: feel like a calm, focused colleague, not a manual.

---

## Question sequence

### Q1: hosting target

Use `AskUserQuestion`:

- **Question:** Where do you want SimplePDF Copilot to run?
- **Header:** `Host`
- **Options:**
  - `Local only` (Recommended): _"Just `npm run dev` on your dev machine, served at `http://localhost:3001`. The demo's SimplePDF workspace whitelists that exact origin, so no Pro account is needed. The port has to stay 3001."_
  - `DigitalOcean App Platform`: _"One-click deploy via the bundled `.do/deploy.template.yaml`. Cheapest hosted option (~$12-24/mo)."_
  - `Cloudflare Containers`: _"GA since April 2026. Workers Paid plan ($5/mo) required. The copilot Node + nitro stack runs as-is in a Linux container. Needs a small Dockerfile and a `wrangler deploy`."_
  - `Other (Vercel / Render / fly.io / Docker / my own server)`: _"The nitro `node-server` stack works on any PaaS or your own box; we'll set up env vars + build commands, or you run the production build (`npm start`) wherever you want."_

DO NOT proceed until they answer.

### Q2: Pro account

After Q1, use `AskUserQuestion`:

- **Question:** SimplePDF Copilot is available on the SimplePDF Pro plan and above (white-labelling and programmatic control are gated there). Do you have a Pro account or higher?
- **Header:** `Plan`
- **Options:**
  - `Yes, I have Pro or higher`: _"Great, we'll wire it up with your companyIdentifier next."_
  - `No, but I'll get one`: _"I'll point you at the sign-up flow next, with one tip about which welcome path to pick."_
  - `Just exploring`: _"Local-only is fine without a Pro account (the demo workspace whitelists `localhost:3001`). Hosted deploy is gated on Pro."_

If they pick `No, but I'll get one`, send them this exact guidance and pause until they confirm:

> _"Sign up at https://simplepdf.com/auth/signup. The welcome flow will ask whether you want to **embed SimplePDF in your app** or **collect submissions**. Pick **'collect submissions'**: that path is short and gets you straight to plan selection, which is what you actually need here. The 'embed in my app' welcome takes you through an integration walkthrough (React / iframe / WordPress / etc.) that you don't need for fork-and-go, since you're already wiring up the embed yourself via this skill. After completing the short onboarding, choose the **Pro** plan (or higher). Your `companyIdentifier` is visible in the dashboard sidebar, right under your company name (a small monospaced chip)."_

If `Just exploring`: set the expectation clearly that local-only works but hosted requires Pro, then proceed (use the demo's `spdf-copilot` companyIdentifier as a placeholder).

### Q3: companyIdentifier

If they have or will have Pro (or higher), ask in plain text (no `AskUserQuestion`):

_"What's your SimplePDF companyIdentifier? It's the subdomain piece of `<companyIdentifier>.simplepdf.com`. Open your SimplePDF dashboard and look at the sidebar: the identifier is the small chip right under your company name."_

If `Just exploring`, skip this and use `spdf-copilot` as the placeholder; remind them once near deploy time.

### Q4: AI provider

Use `AskUserQuestion`:

- **Question:** Which AI provider should SimplePDF Copilot use server-side?
- **Header:** `Provider`
- **Options:**
  - `Anthropic Claude` (Recommended): _"Ships wired in the demo registry (`anthropic_haiku_4_5`). Mature tool-calling, broad ecosystem support, predictable pricing."_
  - `OpenAI`: _"GPT-4 / GPT-5 family. Solid alternative — needs a small wiring change (Step 5) before demo mode can use it."_
  - `DeepSeek`: _"In our testing, on par with Anthropic Claude Haiku 4.5 for the form-filling task, at a meaningfully lower cost per turn. Ships wired (`deepseek_v4_flash`)."_
  - `BYOK / custom OpenAI-compatible endpoint`: _"No server-side provider: visitors paste their own key in the in-app Model Picker. Also covers local/self-hosted OpenAI-compatible endpoints (Ollama, LM Studio, vLLM) via the browser-direct BYOK path — your server isn't in the loop. Lowest ops surface."_

### Q5: demo mode

ONLY ask if Q4 was a named provider (Anthropic / OpenAI / DeepSeek) — the BYOK / custom-endpoint path has no server-side demo config, and for OpenAI note that the Step 5 wiring must land before demo mode works. Use `AskUserQuestion`:

- **Question:** Want **demo mode** — your keys power chat + voice for every visitor (no key-paste needed), rate-limited per IP?
- **Header:** `Demo mode`
- **Options:**
  - `Yes, enable demo mode`: _"Set `DEMO_CHAT_API_KEY` + `DEMO_CHAT_MODEL` + `DEMO_RATE_LIMIT_TURNS` and `DEMO_STT_OPENAI_API_KEY`. Demo mode is on whenever all four are set: every visitor uses the demo on your keys (no invite links), and the per-IP turn cap bounds cost. Voice + chat share the same demo entitlement, so both keys are required."_
  - `No, BYOK only`: _"Leave the demo vars unset. Every visitor brings their own key in the Model Picker. No server-side LLM cost from your account."_

### Q6: customization

Use `AskUserQuestion`:

- **Question:** Keep all the demo features, or trim down?
- **Header:** `Customize`
- **Options:**
  - `Keep everything` (Recommended): _"BYOK Model Picker, sample forms, welcome splash, info modal, all of it. Easiest to start; trim later once you know what you want."_
  - `Strip the demo`: _"Delete the demo trees (welcome modal, info modal, download modal upsell, social-share, sample forms, demo gating, misbehavior detector). Three folder deletes + one file swap, then small edits in the nine retained files that imported them. You keep the chat surface, BYOK Model Picker, model registry, iframe bridge, locale system."_
  - `Custom: walk me through each`: _"We'll go through each demo feature one at a time."_

Demo code is grouped under `demo/` directories specifically so the strip is mechanical:
- `src/components/demo/` — welcome modal, info modal, download modal, social share
- `src/components/easter-eggs/` — Cerfa d'Or French easter egg
- `src/lib/demo/` — sample-form catalogue, demo model registry
- `src/server/demo/` — preflight gate, demo-config resolution, misbehavior detector, loader server fns

---

## Whitelisting reminder (Q7-equivalent)

After Q6, BEFORE writing any code, mention in plain prose (NOT a question):

> "One thing to flag now so it's not a surprise later: your account's embed-origins whitelist controls where the SimplePDF iframe loads. While the whitelist is empty, all origins are allowed — adding the first origin activates the allow-list and blocks everything else. The demo workspace whitelists `localhost:3001`, so local dev works out of the box. For your own deploy URL (e.g. `https://my-app.example.com`), plan to whitelist it so your account isn't left open to any origin. I'll remind you again at deploy time."

If they picked `Local only` in Q1 AND are staying on the demo `spdf-copilot` identifier, skip this entirely (the demo workspace already covers them). A Local-only user on their OWN identifier still needs `http://localhost:3001` whitelisted once their allow-list has entries — keep the reminder for them.

This is informational. Do NOT pause for an answer; continue to the wiring sequence.

---

## Wiring sequence

After all the questions are answered, walk through these steps. ONE step per turn. Pause after each for the user to confirm before moving to the next.

### Step 1: verify the clone

If the user already has the copilot directory open (their cwd looks like `…/copilot/`), skip to Step 2. Otherwise:

```sh
gh repo fork SimplePDF/simplepdf-embed --clone
cd simplepdf-embed/copilot
```

**Fork, don't just clone** — every hosted deploy target in Step 7 builds from a GitHub repo, so the user's Step 5/6 changes must live in a repo they can push to. Without `gh`: fork in the GitHub UI first, then clone the fork. (`Local only` explorers who will never deploy can plain-clone upstream.)

Wait for them to confirm they're inside the folder.

### Step 2: install dependencies

```sh
npm install
```

If they prefer pnpm or yarn, that works too: but the bundled `package-lock.json` is npm-style so the first run will rebuild the lockfile. Note this and let them choose.

### Step 3: environment

```sh
cp .env.example .env
```

Then edit `.env`:

- Set `VITE_SIMPLEPDF_COMPANY_IDENTIFIER=<their value from Q3>`. If they're `Just exploring`, leave it as `spdf-copilot`. Heads-up: any identifier other than `spdf-copilot` switches the app to customer mode (`MODE = 'simplepdf_customer'`), which among other things swaps the toolbar's **Download** button for **Submit** (submissions flow to their SimplePDF account). This is separate from the env-driven shared-key demo chat (the `DEMO_*` vars from Q5), which works in either mode.
- If they answered `Yes, enable demo mode` in Q5, set all four demo vars per `.env.example`: `DEMO_CHAT_API_KEY`, `DEMO_CHAT_MODEL` (`anthropic_haiku_4_5` or `deepseek_v4_flash`), `DEMO_RATE_LIMIT_TURNS` (per-IP turn cap), and `DEMO_STT_OPENAI_API_KEY`. Demo mode turns on only when all four are present.
- For multi-container hosted deploys (DO App Platform with auto-scaling), recommend setting `REDIS_URL` (any Redis-compatible URL: DO Managed Caching for Valkey works) and `IP_HASH_SALT` (generate with `openssl rand -hex 32`). Required pair when `REDIS_URL` is set; the server refuses to boot otherwise.

Wait for confirmation that `.env` is filled in.

### Step 4: local smoke test

```sh
npm run dev
```

Open http://localhost:3001. Expected:

- The iframe loads with a demo sample form.
- The chat sidebar shows the Model Picker (BYOK) or is ready to send (demo mode, when the demo vars are configured).

The dev script pins port 3001 deliberately. The SimplePDF workspace tied to the `companyIdentifier` whitelists exactly the origin `http://localhost:3001` and only that origin: any other port (3000, 5173) or any other host gets a blocked-origin error screen naming the offending origin (with a link to the embed settings). Don't override the port with `--port` flags.

If the iframe fails to load:

1. The dev server is not on port 3001. Re-run `npm run dev` without overrides.
2. Their `companyIdentifier` is set to a value whose account whitelists other origins but not `localhost:3001` (an account with an empty whitelist allows all origins). The demo's `spdf-copilot` identifier covers it. Their own Pro identifier requires them to whitelist `http://localhost:3001` themselves once their allow-list has entries. Easiest path: just load `http://localhost:3001` in the browser once (the embed won't work yet, but the editor records the attempted origin), then open `https://<companyIdentifier>.simplepdf.com/account/embed`, scroll to **Security**, and the auto-detected origin will be there ready to one-click approve. Refresh the local page; the iframe now loads.

Wait for them to confirm the editor renders.

### Step 5: wire AI provider

Open `src/server/language_model.ts`. The current dispatch handles Anthropic and DeepSeek by name. Per their Q4 choice:

- **Anthropic Claude:** for demo mode set `DEMO_CHAT_API_KEY` (Anthropic key) + `DEMO_CHAT_MODEL=anthropic_haiku_4_5` in `.env`. No code change needed.
- **OpenAI:** for demo mode set `DEMO_CHAT_API_KEY` (OpenAI key). Then wire the provider in `src/lib/demo/demo_model.ts`: add the new key to the `DemoModel` union AND the `DemoModelSchema` enum (the env value is validated against it — an unknown key silently drops the deployment to BYOK-only), plus its `DEMO_MODELS` entry. Add an `openai` case to `src/server/language_model.ts` (`@ai-sdk/openai` is already installed; the `satisfies never` guard fails the build until the case exists). Finally set `DEMO_CHAT_MODEL` to the new key.
- **DeepSeek:** for demo mode set `DEMO_CHAT_API_KEY` (DeepSeek key) + `DEMO_CHAT_MODEL=deepseek_v4_flash`. Already wired.
- **Custom OpenAI-compatible:** the browser-direct BYOK path in `src/lib/byok/` already supports any OpenAI-compatible endpoint. Defaults are in `src/lib/byok/providers.ts` (Ollama URL + a default model name). Update if you want different defaults.
- **BYOK only:** nothing to wire on the server. Leave the `DEMO_CHAT_*` + `DEMO_STT_OPENAI_API_KEY` vars unset in `.env` so the deployment stays out of demo mode. Visitors will see the Model Picker on first load.

After the wiring, restart `npm run dev` and send a chat message. Expected: the AI responds, and any tool calls (focus a field, set a value) reflect in the editor.

Wait for them to confirm.

### Step 6: customization

If `Keep everything` in Q6, skip this step entirely.

If `Strip the demo`, walk the user through these mechanical steps. They run in order; each one is a single command or a single small edit. Pause after each so the user can run it.

**6a — Delete the demo folders**

```sh
rm -rf src/components/demo src/components/easter-eggs src/server/demo
rm src/lib/demo/forms.ts
```

That removes: welcome modal, info modal, download modal (with the Pro upsell), social-share component, Cerfa d'Or easter egg, sample-form catalogue, demo-config resolver, misbehavior detector, preflight gate, demo-only loader server fns.

**Keep `src/lib/demo/demo_model.ts`** — despite the folder name it is the model registry, not demo-only: the retained chat path imports it (`chat_pane.tsx`, `model_picker_modal.tsx`, `api/chat.ts`, `server/language_model.ts`).

The deletes leave compile errors at these retained files; steps 6b-6g clear them one by one: `routes/index.tsx` (WelcomeModal, forms, loader helpers), `routes/api/chat.ts` / `api/summarize.ts` / `api/transcribe.ts` (preflight gate), `routes/api/transcribe.test.ts` (misbehavior import — delete that test file or its import), `components/layout.tsx` (InfoModal, CerfaDorModal), `components/error_banner.tsx` (SocialShare), `components/chat/chat_pane.tsx` (DownloadModal), plus the forms catalogue consumers (`form_picker.tsx`, `chat_pane.tsx`).

**6b — Replace the sample-form catalogue**

SimplePDF Copilot needs a single PDF URL to load on first paint. Recreate `src/lib/demo/forms.ts` (same path, so no import edits anywhere) with the customer's own:

```ts
export type FormId = 'default'

export type FormConfig = {
  id: FormId
  useCaseKey: string
  subtitleKey?: string
  labelKey: string
  pdfUrl: string
}

export type LocaleForms = {
  order: FormId[]
  forms: Record<FormId, FormConfig>
}

const FORM: FormConfig = {
  id: 'default',
  pdfUrl: 'https://your-cdn.example.com/your-form.pdf',
  // labelKey + useCaseKey are i18n keys; point them at strings you keep,
  // or hardcode short labels.
  labelKey: 'forms.labels.default',
  useCaseKey: 'forms.useCases.default',
}

export const DEFAULT_FORM_ID: FormId = 'default'
export const getDefaultFormIdForLocale = (_locale: string): FormId => 'default'
export const isFormId = (value: unknown): value is FormId => value === 'default'
export const getFormsForLocale = (_locale: string): LocaleForms => ({
  forms: { default: FORM },
  order: ['default'],
})
```

Two follow-up edits — `'custom'` (the demo's upload-your-own flow) is gone from the union, so both comparisons stop compiling:

- `routes/index.tsx`: replace the `requiresUserUpload = url === undefined && form === 'custom'` line with `const requiresUserUpload = false` (or keep a `'custom'` member if you want the native-file-picker flow).
- `components/form_picker.tsx`: the subtitle ternary `form.id === 'custom' ? t('forms.customSubtitle') : …` — drop the ternary, keeping `t(form.subtitleKey ?? form.useCaseKey)`.

Or wire a runtime loader (your own storage) — but the static one is fine for most forks.

**6c — Replace the demo gates with a single static resolution**

Three callers (`src/routes/api/chat.ts`, `src/routes/api/summarize.ts`, and `src/routes/api/transcribe.ts`) use `applyDemoPreflight` from the now-deleted `src/server/demo/gate.ts`. Replace the import + call with a static resolution that reads your API key from env (transcribe also reads `DEMO_STT_OPENAI_API_KEY` directly, so it keeps working once the preflight is replaced):

```ts
// at the top of chat.ts / summarize.ts / transcribe.ts, replace the demo import with
// (transcribe.ts only consumes bucket + lifetime from the resolution):
import { hashIp, getClientIp, isSameOrigin, looksLikeBrowserFetch } from '../../server/rate_limit'
import type { DemoModel } from '../../lib/demo/demo_model'

// inside the POST handler, replace the preflight block with:
const ip = getClientIp(request)
const ipHash = await hashIp(ip)
const resolution: { apiKey: string; bucket: string; lifetime: number; model: DemoModel } = {
  apiKey: process.env.AI_API_KEY ?? '',
  // The rate-limit bucket name is per-customer convention; "global"
  // collapses every IP into one bucket. Use whatever you want.
  bucket: 'global',
  lifetime: 1000, // very high cap; tighten if you want IP-rate-limiting
  model: 'anthropic_haiku_4_5', // a DEMO_MODELS handle from demo_model.ts, NOT a provider model id
}
```

**What this removes**: `applyDemoPreflight` was also a gate — it rejected cross-origin non-browser calls (`isSameOrigin` / `looksLikeBrowserFetch`, both retained in `src/server/rate_limit.ts`), blocked flagged IPs, and 503'd when unconfigured. With a server-side `AI_API_KEY` here, dropping all of that ships an open cross-origin LLM proxy. Keep at least the origin check at the top of the handler:

```ts
if (!isSameOrigin(request) && !looksLikeBrowserFetch(request)) {
  return new Response(null, { status: 403 })
}
```

If you don't want any IP-rate-limiting at all, you can also delete the whole rate-limit section in `chat.ts` (the `rateLimiter.isReady()` guard AND the `rateLimiter.check` call) — along with everything only it consumed: the `ip`/`ipHash` locals and the `hashIp`, `getClientIp` (unless kept for the origin check above), `rateLimiter`, and `RateLimitDecision` imports (`noUnusedLocals` turns any leftover into a build error). The limiter primitive in `src/server/rate_limit.ts` itself is generic and can stay — without `REDIS_URL` it falls back to an in-memory per-instance limiter (fine for a single container; multi-instance deploys need Redis).

**6d — Drop the demo references in `routes/index.tsx`**

The file imports `DemoGate`, `readDemoGate`, `readWelcomeDismissed`, and `writeWelcomeDismissedCookie` from `src/server/demo/loader_helpers.ts` (now deleted). Replace the import block AND the standalone `export type { DemoGate }` re-export just below it (keeping both would be a duplicate-identifier error) with:

```ts
import type { DemoModel } from '../lib/demo/demo_model'

// Keep the full union: retained code (chat_pane, model_picker_modal, voice
// capability resolution) branches on both members with exhaustive switches.
export type DemoGate = { kind: 'byok' } | { kind: 'demo'; model: DemoModel }

const STATIC_DEMO_GATE: DemoGate = { kind: 'byok' }
```

Then in the route's `loader`, replace the `Promise.all([readDemoGate(), readWelcomeDismissed()])` call with:

```ts
loader: async () => ({ demoGate: STATIC_DEMO_GATE }),
```

`welcomeDismissed` disappears from the loader data because everything it fed is going: remove the `WelcomeModal` import + JSX (`<WelcomeModal ... />`), the `dismissWelcome` callback (it calls the deleted `writeWelcomeDismissedCookie` server fn), and every remaining `welcomeDismissed` reference.

**6e — Drop demo references in `src/components/layout.tsx`**

Layout currently imports the (deleted) `InfoModal` from `./demo/info_modal` and `CerfaDorModal` from `./easter-eggs/cerfa_dor_modal`. Delete both imports + the JSX + the URL-search reading that opens them (`?show=info`, `?show=cerfa_dor`), and the header's info trigger (its `header.whatIsThisDemo` aria-label key dies in 6g).

With `?show=info` gone, the WelcomeBanner's info link in `chat_pane.tsx` points at nothing — delete that anchor (the `chat.welcomeInfoLink` line) too.

**6f — Drop the social share from the error banner, and the download modal from the chat pane**

`src/components/error_banner.tsx` references `SocialShare` from `./demo/social_share` (deleted). Delete the import and the whole share block (the `SocialShare` JSX plus the surrounding `chat.shareHero` copy). **Keep `RateLimitPanel`** — the retained `chat_pane.tsx` renders it on the voice rate-limit path.

`src/components/chat/chat_pane.tsx` imports `DownloadModal` from `../demo/download_modal` (deleted). Delete the import and its JSX/trigger.

**6g — Strip demo-flavoured locale keys**

Run a sweep across `src/locales/*.json` removing these keys (they're now unreferenced):

```
chat.shareHero, chat.shareCtaLabel, chat.shareCopyLink, chat.shareCopied, chat.shareTweetText
chat.welcomeInfoLink (its ?show=info target died in 6e)
header.whatIsThisDemo (the info trigger died in 6e)
welcomeModal.* (whole tree)
infoModal.* (whole tree EXCEPT infoModal.close — the retained ui/modal.tsx uses it as the close-button aria-label)
download.* (whole tree)
cerfaDor.* (whole tree — exists only in fr.json)
forms.* (whole tree — then add the two keys 6b's template references, forms.labels.default and forms.useCases.default, to each locale you keep, or hardcode the labels instead)
```

Keep `chat.welcomeTitle` / `chat.welcomeBody` / `chat.welcomeCta` and the `chat.errorRateLimited*` keys — the retained chat pane's BYOK empty state (`WelcomeBanner`) and rate-limit panel still render them.

Sweep the locale files with a tiny `python -c "import json, sys; ..."` one-liner per file.

Replace `header.brand` ("SimplePDF Copilot Demo") with the customer's brand name in en.json + every other locale.

**6h — Verify**

From inside the `copilot/` directory:

```sh
npx tsc --noEmit
npm run dev
```

Open `http://localhost:3001`. Expected: the chat sidebar shows the BYOK Model Picker (or sends straight to your server's `chat.ts` if you wired a static API key in step 6c), the editor loads your replacement PDF from step 6b, no welcome modal, no info modal trigger, no Cerfa easter egg.

If `tsc` or runtime fails: the most common cause is a stale import to a deleted file. Run `grep -rnE "from '.*(demo|easter-eggs)" src/` — any hit on a DELETED path is something missed in 6b-6g (hits on `lib/demo/demo_model` and `lib/demo/forms` are expected: both files still exist).

If `Custom: walk me through each`: ask them which feature they want to address first (sample forms / info modal / BYOK Model Picker / share-link UI / sample documents). Walk through ONE at a time, pausing after each.

### Step 7: deploy (skip if `Local only` in Q1)

Per their Q1 choice:

First, for every hosted target: **push the Step 5/6 changes to the user's fork** — deploying upstream `SimplePDF/simplepdf-embed` ships none of their work.

- **DigitalOcean App Platform:** the one-click URL and the bundled `.do/deploy.template.yaml` both reference `SimplePDF/simplepdf-embed` — substitute the user's fork: edit the template's `repo:` in their fork, then use `https://cloud.digitalocean.com/apps/new?repo=https://github.com/<their-owner>/simplepdf-embed/tree/main`. DigitalOcean will prompt for `VITE_SIMPLEPDF_COMPANY_IDENTIFIER` and (optionally) the demo vars (`DEMO_CHAT_API_KEY` / `DEMO_CHAT_MODEL` / `DEMO_RATE_LIMIT_TURNS` / `DEMO_STT_OPENAI_API_KEY`) / `REDIS_URL` / `IP_HASH_SALT`.
- **Cloudflare Containers:** GA since April 2026 on the Workers Paid plan ($5/mo). The Node + nitro stack runs as-is in a Linux container. Workflow: write a small Dockerfile (Node 24 base, `RUN npm ci && npm run build`, `CMD ["node", ".output/server/index.mjs"]`, expose port 3000), reference it from the wrangler config's container settings, then run `npx wrangler deploy`. See <https://developers.cloudflare.com/containers/>. Set secrets with `npx wrangler secret put DEMO_CHAT_API_KEY` (and the other demo vars) etc. Cloudflare's edge sits in front for free WAF + caching.
- **Vercel:** the nitro `node-server` preset works on Vercel's Node runtime. From the copilot folder, run `vercel deploy` and set the env vars via the dashboard or `vercel env add`.
- **Render / fly.io:** point the service at this repo, set build command `npm run build`, start command `npm start`, and configure env vars in the host's dashboard. fly.io needs a `Dockerfile` (build the production output, run `node .output/server/index.mjs`).
- **Custom Docker:** `npm run build` produces `.output/`. Bundle it in your Dockerfile, expose port 3000, run `node .output/server/index.mjs`.

Wait for them to confirm the deploy succeeded and they have a URL.

### Step 8: whitelist the deploy URL (CRITICAL: skip only if `Local only`)

Heads-up: an account with an **empty** whitelist allows the embed on **all** origins — whitelisting the first origin is what activates the allow-list (blocking everything else). So on a fresh account the deploy URL may load right away; whitelist it anyway so the account isn't left open to any origin.

The fastest path uses the editor's origin auto-detection:

1. Open the deploy URL in a browser (e.g. `https://my-app.example.com`). If the account already has whitelisted origins, the embed won't work there (the editor loads but stays inert), but the attempted origin is recorded server-side.
2. In another tab, open `https://<companyIdentifier>.simplepdf.com/account/embed` (replace `<companyIdentifier>` with their value from Q3).
3. In the **Security** section, click **Whitelist origin** — the modal it opens lists the **Detected origins**, including the one from step 1, ready to approve. Click it (no typing, no risk of protocol/trailing-slash mismatch).
4. Refresh the deploy URL. The iframe now loads.

If they prefer to whitelist before opening the deploy URL: the same **Whitelist origin** modal also accepts a manually-typed origin. Match the protocol (`https://`) and host without a trailing slash.

Then open the deploy URL. The iframe should load. If not, the most likely causes:

- Whitelist hasn't propagated yet: refresh after 30s.
- URL mismatch (protocol, subdomain, or trailing-slash mismatch). Check the dashboard entry against the deploy URL exactly.

Wait for them to confirm the iframe loads.

### Step 9: end-to-end smoke

Walk through one full chat turn on the deployed URL:

1. Open the chat sidebar.
2. (BYOK) Open the Model Picker, paste a key, send a message. (Demo mode) Just send a message — demo mode is on whenever your keys are configured, no URL params needed.
3. Confirm the AI responds and any tool calls reflect in the editor (e.g. a field gets focused, a value gets filled).

Once that's confirmed, you're done.

---

## Done

Wrap with: _"You're set. SimplePDF Copilot is running on your domain, talking to your AI provider, whitelisted on your account. The README at `copilot/README.md` has more on customization. Reach engineering@simplepdf.com if you hit anything weird."_

Do NOT add a recap, a checklist, or a "what's next" section unless the user asks.

---

## Fallback

If the user asks anything outside the scope of this fork-and-go journey (pricing, plan comparison, embedding the editor without SimplePDF Copilot, debugging an unrelated SimplePDF feature), point them at:

- Pricing / plans: https://simplepdf.com/pricing
- General docs: https://simplepdf.com/help
- Iframe API contract: https://github.com/SimplePDF/simplepdf-embed/blob/main/documentation/IFRAME.md
- React component: https://github.com/SimplePDF/simplepdf-embed/blob/main/react/README.md
- AI-friendly product summary: https://simplepdf.com/llms.txt
