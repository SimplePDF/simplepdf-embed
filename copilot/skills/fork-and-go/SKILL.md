# Fork and Go

A guided walkthrough for SimplePDF Pro customers forking and deploying their own SimplePDF Copilot.

## Purpose

Walk a developer through forking the SimplePDF Copilot reference implementation into their own product. Covers hosting choice, Pro-account confirmation, AI-provider wiring, demo customization, deploy, and the SimplePDF whitelist step. End state: a running SimplePDF Copilot at their chosen URL, talking to their AI provider, whitelisted on their account.

## Triggers

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

When asking the user to pick between known options, ALWAYS use the `AskUserQuestion` tool, never a plain text list. Free-text answers (e.g. "what's your companyIdentifier?") use a regular question.

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
  - `Cloudflare Containers`: _"GA since April 2026. Workers Paid plan ($5/mo) required. The copilot Node + nitro stack runs as-is in a Linux container. Needs a small Dockerfile and a `wrangler containers` deploy."_
  - `Vercel / Render / fly.io`: _"Other PaaS hosts. The Vercel AI SDK + nitro `node-server` stack works on all of them; we'll set up env vars + build commands."_
  - `Custom (Docker, my own server)`: _"Run the production build (`npm start`) wherever you want."_

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
  - `Anthropic Claude` (Recommended): _"Default in the demo (Haiku 4.5). Mature tool-calling, broad ecosystem support, predictable pricing."_
  - `OpenAI`: _"GPT-4 / GPT-5 family. Solid alternative."_
  - `DeepSeek`: _"In our testing, on par with Anthropic Claude Haiku 4.5 for the form-filling task, at a meaningfully lower cost per turn."_
  - `Custom OpenAI-compatible (Ollama, LM Studio, vLLM)`: _"Local or self-hosted endpoint. The browser-direct BYOK path covers this; your server isn't in the loop."_
  - `BYOK only: let users bring their own key`: _"No server-side provider. Visitors paste their own key in the in-app Model Picker. Lowest ops surface."_

### Q5: invite-link mode

ONLY ask if they didn't pick `BYOK only` in Q4. Use `AskUserQuestion`:

- **Question:** Want to enable invite-link mode (`?share=<id>`) so non-technical users can chat without pasting a key?
- **Header:** `Sharing`
- **Options:**
  - `Yes, set up SHARED_API_KEYS`: _"Share a URL like `https://your-app.com/?share=preview-alice` and visitors land already wired up. Per-share rate limits keep cost bounded."_
  - `No, BYOK only`: _"Every visitor brings their own key. No server-side LLM cost from your account."_

### Q6: customization

Use `AskUserQuestion`:

- **Question:** Keep all the demo features, or trim down?
- **Header:** `Customize`
- **Options:**
  - `Keep everything` (Recommended): _"BYOK Model Picker, sample forms, welcome splash, info modal, all of it. Easiest to start; trim later once you know what you want."_
  - `Strip the demo`: _"Delete the entire `demo/` tree (welcome modal, info modal, download modal upsell, social-share, sample forms, share-link / shared-key gating, misbehavior detector). Roughly 4 folder deletes + 5 small import edits. You keep the chat surface, BYOK Model Picker, iframe bridge, locale system."_
  - `Custom: walk me through each`: _"We'll go through each demo feature one at a time."_

Demo code is grouped under `demo/` directories specifically so the strip is mechanical:
- `src/components/demo/` — welcome modal, info modal, download modal, social share
- `src/components/easter-eggs/` — Cerfa d'Or French easter egg
- `src/lib/demo/` — sample-form catalogue, demo model registry
- `src/server/demo/` — preflight gate, share-key resolution, misbehavior detector, loader server fns

---

## Whitelisting reminder (Q7-equivalent)

After Q6, BEFORE writing any code, mention in plain prose (NOT a question):

> "One thing to flag now so it's not a surprise later: the SimplePDF iframe only loads on origins your account whitelists. The demo workspace whitelists `localhost:3001` so local dev works out of the box. For your own deploy URL (e.g. `https://my-app.example.com`), you'll need to add it to your SimplePDF dashboard's embed-origins list before the iframe will load. I'll remind you again at deploy time."

If they picked `Local only` in Q1, skip this entirely (the demo workspace already covers them).

This is informational. Do NOT pause for an answer; continue to the wiring sequence.

---

## Wiring sequence

After all the questions are answered, walk through these steps. ONE step per turn. Pause after each for the user to confirm before moving to the next.

### Step 1: verify the clone

If the user already has the copilot directory open (their cwd looks like `…/copilot/`), skip to Step 2. Otherwise:

```sh
git clone https://github.com/SimplePDF/simplepdf-embed.git
cd simplepdf-embed/copilot
```

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

- Set `VITE_SIMPLEPDF_COMPANY_IDENTIFIER=<their value from Q3>`. If they're `Just exploring`, leave it as `spdf-copilot`.
- If they answered `Yes, set up SHARED_API_KEYS` in Q5, paste a JSON map per the format in `.env.example`. The base64 fallback works if their host mangles JSON quotes.
- For multi-container hosted deploys (DO App Platform with auto-scaling), recommend setting `REDIS_URL` (any Redis-compatible URL: DO Managed Caching for Valkey works) and `IP_HASH_SALT` (generate with `openssl rand -hex 32`). Required pair when `REDIS_URL` is set; the server refuses to boot otherwise.

Wait for confirmation that `.env` is filled in.

### Step 4: local smoke test

```sh
npm run dev
```

Open http://localhost:3001. Expected:

- The iframe loads with a demo sample form.
- The chat sidebar shows the Model Picker (if BYOK) or is ready to send (if `?share=<id>`).

The dev script pins port 3001 deliberately. The SimplePDF workspace tied to the `companyIdentifier` whitelists exactly the origin `http://localhost:3001` and only that origin: any other port (3000, 5173) or any other host gets refused at iframe load. Don't override the port with `--port` flags.

If the iframe fails to load:

1. The dev server is not on port 3001. Re-run `npm run dev` without overrides.
2. Their `companyIdentifier` is set to a value that doesn't match an account whitelisting `localhost:3001`. The demo's `spdf-copilot` identifier covers it. Their own Pro identifier requires them to whitelist `http://localhost:3001` themselves. Easiest path: just load `http://localhost:3001` in the browser once (the iframe will refuse to render, but the editor records the attempted origin), then open `https://<companyIdentifier>.simplepdf.com/account/embed`, scroll to **Security**, and the auto-detected origin will be there ready to one-click approve. Refresh the local page; the iframe now loads.

Wait for them to confirm the editor renders.

### Step 5: wire AI provider

Open `src/server/language_model.ts`. The current dispatch handles Anthropic and DeepSeek by name. Per their Q4 choice:

- **Anthropic Claude:** set `ANTHROPIC_API_KEY` in `.env` (or per-share inside `SHARED_API_KEYS.<id>.api_key`). No code change needed.
- **OpenAI:** set `OPENAI_API_KEY` in `.env`. Add an OpenAI branch to `language_model.ts` (`@ai-sdk/openai` is already installed; create a model handle in `src/lib/demo_model.ts` and wire the dispatch).
- **DeepSeek:** set `DEEPSEEK_API_KEY` in `.env`. Already wired.
- **Custom OpenAI-compatible:** the browser-direct BYOK path in `src/lib/byok/` already supports any OpenAI-compatible endpoint. Defaults are in `src/lib/byok/providers.ts` (Ollama URL + a default model name). Update if you want different defaults.
- **BYOK only:** nothing to wire on the server. Make sure `SHARED_API_KEYS` is empty in `.env`. Visitors will see the Model Picker on first load.

After the wiring, restart `npm run dev` and send a chat message. Expected: the AI responds, and any tool calls (focus a field, set a value) reflect in the editor.

Wait for them to confirm.

### Step 6: customization

If `Keep everything` in Q6, skip this step entirely.

If `Strip the demo`, walk the user through these mechanical steps. They run in order; each one is a single command or a single small edit. Pause after each so the user can run it.

**6a — Delete the demo folders**

```sh
rm -rf src/components/demo src/components/easter-eggs src/lib/demo src/server/demo
```

That removes: welcome modal, info modal, download modal (with the Pro upsell), social-share component, Cerfa d'Or easter egg, sample-form catalogue, demo model registry, share-key resolver, misbehavior detector, preflight gate, demo-only loader server fns.

**6b — Replace the sample-form catalogue**

SimplePDF Copilot needs a single PDF URL to load on first paint. Create `src/lib/forms.ts` with the customer's own:

```ts
export type FormId = 'default'
export const DEFAULT_FORM_ID: FormId = 'default'
export const isFormId = (value: unknown): value is FormId => value === 'default'

const FORM = {
  id: 'default' as const,
  pdfUrl: 'https://your-cdn.example.com/your-form.pdf',
  // labelKey + useCaseKey + subtitleKey are i18n keys; point them at any
  // string you already have, or hardcode short labels.
  labelKey: 'forms.labels.default',
  useCaseKey: 'forms.useCases.default',
}

export const getFormsForLocale = (_locale: string) => ({
  forms: { default: FORM },
  order: ['default'] as const,
})
```

Or wire a runtime loader (your own storage) — but the static one is fine for most forks.

**6c — Replace the demo gates with a single static resolution**

Two callers (`src/routes/api/chat.ts` and `src/routes/api/summarize.ts`) use `applyDemoPreflight` from the now-deleted `src/server/demo/gate.ts`. Replace the import + call with a static resolution that reads your API key from env:

```ts
// at the top of chat.ts / summarize.ts, replace the demo import with:
import { hashIp, getClientIp } from '../../server/rate_limit'

// inside the POST handler, replace the preflight block with:
const ip = getClientIp(request)
const ipHash = await hashIp(ip)
const resolution = {
  apiKey: process.env.AI_API_KEY ?? '',
  // The rate-limit bucket name is per-customer convention; "global"
  // collapses every IP into one bucket. Use whatever you want.
  bucket: 'global',
  lifetime: 1000,  // very high cap; tighten if you want IP-rate-limiting
  model: 'claude-haiku-4-5-20251001' as const,  // your model id
}
```

If you don't want any IP-rate-limiting at all, you can also delete the `rateLimiter.check` block that follows in `chat.ts`. The limiter primitive in `src/server/rate_limit.ts` itself is generic and can stay (it gets a no-op fallback when `REDIS_URL` is unset).

**6d — Drop the demo references in `routes/index.tsx`**

The file imports `DemoGate`, `readDemoGate`, `readWelcomeDismissed`, `WELCOME_DISMISSED_COOKIE` from `src/server/demo/loader_helpers.ts` (now deleted). Replace the import block with:

```ts
type DemoGate = { kind: 'byok' }  // there's only one path now
export type { DemoGate }
```

Then in the route's `loader`, replace the `Promise.all([readDemoGate(...), readWelcomeDismissed()])` call with:

```ts
loader: async () => ({ demoGate: { kind: 'byok' as const }, welcomeDismissed: true }),
```

`welcomeDismissed: true` keeps the welcome modal off forever — but since `WelcomeModal` is also deleted in step 6a, the field becomes unused. Delete the prop and references too.

Also remove the `WelcomeModal` import + JSX (`<WelcomeModal ... />`), the `dismissWelcome` callback, the `WELCOME_DISMISSED_COOKIE` reference, and the `?share=` validation in `validateSearch` (the share param has nothing to gate against now).

**6e — Drop demo references in `src/components/layout.tsx`**

Layout currently imports the (deleted) `InfoModal` from `./demo/info_modal` and `CerfaDorModal` from `./easter-eggs/cerfa_dor_modal`. Delete both imports + the JSX + the URL-search reading that opens them (`?show=info`, `?show=cerfa_dor`).

**6f — Drop the rate-limit panel + social share from the error banner**

`src/components/error_banner.tsx` references `SocialShare` from `./demo/social_share` (deleted). Delete the import and the `RateLimitPanel` definition (it's only useful when the demo's per-share cap fires, which can't happen without the gate).

**6g — Strip demo-flavoured locale keys**

Run a sweep across `src/locales/*.json` removing these keys (they're now unreferenced):

```
chat.shareHero, chat.shareCtaLabel, chat.shareCopyLink, chat.shareCopied, chat.shareTweetText
chat.errorRateLimitedTitle, chat.errorRateLimitedBodyThanks, chat.errorRateLimitedBodyCta, chat.errorRateLimitedCtaButton
chat.welcomeTitle, chat.welcomeBody, chat.welcomeCta, chat.welcomeInfoLink
welcomeModal.* (whole tree)
infoModal.* (whole tree)
download.* (whole tree)
cerfaDor.* (whole tree)
forms.* (whole tree, unless your replacement in 6b uses these keys)
```

Use the project's `/translator` agent for the multi-locale removal, or write a tiny `python -c "import json, sys; ..."` one-liner.

Replace `header.brand` ("SimplePDF Copilot Demo") with the customer's brand name in en.json + every other locale.

**6h — Verify**

From inside the `copilot/` directory:

```sh
npx tsc --noEmit
npm run dev
```

Open `http://localhost:3001`. Expected: the chat sidebar shows the BYOK Model Picker (or sends straight to your server's `chat.ts` if you wired a static API key in step 6c), the editor loads your replacement PDF from step 6b, no welcome modal, no info modal trigger, no Cerfa easter egg.

If `tsc` or runtime fails: the most common cause is a stale import to a deleted file. Search for `from '.*demo'` and `from '.*easter-eggs'` across `src/` — any remaining hit is something missed in 6c-6f.

If `Custom: walk me through each`: ask them which feature they want to address first (sample forms / info modal / BYOK Model Picker / share-link UI / sample documents). Walk through ONE at a time, pausing after each.

### Step 7: deploy (skip if `Local only` in Q1)

Per their Q1 choice:

- **DigitalOcean App Platform:** click the deploy button at <https://cloud.digitalocean.com/apps/new?repo=https://github.com/SimplePDF/simplepdf-embed/tree/main>. The repo's `.do/deploy.template.yaml` drives it. DigitalOcean will prompt for `VITE_SIMPLEPDF_COMPANY_IDENTIFIER` and (optionally) `SHARED_API_KEYS` / `REDIS_URL` / `IP_HASH_SALT`.
- **Cloudflare Containers:** GA since April 2026 on the Workers Paid plan ($5/mo). The Node + nitro stack runs as-is in a Linux container. Workflow: write a small Dockerfile (Node 24 base, `RUN npm ci && npm run build`, `CMD ["node", ".output/server/index.mjs"]`, expose port 3000), then `npx wrangler containers deploy` from a `wrangler.toml` that binds env vars and ties the container to a Worker route. See <https://developers.cloudflare.com/containers/>. Set secrets with `npx wrangler secret put SHARED_API_KEYS` etc. Cloudflare's edge sits in front for free WAF + caching.
- **Vercel:** the nitro `node-server` preset works on Vercel's Node runtime. From the copilot folder, run `vercel deploy` and set the env vars via the dashboard or `vercel env add`.
- **Render / fly.io:** point the service at this repo, set build command `npm run build`, start command `npm start`, and configure env vars in the host's dashboard. fly.io needs a `Dockerfile` (build the production output, run `node .output/server/index.mjs`).
- **Custom Docker:** `npm run build` produces `.output/`. Bundle it in your Dockerfile, expose port 3000, run `node .output/server/index.mjs`.

Wait for them to confirm the deploy succeeded and they have a URL.

### Step 8: whitelist the deploy URL (CRITICAL: skip only if `Local only`)

The fastest path uses the editor's origin auto-detection:

1. Open the deploy URL in a browser (e.g. `https://my-app.example.com`). The iframe will refuse to load because the origin isn't whitelisted yet, but the editor records the attempted origin server-side.
2. In another tab, open `https://<companyIdentifier>.simplepdf.com/account/embed` (replace `<companyIdentifier>` with their value from Q3).
3. Scroll to the **Security** section. The auto-detected origin from step 1 is listed there ready to approve. Click to whitelist it (no typing, no risk of protocol/trailing-slash mismatch).
4. Refresh the deploy URL. The iframe now loads.

If they prefer to whitelist before opening the deploy URL: the **Security** section also has a manual **Whitelist origin** button. Match the protocol (`https://`) and host without a trailing slash.

Then open the deploy URL. The iframe should load. If not, the most likely causes:

- Whitelist hasn't propagated yet: refresh after 30s.
- URL mismatch (protocol, subdomain, or trailing-slash mismatch). Check the dashboard entry against the deploy URL exactly.

Wait for them to confirm the iframe loads.

### Step 9: end-to-end smoke

Walk through one full chat turn on the deployed URL:

1. Open the chat sidebar.
2. (BYOK) Open the Model Picker, paste a key, send a message. (Server-paid) Just send a message after appending `?share=<id>` to the URL.
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
