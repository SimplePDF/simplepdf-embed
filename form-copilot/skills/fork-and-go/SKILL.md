# Fork and Go

A guided walkthrough for SimplePDF Pro customers forking and deploying their own Form Copilot.

## Purpose

Walk a developer through forking the Form Copilot reference implementation into their own product. Covers hosting choice, Pro-account confirmation, AI-provider wiring, demo customization, deploy, and the SimplePDF whitelist step. End state: a running Form Copilot at their chosen URL, talking to their AI provider, whitelisted on their account.

## Triggers

Invoke when the user types `/fork-and-go` or any natural-language equivalent:

- "Help me fork Form Copilot"
- "How do I deploy Form Copilot?"
- "I want to ship Form Copilot inside my app"
- "Set up Form Copilot for me"
- "Walk me through deploying Form Copilot"

---

## Open with a short greeting

Before any question, greet the user in one or two friendly sentences:

- Say what you're about to help them with: getting Form Copilot running in their setup.
- Set expectations: you'll ask a couple of quick questions, then walk them through wiring it.
- Be warm but concise. No bullet lists, no headers, no markdown formatting in the greeting itself.

Example shape: _"Let me help you get Form Copilot running in your setup. I'll ask a few quick questions to figure out the right path, then we'll wire it together step by step."_

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

- **Question:** Where do you want Form Copilot to run?
- **Header:** `Host`
- **Options:**
  - `Local only` (Recommended): _"Just `npm run dev` on your dev machine, served at `http://localhost:3001`. The demo's SimplePDF workspace whitelists that exact origin, so no Pro account is needed. The port has to stay 3001."_
  - `DigitalOcean App Platform`: _"One-click deploy via the bundled `.do/deploy.template.yaml`. Cheapest hosted option (~$12-24/mo)."_
  - `Cloudflare Containers`: _"GA since April 2026. Workers Paid plan ($5/mo) required. The form-copilot Node + nitro stack runs as-is in a Linux container. Needs a small Dockerfile and a `wrangler containers` deploy."_
  - `Vercel / Render / fly.io`: _"Other PaaS hosts. The Vercel AI SDK + nitro `node-server` stack works on all of them; we'll set up env vars + build commands."_
  - `Custom (Docker, my own server)`: _"Run the production build (`npm start`) wherever you want."_

DO NOT proceed until they answer.

### Q2: Pro account

After Q1, use `AskUserQuestion`:

- **Question:** Form Copilot is available on the SimplePDF Pro plan and above (white-labelling and programmatic control are gated there). Do you have a Pro account or higher?
- **Header:** `Plan`
- **Options:**
  - `Yes, I have Pro or higher`: _"Great, we'll wire it up with your companyIdentifier next."_
  - `No, but I'll get one`: _"I'll point you at the sign-up flow next, with one tip about which welcome path to pick."_
  - `Just exploring`: _"Local-only is fine without a Pro account (the demo workspace whitelists `localhost:3001`). Hosted deploy is gated on Pro."_

If they pick `No, but I'll get one`, send them this exact guidance and pause until they confirm:

> _"Sign up at https://simplepdf.com/auth/signup. The welcome flow will ask whether you want to **embed SimplePDF in your app** or **collect submissions**. Pick **'collect submissions'**: that path is short and gets you straight to plan selection, which is what you actually need here. The 'embed in my app' welcome takes you through an integration walkthrough (React / iframe / WordPress / etc.) that you don't need for fork-and-go, since you're already wiring up the embed yourself via this skill. After completing the short onboarding, choose the **Pro** plan (or higher). Your `companyIdentifier` is visible in the dashboard sidebar, right under your company name (a small monospaced chip)."_

If `Just exploring`: set the expectation clearly that local-only works but hosted requires Pro, then proceed (use the demo's `form-copilot` companyIdentifier as a placeholder).

### Q3: companyIdentifier

If they have or will have Pro (or higher), ask in plain text (no `AskUserQuestion`):

_"What's your SimplePDF companyIdentifier? It's the subdomain piece of `<companyIdentifier>.simplepdf.com`. Open your SimplePDF dashboard and look at the sidebar: the identifier is the small chip right under your company name."_

If `Just exploring`, skip this and use `form-copilot` as the placeholder; remind them once near deploy time.

### Q4: AI provider

Use `AskUserQuestion`:

- **Question:** Which AI provider should Form Copilot use server-side?
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
  - `Keep everything` (Recommended): _"BYOK Model Picker, sample forms, info modal, all of it. Easiest to start; trim later once you know what you want."_
  - `Minimal: drop demo bits`: _"Remove the sample forms, info modal, and demo-flavored copy. You'll wire up your own document loader."_
  - `Custom: walk me through each`: _"We'll go through each demo feature one at a time."_

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

If the user already has the form-copilot directory open (their cwd looks like `…/form-copilot/`), skip to Step 2. Otherwise:

```sh
git clone https://github.com/SimplePDF/simplepdf-embed.git
cd simplepdf-embed/form-copilot
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

- Set `VITE_SIMPLEPDF_COMPANY_IDENTIFIER=<their value from Q3>`. If they're `Just exploring`, leave it as `form-copilot`.
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
2. Their `companyIdentifier` is set to a value that doesn't match an account whitelisting `localhost:3001`. The demo's `form-copilot` identifier covers it. Their own Pro identifier requires them to add `http://localhost:3001` to the embed-origins whitelist in their SimplePDF dashboard.

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

If `Minimal: drop demo bits`:

- **Sample forms**: `src/lib/forms.ts` defines `ALL_FORMS`. Replace the entries with your own document URLs (or delete the static map and wire a runtime loader from your storage).
- **Info modal**: `src/components/info_modal.tsx`. Delete the `<InfoModal>` import in `src/components/header.tsx` (or wherever it's mounted) and the file itself.
- **Demo-flavored copy**: search `src/locales/en.json` for `"Form Copilot Demo"`, `"chat.shareTweetText"`, `"infoModal.*"`, and replace with your branded copy. Mirror the changes to the other 22 locales (`src/locales/<locale>.json`) or use the project's `translator` agent.

If `Custom: walk me through each`: ask them which feature they want to address first (sample forms / info modal / BYOK Model Picker / share-link UI / sample documents). Walk through ONE at a time, pausing after each.

### Step 7: deploy (skip if `Local only` in Q1)

Per their Q1 choice:

- **DigitalOcean App Platform:** click the deploy button at <https://cloud.digitalocean.com/apps/new?repo=https://github.com/SimplePDF/simplepdf-embed/tree/main>. The repo's `.do/deploy.template.yaml` drives it. DigitalOcean will prompt for `VITE_SIMPLEPDF_COMPANY_IDENTIFIER` and (optionally) `SHARED_API_KEYS` / `REDIS_URL` / `IP_HASH_SALT`.
- **Cloudflare Containers:** GA since April 2026 on the Workers Paid plan ($5/mo). The Node + nitro stack runs as-is in a Linux container. Workflow: write a small Dockerfile (Node 24 base, `RUN npm ci && npm run build`, `CMD ["node", ".output/server/index.mjs"]`, expose port 3000), then `npx wrangler containers deploy` from a `wrangler.toml` that binds env vars and ties the container to a Worker route. See <https://developers.cloudflare.com/containers/>. Set secrets with `npx wrangler secret put SHARED_API_KEYS` etc. Cloudflare's edge sits in front for free WAF + caching.
- **Vercel:** the nitro `node-server` preset works on Vercel's Node runtime. From the form-copilot folder, run `vercel deploy` and set the env vars via the dashboard or `vercel env add`.
- **Render / fly.io:** point the service at this repo, set build command `npm run build`, start command `npm start`, and configure env vars in the host's dashboard. fly.io needs a `Dockerfile` (build the production output, run `node .output/server/index.mjs`).
- **Custom Docker:** `npm run build` produces `.output/`. Bundle it in your Dockerfile, expose port 3000, run `node .output/server/index.mjs`.

Wait for them to confirm the deploy succeeded and they have a URL.

### Step 8: whitelist the deploy URL (CRITICAL: skip only if `Local only`)

In the SimplePDF dashboard:

1. Go to Settings → Embed origins (the exact label may have evolved; the section concerns "where can the editor be embedded").
2. Add their deploy URL: `https://my-app.example.com` (or whatever was assigned).
3. Save.

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

Wrap with: _"You're set. Form Copilot is running on your domain, talking to your AI provider, whitelisted on your account. The README at `form-copilot/README.md` has more on customization. Reach engineering@simplepdf.com if you hit anything weird."_

Do NOT add a recap, a checklist, or a "what's next" section unless the user asks.

---

## Fallback

If the user asks anything outside the scope of this fork-and-go journey (pricing, plan comparison, embedding the editor without Form Copilot, debugging an unrelated SimplePDF feature), point them at:

- Pricing / plans: https://simplepdf.com/pricing
- General docs: https://simplepdf.com/help
- Iframe API contract: https://github.com/SimplePDF/simplepdf-embed/blob/main/documentation/IFRAME.md
- React component: https://github.com/SimplePDF/simplepdf-embed/blob/main/react/README.md
- AI-friendly product summary: https://simplepdf.com/llms.txt
