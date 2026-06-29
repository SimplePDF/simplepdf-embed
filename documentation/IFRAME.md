# SimplePDF Embed using an Iframe

SimplePDF Embed [React](../react/README.md) and [Web](../web/README.md) integrate `SimplePDF` in a single line of code by displaying the editor in a modal.

**For more control**, embedding the editor inline (e.g. in a `div`), or driving it programmatically, read on.

## The iframe URL vs. programmatic control

Pointing an `<iframe src>` at the editor (below) gives you the **full editor, with your account's branding**, in zero JavaScript. What it does **not** give you is **programmatic control**: you can't read a field, jump to a page, prefill values, submit, or let an AI agent fill and read the document on the user's behalf.

For that, drive the same iframe with the typed [`@simplepdf/embed`](#iframe-communication) client, see [Iframe Communication](#iframe-communication).

## With a SimplePDF account (to collect customers' submissions)

_[Get your own SimplePDF account](https://simplepdf.com/pricing)_

### Let your users pick the file on their computer

_- Replace `COMPANY_IDENTIFIER` with your own_

```html
<iframe src="https://COMPANY_IDENTIFIER.simplepdf.com/editor" frameborder="0">
</iframe>
```

### Open a given PDF file automatically

_- Replace `COMPANY_IDENTIFIER` with your own_

_- Replace `PUBLICLY_AVAILABLE_PDF_URL` with the url of the PDF to use._

NOTE: if the `PUBLICLY_AVAILABLE_PDF_URL` contains query parameters (for example when using S3 or Azure Blob storage presigned URLs), you must encode the URL using `encodeURIComponent`

```html
<iframe
  src="https://COMPANY_IDENTIFIER.simplepdf.com/editor?open=PUBLICLY_AVAILABLE_PDF_URL"
  frameborder="0"
>
</iframe>
```

### Specifying a context

_The context is sent as part of the submission via the webhooks integration: [read more](https://simplepdf.com/help/how-to/configure-webhooks-pdf-form-submissions#events)_

**Use-cases:**

- Link a submission back to a customer
- Specify the environment / configuration of the editor

_Do not store sensitive information in the context (!!) as it is available locally to anyone inspecting the code_

```html
<iframe
  src="https://COMPANY_IDENTIFIER.simplepdf.com/editor?open=PUBLICLY_AVAILABLE_PDF_URL&context=CONTEXT"
  frameborder="0"
>
</iframe>
```

Where `CONTEXT` is a URL safe Base64 encoded stringified JSON.

```javascript
const context = { customerId: "123", environment: "production" };
const encodedContext = encodeURIComponent(btoa(JSON.stringify(context)));
const url = `https://COMPANY_IDENTIFIER.simplepdf.com/editor?open=PUBLICLY_AVAILABLE_PDF_URL&context=${encodedContext}`;
```

## Without a SimplePDF account (to use the free PDF editor)

_Notice how `COMPANY_IDENTIFIER` has been replaced with `embed`_

### Let your users pick the file on their computer

```html
<iframe src="https://embed.simplepdf.com/editor" frameborder="0"> </iframe>
```

### Open a given PDF file automatically

_- Replace `PUBLICLY_AVAILABLE_PDF_URL` with the url of the PDF to use._

```html
<iframe
  src="https://embed.simplepdf.com/editor?open=PUBLICLY_AVAILABLE_PDF_URL"
  frameborder="0"
>
</iframe>
```

See [Data Privacy & companyIdentifier](../README.md#data-privacy--companyidentifier) for reserved values (`embed`, `viewer`, etc.) and how data is handled.

---

## Iframe Communication

_Programmatic control is only available with a SimplePDF account_

The iframe communicates over the `postMessage` API. Use **[`@simplepdf/embed`](../embed/README.md)**, a zero-dependency client that drives the editor over the iframe for you, **generated from the editor contract** so it can't drift. It wraps everything for you: request/response correlation, timeouts, the editor-ready / document-loaded lifecycle, typed events, and the closed error model. Methods + arguments are camelCase; the editor's `snake_case` wire is handled behind the scenes. (If you'd rather add no dependency, the raw protocol is documented under [Wire shape](#wire-shape).)

The examples below go from the simplest embed to full programmatic and agentic control. `createEmbed` either **creates** the iframe inside a container you provide, or **attaches** to an `<iframe>` you render.

### 1. Open a document and collect submissions

```html
<div id="editor" style="height: 100vh"></div>
```

```ts
import { createEmbed } from "@simplepdf/embed";

const embed = createEmbed({
  target: "#editor", // a container, the iframe is created inside it
  companyIdentifier: "acme", // your <companyIdentifier>.simplepdf.com, use "embed" for the free editor
  document: { url: "https://example.com/form.pdf" },
});

// Subscribe to an editor event (payloads are the verbatim snake_case wire shape).
embed.events.on("SUBMISSION_SENT", (data) => {
  console.log("submitted", data.document_id, data.submission_id);
});
```

### 2. Attach to an iframe you render yourself

```html
<iframe id="editor" src="https://acme.simplepdf.com/editor"></iframe>
```

```ts
// No DOM is created, and lifecycle.dispose() leaves your iframe in place.
const embed = createEmbed({ target: "#editor", companyIdentifier: "acme" });
```

### 3. Drive the editor programmatically

Every method resolves to a typed `BridgeResult` and never throws:

```ts
const fields = await embed.actions.getFields();
if (fields.success) {
  console.log(fields.data.fields); // typed FieldRecord[]
}

await embed.actions.goTo({ page: 3 });
await embed.actions.selectTool({ tool: "TEXT" }); // or 'CHECKBOX' | 'SIGNATURE' | 'PICTURE' | 'COMB_TEXT' | null
await embed.actions.setFieldValue({ fieldId: "f_kj8n2hd9x3m1p", value: "Jane Doe" });

const content = await embed.actions.getDocumentContent({ extractionMode: "auto" });
console.log(content.success && content.data.pages); // [{ page: 1, content: "…" }, …]

const submitted = await embed.actions.submit({ downloadCopy: true });
if (!submitted.success) {
  console.error(submitted.error.code, submitted.error.message); // closed BridgeErrorCode
}

embed.lifecycle.dispose(); // readiness is observable via embed.events.on('DOCUMENT_LOADED', …)
```

See the [`@simplepdf/embed` README](../embed/README.md#actions) for the full method set, the lifecycle, and the typed error model.

### 4. Fill and read a document (what an agent does for you)

"Fill and read this document for me" is just these operations in sequence, read the fields, fill one, then walk the user to a signature: navigate to its page, focus the field, and open the signature tool.

```ts
// read
const fields = await embed.actions.getFields();
const content = await embed.actions.getDocumentContent({ extractionMode: "auto" });

// fill
await embed.actions.setFieldValue({ fieldId: "f_full_name", value: "Jane Doe" });

// walk the user to the signature: navigate → focus → open the signature tool
await embed.actions.goTo({ page: 3 });
await embed.actions.focusField({ fieldId: "f_signature" });
await embed.actions.selectTool({ tool: "SIGNATURE" });
```

An AI agent does exactly this, the next section exposes these operations as tools the model calls.

### 5. Drive the editor from an LLM (agentic)

The same operations are exposed as [Vercel AI SDK](https://sdk.vercel.ai) tools:

```ts
// server: execute-less tool definitions for streamText / generateText
import { simplePDFToolDefinitions } from "@simplepdf/embed/ai-sdk";
streamText({ model, tools: simplePDFToolDefinitions() });

// browser: run the model's tool calls against the live editor
import { createSimplePDFExecutor } from "@simplepdf/embed/ai-sdk";
const execute = createSimplePDFExecutor({ embed });
```

In React, `@simplepdf/react-embed-pdf/ai-sdk`'s `useEmbedTools(embedRef)` is the same registry pre-bound to the live editor, drop it straight into `useChat({ tools })`.

---

## Reference: the editor contract (the spec)

The single source of truth for the available operations and events can be found at **[`https://simplepdf.com/embed/json`](https://simplepdf.com/embed/json)**.

It describes every operation (its `request_type`, input/output JSON Schema, and per-operation error codes), the outbound events, the supported locales, and the **complete closed set of error codes**, each `code` carrying a plain-language description of its meaning. It is the iframe / `postMessage` counterpart to the REST API's OpenAPI spec at [`/api/json`](https://simplepdf.com/api/json).

- **Programmatic access (recommended):** [`@simplepdf/embed`](https://github.com/SimplePDF/simplepdf-embed/tree/main/embed) generates its client, zod schemas (`/schemas`), and agentic tool registry (`/tools`, `/ai-sdk`) from this exact contract, use the package and you never read the raw spec.
- **Agents / LLMs:** point the model at `/embed/json` (or `@simplepdf/embed/ai-sdk`) to discover and drive the editor programmatically.

### Wire shape

Every request you post is `{ "type": <request_type>, "request_id": <your id>, "data": <input> }`; the editor replies with `{ "type": "REQUEST_RESULT", "data": { "request_id": <same id>, "result": <result> } }`, where `result` is `{ "success": true, "data": … }` or `{ "success": false, "error": { "code", "message" } }`. Outbound events (`EDITOR_READY`, `DOCUMENT_LOADED`, `PAGE_FOCUSED`, `SUBMISSION_SENT`) are pushed the same way. `request_type` is the operation name (e.g. `GET_FIELDS`, `SET_FIELD_VALUE`, `SUBMIT`) and is accepted case-insensitively. Payload fields are `snake_case` (e.g. `field_id`, `download_copy`). The full set of `code` values is in the contract's `editor_error_schema`.
