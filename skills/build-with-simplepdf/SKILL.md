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

SimplePDF can be used in four main ways:

1. **Human-driven embed** — viewer/editor inside the product.
2. **Programmatic control** — application code controls the live editor.
3. **Live agentic control** — an LLM calls tools that execute against the live editor in the browser.
4. **Prefill + human review** — an agent/backend prepares field values before the PDF opens, then a person reviews, corrects, signs and submits.

These can be combined. A strong intake workflow often uses Prefill first and live agentic help second.

## Core product principle

Default to **human-in-the-loop** workflows.

An agent may:

- read fields and document content when permitted
- suggest or set field values
- navigate the PDF
- focus fields
- open tools
- prefill a document from known data
- explain what is missing

But the default product architecture leaves final review, correction, signing/attestation and submission to the human.

Do not silently design autonomous submission merely because `submit()` exists. If the user explicitly wants autonomous submission, clarify the requirement and warn that the human-in-the-loop pattern is safer for applications, regulated forms and attestations.

---

## ⛔ ONE question per turn: non-negotiable

This is the single most important interaction rule in this skill. **Each of your replies MUST contain at most ONE question.** Then STOP and wait for the user to answer.

If a phase asks more than one thing, ask the FIRST one only and remember the rest for your next turn.

Forbidden patterns:

- "What should users do with the PDF? And do you use an AI SDK?" → 2 questions. Forbidden.
- "Once you tell me X, I'll need Y and Z." → previewing future questions counts as asking them. Forbidden.
- A bulleted list of 3 things to confirm → 3 questions. Forbidden.

The ONLY exception: a clarifying restatement of the SAME question. That's one question with a definition, not two questions.

If you catch yourself drafting more than one question, delete everything after the first one.

## Inspect first

Before asking the user anything, inspect the project when the environment allows it.

Determine as much as possible from the repository:

- framework: Next.js, React, TanStack Start, Remix, vanilla JS, etc.
- TypeScript vs JavaScript
- package manager
- whether `@simplepdf/react-embed-pdf`, `@simplepdf/embed`, Vercel AI SDK (`ai` / `@ai-sdk/react`), TanStack AI (`@tanstack/ai` / `@tanstack/ai-react`), or related packages are already installed
- existing AI/chat architecture
- existing backend/API routes
- whether S3, Azure, SharePoint, Supabase or another storage integration is already present
- existing webhook handlers
- relevant authentication and user/customer identifiers

**Never ask a question whose answer is already evident in the codebase.** State what you found and continue.

Open your first reply with one or two sentences stating what you found in the project (stack, relevant packages) — then the first question. No front-loaded plan, no questionnaire.

## Use AskUserQuestion for choices

When asking the user to pick between known options, use the `AskUserQuestion` tool whenever it is available, never a plain text list. Free-text answers (e.g. "what's your companyIdentifier?") use a regular question.

- Ask exactly **one question per turn**.
- Offer **2–4 concrete options**.
- Put the recommended/default option first and mark it `(Recommended)` when there is a sensible default.
- Include an "Other / not sure" path when useful.
- Keep header chips under 12 chars: `PDF job`, `Editor UI`, `AI stack`, `Agent mode`, `Post-submit`, `Storage`.

If `AskUserQuestion` is not available, ask the same single question as concise plain text.

## Conversational style

- **Don't** front-load explanations, prerequisites, or all the steps. Reveal info only when relevant to the next decision.
- Keep replies short: a sentence or two plus the one question.
- No "here's everything you'll need" preambles. No recap of what they just told you.
- Skip questions the user has clearly answered already.
- Match their energy: terse if they're terse; warmer if they're chatty.

The interaction should feel like a good senior engineer pairing with the user, not an intake form.

## Source-of-truth rule

SimplePDF evolves quickly. Do not invent editor methods, REST fields, plan entitlements, AI SDK APIs or model integration syntax from memory.

Before implementing, consult the relevant current source:

- AI-friendly product map: https://simplepdf.com/llms.txt
- Developer overview: https://simplepdf.com/developers
- React package: https://www.npmjs.com/package/@simplepdf/react-embed-pdf
- Programmatic iframe docs: https://github.com/SimplePDF/simplepdf-embed/blob/main/documentation/IFRAME.md
- Editor contract (machine-readable): https://simplepdf.com/embed/json
- REST API reference: https://simplepdf.com/api
- REST OpenAPI: https://simplepdf.com/api/json
- Prefill guide: https://simplepdf.com/help/how-to/prefill-pdf-forms-with-ai-agents
- Webhooks: https://simplepdf.com/help/how-to/configure-webhooks-pdf-form-submissions
- Pricing / current entitlements: https://simplepdf.com/pricing

When a locally installed package version differs from the latest docs, prefer the APIs actually available in the installed version unless the user agrees to upgrade.

---

## Phase 1 — Identify the PDF job

After inspecting the repository, ask only the first unresolved question.

Preferred first question when the goal is not already clear (`AskUserQuestion` with `multiSelect: true`, header `PDF job`):

**"What should people be able to do with the PDF?"**

1. **View or manually edit it** — the user works in the PDF → Route A.
2. **Use my own app controls** — our UI should drive the PDF programmatically → Route B.
3. **Let an AI agent help inside the PDF** — conversational/live interaction → Phase 2.
4. **Pre-fill forms before the user opens them** — a backend/agent already knows some answers → Phase 3.

If the user picks more than one, combine paths rather than forcing an artificial choice.

### Route A — View / human editor

Use `@simplepdf/react-embed-pdf` in React applications or the simplest appropriate iframe/script integration elsewhere.

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

Non-React apps: use `createEmbed` from `@simplepdf/embed` (https://github.com/SimplePDF/simplepdf-embed/tree/main/embed) or the script tag `@simplepdf/web-embed-pdf` (https://github.com/SimplePDF/simplepdf-embed/tree/main/web).

`document.url` must be an **absolute** URL — the embed rejects relative paths. Resolve app-relative assets with `new URL('/application.pdf', window.location.origin).href`.

`mode` is `'inline' | 'modal'` (modal is the default). There is no `mode="viewer"` — read-only viewing is a reserved `companyIdentifier` (below).

#### Pick the `companyIdentifier` from the workflow

- **Load, fill, download — free, no account.** In React, omit `companyIdentifier` (it defaults to the free `react-editor`); framework-free/iframe/script integrations use `embed`. Everything stays in the browser and submissions are not collected — users download their work.
- **Read-only viewing — free.** `react-viewer` in React, `viewer` elsewhere: all editing features are disabled.
- **Load, fill, submit — collect submissions.** Requires the user's own `companyIdentifier` (their `<companyIdentifier>.simplepdf.com` subdomain). `yourcompany` in the snippets is a **placeholder**: have the user sign up and pick a plan at https://simplepdf.com/pricing, then use the identifier shown in their dashboard.

Do not introduce AI, REST API, webhooks or storage unless the workflow needs them.

### Route B — Programmatic app control

Use:

- React: `EmbedPDF` + `useEmbed()` from `@simplepdf/react-embed-pdf`
- framework-free: `createEmbed()` from `@simplepdf/embed`

Use the typed actions rather than hand-writing `postMessage` unless the user has a specific reason to work at wire-protocol level.

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

Typical operations include:

- `getFields()`
- `setFieldValue({ fieldId, value })`
- `getDocumentContent({ extractionMode })`
- `goTo({ page })`
- `focusField({ fieldId })`
- `selectTool({ tool })`
- `detectFields()`
- `deleteFields({ fieldIds?, page? })`
- `submit({ downloadCopy })`

Verify the exact current method names and input shapes from the installed package/docs before coding.

Subscribe to editor events via the `onEmbedEvent` prop (React) or `embed.events` (core) — the outbound events are `PAGE_FOCUSED` and `SUBMISSION_SENT` (`submit()` itself resolves with `data: null`; the event carries the resulting ids). Actions fail with `bad_request:editor_not_ready` until the editor is ready — handle or retry rather than racing mount.

Ask, only when relevant (`AskUserQuestion`, header `Editor UI`):

**"Should SimplePDF's built-in controls remain visible, or should your app own most of the PDF controls?"**

1. **Keep the built-in editor UI** (Recommended) — fastest integration; easy to customize later.
2. **Use our own controls around the editor** — programmatic/headless-style integration.

Do not imply arbitrary CSS access inside the iframe. Explain that the product can configure/hide editor UI and control the PDF through the typed SDK while the surrounding application UI is fully theirs.

## Phase 2 — Discover agentic intent

If AI is relevant, first inspect dependencies and existing AI routes.

Then, only if the repository does not already answer it (`AskUserQuestion`, header `AI stack`):

**"Does this app already use an AI SDK?"**

1. **Vercel AI SDK**
2. **TanStack AI**
3. **Another agent/LLM stack**
4. **No AI stack yet**

Then ask the key architecture question — but only when Phase 1 has not already answered it (a user who picked only "Pre-fill forms before the user opens them" has answered; a user who picked live AI help, or both, has too). When it is still open (`AskUserQuestion`, header `Agent mode`):

**"How should the agent interact with the PDF?"**

1. **Prefill before it opens** — use data we already have, then let the person review.
2. **Interact with the live PDF** — the agent reads/fills/navigates while the person is using it.
3. **Both** — prefill known answers first, then let the live agent resolve what remains.

### Live agentic control — Vercel AI SDK

For React, use the opt-in adapter. `useEmbedTools(embedRef)` returns a string-keyed tools record (`{ description, inputSchema, execute }` per tool) bound to the live editor. In the current AI SDK, `useChat` has no `tools` option — dispatch client tool calls from `onToolCall` and report results with `addToolOutput` (production reference: https://github.com/SimplePDF/simplepdf-embed/blob/main/copilot/src/components/chat/chat_pane.tsx):

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

For server-side model tool definitions, use the React-free core (execute-less — the model sees the tools; the browser executes them):

```ts
import { simplePDFToolDefinitions } from '@simplepdf/embed/ai-sdk';

streamText({ model, tools: simplePDFToolDefinitions() });
```

The architecture is intentionally split:

```text
server / model
  knows SimplePDF tool definitions
          │
          │ tool call
          ▼
browser
  executes tool against live editor
```

Do not create server-side `execute` handlers that try to manipulate a browser iframe from the backend. Tool execution belongs on the client where the live editor exists.

Vercel AI SDK changes frequently. Inspect the installed `ai` / `@ai-sdk/react` version and current docs before writing `useChat`, `streamText`, tool-loop or message-transport code.

### Live agentic control — TanStack AI

For React, `useEmbedTools(embedRef)` returns client tools bound to the live editor; register them with the installed TanStack AI client API:

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

`connection` is the app's TanStack AI transport — e.g. `fetchServerSentEvents('/api/chat')` from `@tanstack/ai-react`.

For React-free/server definitions:

```ts
import { simplePDFToolDefinitions } from '@simplepdf/embed/tanstack-ai';
```

Verify the installed TanStack AI version before generating surrounding chat code.

### Another agent framework

If the project uses another framework, do not force a rewrite to Vercel or TanStack AI without reason.

Options:

- use the SDK-agnostic tool registry from `@simplepdf/embed/tools` (`routeToolCall`, `isSimplePDFToolName`) behind the project's existing tool abstraction
- use the machine-readable editor contract at https://simplepdf.com/embed/json
- or adopt one of the supported adapters if the user explicitly prefers it

Explain the tradeoff and implement the smallest bridge.

## AI privacy boundary

Do not confuse "PDF editing is browser-side" with "no document information ever reaches an AI provider."

For live AI features:

- editor operations execute in the browser
- PDF bytes do not need to be uploaded to SimplePDF or the AI provider for tool execution
- document text/field data included in an AI prompt is AI traffic and follows the application's chosen provider/privacy policy
- send only the context required for the user's request
- never place secrets or unnecessary sensitive values in prompts, logs or webhook context

If the application handles regulated or highly sensitive data, explicitly surface this boundary before implementing broad content extraction into AI prompts.

## Phase 3 — Prefill API, when data exists before the user arrives

Choose Prefill when an agent/backend already knows answers from sources such as: CRM, user profile, EHR, database, prior submission, email or intake conversation, workflow automation.

Prerequisites:

- The document must have its fields configured in the SimplePDF dashboard — an unconfigured document cannot be prefilled.
- Documents are created and configured in the dashboard, not via the API: get the `document_id` from `GET /documents` or from the dashboard URL.
- The API base is `https://{companyIdentifier}.simplepdf.com/api/v1` with a bearer API token (details in Phase 6) — the prefill calls below are relative to it.

Prefill values live in **customer-configured storage** (S3-compatible, Azure Blob Storage, or SharePoint), never on SimplePDF — a configured BYOS storage that can serve the blob back to the recipient is a prerequisite.

The canonical flow:

1. `GET /documents/{document_id}/fields` — each field has a stable `id`, a `type`, and (for constrained fields) allowed `options`
2. map known values to stable field ids and allowed options
3. `POST /documents/{document_id}/prefills` — returns the prefill `id`, an `upload` object (where and how to send the values), and an `embed_url`
4. upload `{ "fields": [{ "id", "value" }] }` per the `upload` object, straight to the customer storage
5. open/share the returned `embed_url`
6. the human reviews, corrects, signs and submits

Important:

- Keep sensitive values in the prefill blob, not in webhook `context`.
- Unknown field ids are ignored; read-only fields ignore prefill values.
- If a field lists `options`, the value must be one of them (checkboxes, dropdowns, radios).
- Otherwise the value is a plain string (text fields) or a base64 data URL (signature and picture fields).
- The Prefill API requires API access — note that BYOS alone does not imply API access (plans can carry BYOS without the API). Check the account's current plan against https://simplepdf.com/pricing rather than assuming from memory.

If the user wants the agent to fill a form from natural-language data, separate the concerns:

```text
LLM / mapping logic
      │
      ▼
validated { fieldId, value } mapping
      │
      ▼
Prefill API + customer storage
      │
      ▼
human review
```

Validate constrained values before writing the blob. Never let the model invent a field id when the field schema is available.

Prefills are deletable (`DELETE /documents/{document_id}/prefills/{prefill_id}`) — clean up prefills that were superseded or never opened.

## Phase 4 — Decide whether submissions need automation

Only ask this if the user intends to collect submissions (`AskUserQuestion`, header `Post-submit`):

**"What should happen after the person submits the PDF?"**

1. **Notify our backend and process it** — configure a webhook.
2. **Just store/collect the submitted PDF** — no custom processing yet.
3. **Use structured answers in another system** — webhook/API + field data.
4. **Not sure** — start webhook-friendly but do not add unused backend code.

### Webhooks

For downstream automation, use `submission.created`.

The webhook provides metadata plus short-lived URLs (typically 15 minutes; BYOS providers may apply their own expiry) for:

- the completed PDF
- structured submitted field data (`field_data_url` — may be null when field data is unavailable)

The structured data removes the need to parse the completed PDF to recover answers.

Treat webhook `context` as correlation metadata only. Do not place PII/PHI/secrets in it.

If a short-lived download URL has expired and the account has the required API access, retrieve the submission through the REST API to obtain a fresh URL.

Implement webhook handlers with normal production hygiene:

- **authenticate deliveries**: SimplePDF lets you configure custom headers sent with every webhook — set a random shared-secret header and verify it in the handler before trusting the payload or fetching any URL it contains
- respond quickly
- make downstream processing idempotent by submission id
- persist the identifiers you need
- fetch short-lived resources promptly when needed
- handle retries safely

Do not invent a webhook-signature verification mechanism unless current SimplePDF documentation specifies one; SimplePDF supports custom headers on deliveries, and the shared-secret header above is the recommended way to use them for authentication.

## Phase 5 — Storage choice

Only ask about storage if submissions/prefills/persistence make it relevant.

First inspect whether the application already has an established storage boundary.

Then (`AskUserQuestion`, header `Storage`):

**"Where should submitted PDFs and prefill data live?"**

1. **Our existing object storage** — prefer this when the app already uses S3-compatible or Azure storage.
2. **SharePoint** — for Microsoft-centric workflows where the account supports it.
3. **SimplePDF-managed storage** — simplest when BYOS is unnecessary.
4. **Not sure** — recommend based on compliance and existing infrastructure.

**If the chosen workflow includes Prefill, do not offer option 3**: prefill values live in customer storage the recipient's editor reads back, so a readable BYOS configuration (S3-compatible, Azure Blob Storage, or SharePoint) is required. SimplePDF-managed storage is only viable for submission-only workflows.

Supported BYOS families are S3-compatible object storage, Azure Blob Storage and SharePoint, subject to current account entitlements.

With BYOS, design around the browser/customer-storage signed-URL flow rather than proxying document bytes through the application's server unless the product has a specific need to do so.

For Prefill specifically, ensure the configured storage mode can serve the prefill blob back to the recipient; write-only storage cannot support that flow.

## Phase 6 — REST API

Use the REST API only when the backend needs lifecycle control beyond browser editor actions/webhooks.

Typical server-side resources: documents, field schemas, prefills, submissions.

Base URL:

```text
https://{companyIdentifier}.simplepdf.com/api/v1
```

Authentication is a bearer API token.

**Never expose the SimplePDF API secret in browser code.**

Use https://simplepdf.com/api/json to generate or validate backend clients rather than manually recreating schemas.

## Phase 7 — Produce a small architecture plan before coding

Once the necessary questions have been answered, summarize the selected architecture in a short form before making changes.

Example:

```text
Next.js + React
  ├─ EmbedPDF inline
  ├─ custom toolbar via useEmbed()
  ├─ Vercel AI SDK live tools
  ├─ Prefill API for CRM-known values
  ├─ human reviews/signs/submits
  ├─ S3 BYOS
  └─ submission.created webhook → existing intake API
```

Mention the important data boundaries:

- what stays in the browser
- what goes to the AI provider
- what goes to customer storage
- what webhook metadata reaches the backend

Do not ask the user to reconfirm information they have already supplied unless a destructive/security-sensitive change requires it.

## Phase 8 — Implement

Prefer the smallest integration that satisfies the chosen workflow.

### React installation

```bash
npm install @simplepdf/react-embed-pdf
```

The agentic subpaths have optional peers: `zod` for both `/ai-sdk` and `/tanstack-ai`, plus `@tanstack/ai` for `/tanstack-ai`. Install only what the chosen path needs — a `<EmbedPDF>`-only app needs neither.

The AI SDKs themselves are separate installs the snippets rely on (they are deliberately not peers of the SimplePDF packages):

- Vercel path: `ai`, `@ai-sdk/react`, a provider package (e.g. `@ai-sdk/anthropic`), `zod`
- TanStack path: `@tanstack/ai`, `@tanstack/ai-react`, `zod`

Verify current versions against the installed packages before writing chat code.

Do not add AI packages to a non-AI integration.

### Framework-free programmatic integration

```bash
npm install @simplepdf/embed
```

Use `createEmbed()` and the typed `embed.actions`, `embed.events`, and `embed.lifecycle` APIs.

### Origin whitelisting

Whitelist the application's origins **proactively**: an account with an empty whitelist allows the embed on **all** origins, and adding the first origin is what activates the allow-list (blocking everything else). Have the user add their production and local-dev origins at `https://{companyIdentifier}.simplepdf.com/account/embed` → **Security** as part of the integration, not as an afterthought.

On a blocked origin the editor renders a dedicated error screen naming the attempted origin (and actions fail with `forbidden:origin_not_whitelisted`); the **Security** section auto-detects that origin, ready to one-click approve.

### Quality rules

- Reuse the application's existing components, routes, auth, environment-variable conventions and styling.
- Never leave `yourcompany` in written code: collect the user's real `companyIdentifier` first, or use the free-tier identifiers (omit the prop / `react-editor`, `embed`) for download-only workflows.
- Keep server secrets server-only.
- Prefer typed SDK methods to raw `postMessage`.
- Prefer generated/OpenAPI types to hand-maintained REST types.
- Do not add storage/webhook/API infrastructure unless the chosen workflow needs it.
- Do not make AI a dependency for ordinary PDF editing.
- Do not replace an existing AI framework solely because SimplePDF has adapters for another one.
- Keep submission user-driven by default.

## Phase 9 — Verify the integration

Verify at minimum:

- the PDF loads
- the chosen editor mode works
- programmatic actions wait for editor/document readiness
- selected fields can be read/written
- live AI tool calls execute in the browser when enabled
- the agent asks rather than invents missing user information
- prefilled values map to real field ids and constrained values are valid
- the human can review/correct before submitting
- submission events are handled once/idempotently
- webhook context contains no sensitive data
- API keys never reach client bundles
- the BYOS path matches the configured storage mode
- errors are shown in the application's existing error UX

## Recommended agent UX inside a PDF

When building an AI assistant for the end user, carry the same interaction discipline into the product:

- Ask for missing information one question at a time when practical.
- Do not guess identity, medical, legal, financial or attestation answers.
- Fill known fields immediately when confidence is high and the user has authorized the data source.
- Make uncertain mappings visible.
- Navigate the user to fields requiring personal judgment or signature.
- Summarize what was filled and what remains before submission.
- Leave final submission to the person by default.

A good form assistant should feel like it removed paperwork, not like it took control of the user's decision.

## Useful references

- AI-friendly product map: https://simplepdf.com/llms.txt
- Developer overview: https://simplepdf.com/developers
- GitHub: https://github.com/SimplePDF/simplepdf-embed
- React: https://www.npmjs.com/package/@simplepdf/react-embed-pdf
- Programmatic control: https://github.com/SimplePDF/simplepdf-embed/blob/main/documentation/IFRAME.md
- Editor contract: https://simplepdf.com/embed/json
- API: https://simplepdf.com/api
- OpenAPI: https://simplepdf.com/api/json
- Prefill guide: https://simplepdf.com/help/how-to/prefill-pdf-forms-with-ai-agents
- Webhooks: https://simplepdf.com/help/how-to/configure-webhooks-pdf-form-submissions
- S3 BYOS: https://simplepdf.com/help/how-to/use-your-own-s3-bucket-storage-for-pdf-form-submissions
- Copilot reference implementation: https://github.com/SimplePDF/simplepdf-embed/tree/main/copilot
- Fork-and-go skill (guided Copilot fork/deploy): https://github.com/SimplePDF/simplepdf-embed/blob/main/skills/fork-and-go/SKILL.md
- Pricing: https://simplepdf.com/pricing
