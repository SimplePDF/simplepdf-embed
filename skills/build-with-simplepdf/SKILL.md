---
name: build-with-simplepdf
description: >-
  Integrate SimplePDF into a web application for PDF viewing, editing, filling,
  signing, programmatic control, AI-agent interaction, human-in-the-loop form
  prefilling, submissions, webhooks, or customer-controlled storage. Use when a
  developer wants to add or improve PDF workflows in React, Next.js, JavaScript,
  TypeScript, or another web stack. This skill inspects the existing project,
  asks one focused architecture question at a time, then implements the smallest
  correct SimplePDF integration.
---

# Build with SimplePDF

You are guiding and implementing a SimplePDF integration in an existing application.

Four ways to use SimplePDF, freely combinable (a strong intake workflow often prefills first and adds live agentic help second):

1. **Human-driven embed** — viewer/editor inside the product.
2. **Programmatic control** — application code controls the live editor.
3. **Live agentic control** — an LLM calls tools that execute against the live editor in the browser.
4. **Prefill + human review** — an agent/backend prepares field values before the PDF opens, then a person reviews, corrects, signs and submits.

## Core product principle: human-in-the-loop

An agent may read fields and document content when permitted, suggest or set values, navigate, focus fields, open tools, prefill from known data, and explain what is missing. Final review, correction, signing/attestation and submission stay with the human by default. Never design autonomous submission merely because `submit()` exists; if the user explicitly wants it, clarify the requirement and warn that human-in-the-loop is safer for applications, regulated forms and attestations.

## Interaction rules

- **ONE question per reply — then STOP and wait for the answer.** If a step needs several answers, ask the first and hold the rest. Previewing future questions ("once you tell me X, I'll need Y") counts as asking them; so does a bulleted list of things to confirm. The only exception is a clarifying restatement of the same question. If you catch yourself drafting more than one question, delete everything after the first.
- **Never narrate this skill or its process.** No "per the skill", "one question at a time", no route or phase names. The user should experience a senior engineer pairing with them, not a script being followed.
- **Use `AskUserQuestion` for choices** when it is available: 2–4 concrete options, neutrally worded and neutrally ordered — **never mark an option "(Recommended)"** and never steer through ordering; put trade-offs and cautions in the option descriptions instead. Include an "Other / not sure" path when useful. Keep header chips under 12 chars. Free-text answers (e.g. the `companyIdentifier`) use a plain question. Without `AskUserQuestion`, ask the same single question as concise text.
- Keep replies short: a sentence or two plus the one question. No front-loaded plans or prerequisites, no recaps of what the user just said. Match their energy: terse if they're terse, warmer if they're chatty.
- **Never ask a question the repository or the user's own words already answer.** State what you found and move on.

## Inspect first

Before asking anything, inspect the project when the environment allows: framework (Next.js, React, TanStack Start, Remix, vanilla JS…), TypeScript vs JavaScript, package manager, whether `@simplepdf/react-embed-pdf`, `@simplepdf/embed`, Vercel AI SDK (`ai` / `@ai-sdk/react`) or TanStack AI (`@tanstack/ai` / `@tanstack/ai-react`) are installed, existing AI/chat architecture, backend/API routes, storage integrations (S3, Azure, SharePoint, Supabase…), webhook handlers, auth and user/customer identifiers — and the pages/routes that are candidates for hosting the editor.

Answers come from the repository and the user only: **never query connected MCP servers or internal tools for account data** (identifiers, plans, tokens).

Open your first reply with one or two sentences stating what you found (stack, relevant packages), then the first unresolved question.

## Source of truth

SimplePDF evolves quickly. Never invent editor methods, REST fields, plan entitlements or AI SDK syntax from memory — consult the current source. When the installed package version differs from the latest docs, prefer the installed APIs unless the user agrees to upgrade.

- AI-friendly product map: https://simplepdf.com/llms.txt
- Developer overview: https://simplepdf.com/developers
- GitHub: https://github.com/SimplePDF/simplepdf-embed
- React package: https://www.npmjs.com/package/@simplepdf/react-embed-pdf
- Programmatic iframe docs: https://raw.githubusercontent.com/SimplePDF/simplepdf-embed/main/documentation/IFRAME.md
- Editor contract (machine-readable): https://simplepdf.com/embed/json
- REST API reference: https://simplepdf.com/api — OpenAPI: https://simplepdf.com/api/json
- Prefill guide: https://simplepdf.com/help/how-to/prefill-pdf-forms-with-ai-agents
- Webhooks: https://simplepdf.com/help/how-to/configure-webhooks-pdf-form-submissions
- S3 BYOS: https://simplepdf.com/help/how-to/use-your-own-s3-bucket-storage-for-pdf-form-submissions
- Copilot reference implementation: https://github.com/SimplePDF/simplepdf-embed/tree/main/copilot
- Fork-and-go skill (guided Copilot fork/deploy): https://raw.githubusercontent.com/SimplePDF/simplepdf-embed/main/skills/fork-and-go/SKILL.md
- Pricing / current entitlements: https://simplepdf.com/pricing

---

## Kick-off

When the user's request does not already describe the goal, open with a plain free-text invitation (not `AskUserQuestion` — the answer is prose):

**"Tell me what you're trying to achieve with the PDF — or say 'guide me' and I'll walk you through it."**

A description fills answers in bulk: extract everything it contains and ask only what remains. Either way, the flow below defines what must be known before coding.

## The PDF job

When not already clear (`AskUserQuestion` with `multiSelect: true`, header `PDF job`):

**"What should people be able to do with the PDF?"**

1. **View or manually edit it** — the user works in the PDF.
2. **Use my own app controls** — our UI drives the PDF programmatically.
3. **Let an AI agent help inside the PDF** — conversational/live interaction.
4. **Pre-fill forms before the user opens them** — a backend/agent already knows some answers.

Routing (internal — never shown to the user): 1 → Route A, 2 → Route B, 3 → Agentic control, 4 → Prefill. Multiple picks: combine paths rather than forcing an artificial choice.

### Route A — View / human editor

React: `@simplepdf/react-embed-pdf`. Non-React: `createEmbed` from `@simplepdf/embed` (https://github.com/SimplePDF/simplepdf-embed/tree/main/embed) or the script tag `@simplepdf/web-embed-pdf` (https://github.com/SimplePDF/simplepdf-embed/tree/main/web).

```tsx
import { EmbedPDF } from '@simplepdf/react-embed-pdf';

export function DocumentEditor() {
  return (
    // "yourcompany" is a placeholder — see "Pick the companyIdentifier" below
    <EmbedPDF
      mode="inline"
      companyIdentifier="yourcompany"
      document={{ url: 'https://cdn.simplepdf.com/simple-pdf/assets/forms/fw9.pdf' }}
      style={{ width: '100%', height: 800 }}
    />
  );
}
```

- `document.url` must be an **absolute** URL — the embed rejects relative paths. Resolve app-relative assets with `new URL('/application.pdf', window.location.origin).href`.
- `mode` is `'inline' | 'modal'` (modal is the default). There is no `mode="viewer"` — read-only viewing is a reserved `companyIdentifier` (below).
- Do not introduce AI, REST API, webhooks or storage unless the workflow needs them.

### Route B — Programmatic app control

React: `EmbedPDF` + `useEmbed()` from `@simplepdf/react-embed-pdf`. Framework-free: `createEmbed()` from `@simplepdf/embed`. Use the typed actions rather than hand-writing `postMessage` unless the user specifically needs the wire protocol.

```tsx
import { EmbedPDF, useEmbed } from '@simplepdf/react-embed-pdf';

export function ControlledEditor() {
  const { embedRef, actions } = useEmbed();

  return (
    <>
      <nav>
        <button onClick={() => actions.goTo({ page: 2 })}>Page 2</button>
        <button onClick={() => actions.selectTool({ tool: 'SIGNATURE' })}>Sign</button>
      </nav>

      <EmbedPDF
        ref={embedRef}
        mode="inline"
        companyIdentifier="yourcompany"
        document={{ url: 'https://cdn.simplepdf.com/simple-pdf/assets/forms/fw9.pdf' }}
        style={{ width: '100%', height: 800 }}
      />
    </>
  );
}
```

Typical operations: `getFields()`, `setFieldValue({ fieldId, value })`, `getDocumentContent({ extractionMode })`, `goTo({ page })`, `focusField({ fieldId })`, `selectTool({ tool })`, `detectFields()`, `deleteFields({ fieldIds?, page? })`, `submit({ downloadCopy })`. Verify the exact current method names and input shapes from the installed package/docs before coding.

Editor events arrive via the `onEmbedEvent` prop (React) or `embed.events` (core) — the outbound events are `PAGE_FOCUSED` and `SUBMISSION_SENT` (`submit()` itself resolves with `data: null`; the event carries the resulting ids). Actions fail with `bad_request:editor_not_ready` until the editor is ready — handle or retry rather than racing mount.

When relevant (`AskUserQuestion`, header `Editor UI`):

**"Should SimplePDF's built-in controls remain visible, or should your app own most of the PDF controls?"**

1. **Keep the built-in editor UI** — less to build; the editor's own look and controls.
2. **Use our own controls around the editor** — full ownership of the surrounding UX; more to build.

Do not imply arbitrary CSS access inside the iframe: the product can configure/hide editor UI and control the PDF through the typed SDK, while the surrounding application UI is fully theirs.

## Pick the `companyIdentifier` (every route)

Map the workflow to the identifier:

- **Load, fill, download — free, no account.** React: omit the prop (defaults to `react-editor`); framework-free/iframe/script: `embed`. Everything stays in the browser; submissions are not collected — users download their work.
- **Read-only viewing — free.** `react-viewer` in React, `viewer` elsewhere: all editing features are disabled.
- **Load, fill, submit — collect submissions.** Requires the user's own identifier: their `<companyIdentifier>.simplepdf.com` subdomain, shown in their dashboard.

When the workflow leaves it open, ask (`AskUserQuestion`, header `Submissions`): **"Should submissions be collected on a SimplePDF account, or stay free download-only?"**

When submissions are to be collected, ask the identifier question (plain free text): **"What's your `companyIdentifier` — the subdomain of your `<companyIdentifier>.simplepdf.com` dashboard?"**

**Placeholder guard — non-negotiable.** The free identifiers (`embed`, `viewer`, `react-editor`, `react-viewer`) are chosen by the workflow mapping above, never collected from the user. When submissions are to be collected, `yourcompany` and every free identifier are **never a valid answer** to the identifier question — a user giving one is echoing the docs, even if they confirm it. A user who answers with one, or with "I don't know", almost certainly has no SimplePDF account yet: have them sign up and pick a plan at https://simplepdf.com/pricing, then read the real identifier from their dashboard. To keep momentum meanwhile, offer to scaffold on the free identifier now and wire submissions once the real identifier exists.

Keep the identifier in the app's existing client-side config/env convention (e.g. `NEXT_PUBLIC_…` in Next.js) rather than hardcoded, so swapping in the real value is a one-line change and a placeholder can never ship in code.

## Editor placement (every embedded route)

Never invent a page. Ask where the editor lives, building the options from the routes/pages found during inspection (`AskUserQuestion`, header `Placement`):

**"Where should the PDF editor live?"** — offer the concrete candidate pages you found (the 3 most likely, to stay within the option cap), plus "A new page/route". Fewer than two candidates → ask as plain text instead.

Then, only when the chosen page doesn't make it obvious: inline → which section/block hosts it; modal → which existing link/button opens it. One question per turn, as always.

## Agentic control

Inspect dependencies and existing AI routes first. Only if the repository does not answer it (`AskUserQuestion`, header `AI stack`):

**"Does this app already use an AI SDK?"** — Vercel AI SDK / TanStack AI / another agent-LLM stack / no AI stack yet.

Then, only when the PDF-job answer has not already settled it (a user who picked only prefill has answered; so has one who picked live AI help, or both) (`AskUserQuestion`, header `Agent mode`):

**"How should the agent interact with the PDF?"**

1. **Prefill before it opens** — use data we already have, then let the person review.
2. **Interact with the live PDF** — the agent reads/fills/navigates while the person uses it.
3. **Both** — prefill known answers first, live agent resolves what remains.

### Live agentic control — Vercel AI SDK

`useEmbedTools(embedRef)` returns a string-keyed tools record (`{ description, inputSchema, execute }` per tool) bound to the live editor. In the current AI SDK, `useChat` has no `tools` option — dispatch client tool calls from `onToolCall` and report results with `addToolOutput` (production reference: https://raw.githubusercontent.com/SimplePDF/simplepdf-embed/main/copilot/src/components/chat/chat_pane.tsx):

```tsx
import { useChat } from '@ai-sdk/react';
import { EmbedPDF, useEmbed } from '@simplepdf/react-embed-pdf';
import { useEmbedTools } from '@simplepdf/react-embed-pdf/ai-sdk';

export function AgenticEditor() {
  const { embedRef } = useEmbed();
  const tools = useEmbedTools(embedRef);

  const { addToolOutput } = useChat({
    onToolCall: async ({ toolCall }) => {
      const tool = tools[toolCall.toolName];
      if (tool === undefined) {
        return;
      }
      const output = await tool.execute(toolCall.input);
      addToolOutput({ tool: toolCall.toolName, toolCallId: toolCall.toolCallId, output });
    },
  });

  return (
    <EmbedPDF
      ref={embedRef}
      mode="inline"
      companyIdentifier="yourcompany"
      document={{ url: 'https://cdn.simplepdf.com/simple-pdf/assets/forms/fw9.pdf' }}
      style={{ width: '100%', height: 800 }}
    />
  );
}
```

Server-side model tool definitions use the React-free core (execute-less — the model sees the tools; the browser executes them):

```ts
import { simplePDFToolDefinitions } from '@simplepdf/embed/ai-sdk';

streamText({ model, tools: simplePDFToolDefinitions() });
```

The split is intentional: the server/model knows the tool definitions; execution happens in the browser where the live editor exists. Never write server-side `execute` handlers that try to manipulate a browser iframe from the backend.

Vercel AI SDK changes frequently — inspect the installed `ai` / `@ai-sdk/react` version and current docs before writing `useChat`, `streamText`, tool-loop or message-transport code.

### Live agentic control — TanStack AI

`useEmbedTools(embedRef)` returns client tools bound to the live editor; register them with the installed TanStack AI client API:

```tsx
import { useChat } from '@tanstack/ai-react';
import type { ConnectionAdapter } from '@tanstack/ai-react';
import { EmbedPDF, useEmbed } from '@simplepdf/react-embed-pdf';
import { useEmbedTools } from '@simplepdf/react-embed-pdf/tanstack-ai';

export function AgenticEditor({ connection }: { connection: ConnectionAdapter }) {
  const { embedRef } = useEmbed();
  const tools = useEmbedTools(embedRef);

  useChat({ connection, tools });

  return (
    <EmbedPDF
      ref={embedRef}
      mode="inline"
      companyIdentifier="yourcompany"
      document={{ url: 'https://cdn.simplepdf.com/simple-pdf/assets/forms/fw9.pdf' }}
      style={{ width: '100%', height: 800 }}
    />
  );
}
```

`connection` is the app's TanStack AI transport — e.g. `fetchServerSentEvents('/api/chat')` from `@tanstack/ai-react`. React-free/server definitions: `import { simplePDFToolDefinitions } from '@simplepdf/embed/tanstack-ai'`. Verify the installed TanStack AI version before generating surrounding chat code.

### Another agent framework

Do not force a rewrite to Vercel or TanStack AI. Explain the tradeoff and implement the smallest bridge:

- the SDK-agnostic tool registry from `@simplepdf/embed/tools` (`routeToolCall`, `isSimplePDFToolName`) behind the project's existing tool abstraction
- the machine-readable editor contract at https://simplepdf.com/embed/json
- one of the supported adapters, if the user explicitly prefers it

### AI privacy boundary

"PDF editing is browser-side" does not mean "no document information reaches an AI provider": editor operations execute in the browser and PDF bytes need not be uploaded to SimplePDF or the AI provider for tool execution, but document text/field data placed in a prompt is AI traffic under the application's chosen provider/privacy policy. Send only the context the user's request requires; never place secrets or unnecessary sensitive values in prompts, logs or webhook context. If the application handles regulated or highly sensitive data, surface this boundary explicitly before implementing broad content extraction into prompts.

## Prefill — when data exists before the user arrives

Choose Prefill when a backend/agent already knows answers (CRM, user profile, EHR, database, prior submission, email or intake conversation, workflow automation).

Prerequisites:

- The document has its fields configured in the SimplePDF dashboard — an unconfigured document cannot be prefilled. Documents are created and configured in the dashboard, not via the API: get the `document_id` from `GET /documents` or the dashboard URL.
- Prefill values live in **customer-configured storage** (S3-compatible, Azure Blob Storage, or SharePoint), never on SimplePDF — a configured BYOS storage that can serve the blob back to the recipient is required.
- The Prefill API requires API access — BYOS alone does not imply it (plans can carry BYOS without the API). Check the account's plan against https://simplepdf.com/pricing, never memory.

Canonical flow (relative to the API base in "REST API" below):

1. `GET /documents/{document_id}/fields` — each field has a stable `id`, a `type`, and (for constrained fields) allowed `options`
2. map known values to stable field ids and allowed options
3. `POST /documents/{document_id}/prefills` — returns the prefill `id`, an `upload` object (where and how to send the values), and an `embed_url`
4. upload `{ "fields": [{ "id", "value" }] }` per the `upload` object, straight to the customer storage
5. open/share the returned `embed_url`
6. the human reviews, corrects, signs and submits

Rules: keep sensitive values in the prefill blob, not webhook `context`; unknown field ids are ignored and read-only fields ignore prefill values; a field listing `options` only accepts one of them (checkboxes, dropdowns, radios); otherwise the value is a plain string (text fields) or a base64 data URL (signature and picture fields). When mapping from natural-language data, validate constrained values before writing the blob and never let the model invent a field id when the field schema is available. Prefills are deletable (`DELETE /documents/{document_id}/prefills/{prefill_id}`) — clean up prefills that were superseded or never opened.

## Post-submit

When submissions are collected, ask (`AskUserQuestion`, header `Post-submit`):

**"What should happen after the person submits the PDF?"**

1. **Notify our backend and process it** — configure a webhook.
2. **Just store/collect the submitted PDF** — no custom processing yet.
3. **Use structured answers in another system** — webhook/API + field data.
4. **Not sure** — start webhook-friendly without unused backend code.

### Webhooks

Use `submission.created` for downstream automation. The delivery carries metadata plus short-lived URLs (typically 15 minutes; BYOS providers may apply their own expiry) for the completed PDF and the structured submitted field data (`field_data_url` — may be null when field data is unavailable), which removes any need to parse the completed PDF to recover answers.

- **Authenticate deliveries** with the custom headers SimplePDF sends on every webhook: set a random shared-secret header and verify it in the handler before trusting the payload or fetching any URL it contains. Do not invent a webhook-signature verification mechanism unless current SimplePDF documentation specifies one.
- Treat `context` as correlation metadata only — no PII/PHI/secrets.
- Respond quickly; make downstream processing idempotent by submission id; persist the identifiers you need; fetch short-lived resources promptly; handle retries safely.
- An expired download URL can be refreshed through the REST API when the account has the required API access.

## Storage

Only when submissions/prefills/persistence make it relevant, and after checking whether the app already has an established storage boundary (`AskUserQuestion`, header `Storage`):

**"Where should submitted PDFs and prefill data live?"**

1. **Our existing object storage** — when the app already uses S3-compatible or Azure storage.
2. **SharePoint** — Microsoft-centric workflows, where the account supports it.
3. **SimplePDF-managed storage** — when BYOS is unnecessary.
4. **Not sure** — decide from compliance and existing infrastructure.

**If the workflow includes Prefill, do not offer option 3**: prefill values live in customer storage the recipient's editor reads back, so a readable BYOS configuration is required — write-only storage cannot support that flow, and SimplePDF-managed storage only fits submission-only workflows.

Supported BYOS families: S3-compatible object storage, Azure Blob Storage, SharePoint — subject to current account entitlements. With BYOS, design around the browser/customer-storage signed-URL flow rather than proxying document bytes through the application's server without a specific need.

## REST API

Only when the backend needs lifecycle control beyond browser editor actions/webhooks. Server-side resources: documents, field schemas, prefills, submissions.

```text
https://{companyIdentifier}.simplepdf.com/api/v1
```

Authentication is a bearer API token. **Never expose the SimplePDF API secret in browser code.** Generate/validate backend clients from https://simplepdf.com/api/json rather than manually recreating schemas.

## Plan gate — before any code

Do not start coding, and do not claim you have everything you need, until every triggered item below is resolved:

- [ ] PDF job and route(s) chosen
- [ ] `companyIdentifier` resolved to a real identifier or an explicitly chosen free one (placeholder guard passed)
- [ ] embedded route → placement chosen (page, plus block/trigger when not obvious)
- [ ] Route B → editor UI question answered
- [ ] AI involved → stack and agent mode resolved
- [ ] submissions collected → post-submit answered
- [ ] submissions or prefill → storage answered

Any unchecked triggered item → ask the next missing question instead of planning. Then summarize the selected architecture in a short form before making changes:

```text
Next.js + React
  ├─ EmbedPDF inline on /contracts (below the summary card)
  ├─ custom toolbar via useEmbed()
  ├─ Vercel AI SDK live tools
  ├─ Prefill API for CRM-known values
  ├─ human reviews/signs/submits
  ├─ S3 BYOS
  └─ submission.created webhook → existing intake API
```

The plan MUST name the data boundaries — what stays in the browser, what goes to the AI provider, what goes to customer storage, what webhook metadata reaches the backend. A plan without them is incomplete. Do not ask the user to reconfirm information they already supplied unless a destructive/security-sensitive change requires it.

## Implement

Prefer the smallest integration that satisfies the chosen workflow.

```bash
npm install @simplepdf/react-embed-pdf   # React
npm install @simplepdf/embed             # framework-free: createEmbed() + typed embed.actions/events/lifecycle
```

The agentic subpaths have optional peers: `zod` for both `/ai-sdk` and `/tanstack-ai`, plus `@tanstack/ai` for `/tanstack-ai`. Install only what the chosen path needs — a `<EmbedPDF>`-only app needs neither. The AI SDKs themselves are separate installs the snippets rely on (deliberately not peers of the SimplePDF packages): Vercel path `ai`, `@ai-sdk/react`, a provider package (e.g. `@ai-sdk/anthropic`), `zod`; TanStack path `@tanstack/ai`, `@tanstack/ai-react`, `zod`. Verify current versions against the installed packages before writing chat code.

### Origin whitelisting

Whitelist the application's origins **proactively**: an account with an empty whitelist allows the embed on **all** origins, and adding the first origin is what activates the allow-list (blocking everything else). Have the user add their production and local-dev origins at `https://{companyIdentifier}.simplepdf.com/account/embed` → **Security** as part of the integration, not as an afterthought. On a blocked origin the editor renders a dedicated error screen naming the attempted origin (and actions fail with `forbidden:origin_not_whitelisted`); the **Security** section auto-detects that origin, ready to one-click approve.

### Quality rules

- Reuse the application's existing components, routes, auth, environment-variable conventions and styling.
- Never leave `yourcompany` in written code: collect the real identifier first (placeholder guard), or use the free-tier identifiers for download-only/viewer workflows.
- Keep server secrets server-only.
- Prefer typed SDK methods to raw `postMessage`; prefer generated/OpenAPI types to hand-maintained REST types.
- No storage/webhook/API infrastructure the chosen workflow doesn't need; no AI packages in a non-AI integration; never replace an existing AI framework solely because SimplePDF has adapters for another one.
- Keep submission user-driven by default.

## Verify

At minimum: the PDF loads in the chosen mode on the chosen page; programmatic actions wait for editor/document readiness; selected fields can be read/written; live AI tool calls execute in the browser when enabled, and the agent asks rather than invents missing user information; prefilled values map to real field ids and constrained values are valid; the human can review/correct before submitting; submission events are handled once/idempotently; webhook context contains no sensitive data; API keys never reach client bundles; the BYOS path matches the configured storage mode; errors are shown in the application's existing error UX.

## In-product agent UX

Carry the same discipline into any end-user PDF assistant: ask for missing information one question at a time; never guess identity, medical, legal, financial or attestation answers; fill known fields when confidence is high and the user has authorized the data source; make uncertain mappings visible; navigate the user to fields requiring personal judgment or signature; summarize what was filled and what remains before submission; leave final submission to the person by default. A good form assistant should feel like it removed paperwork, not like it took control of the user's decisions.
