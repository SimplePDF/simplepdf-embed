# SimplePDF Embed using an Iframe

SimplePDF Embed [React](../react/README.md) and [Web](../web/README.md) allow you to easily integrate `SimplePDF` using a single line of code by displaying the editor in a modal.

**If you're however interested in having more control over the way SimplePDF is displayed in your app**, such as changing the way the modal looks or dropping it altogether - injecting the editor into a `div` for example, **read on:**

## [Show me an example!](https://replit.com/@bendersej/Simple-PDF-Embed-Iframe)

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

The iframe communicates using the `postMessage` API. All messages are JSON strings that must be parsed with `JSON.parse()`.

> **Recommended: use the [`@simplepdf/embed`](https://github.com/SimplePDF/simplepdf-embed/tree/main/packages/embed) package.** It is a typed, zero-dependency client that wraps everything below — request/response correlation, timeouts, the editor-ready / document-loaded state machine, typed events, and the closed error model — and its types, schemas, and tools are **generated from the editor contract**, so they can't drift. `createEmbed` / `mountEmbed` give you `embed.getFields()`, `embed.on('submission_sent', …)`, `embed.submit({ download_copy })`, etc. with full type-safety (plus `@simplepdf/embed/ai-sdk` for agentic tool-calling). The hand-rolled `postMessage` below is the dependency-free fallback.

### Implementation

```javascript
const iframe = document.getElementById("simplepdf-iframe");

// Helper to send events and receive responses
const sendEvent = (type, data = {}) => {
  return new Promise((resolve, reject) => {
    const requestId = `req_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2)}`;

    const handleResponse = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (
          payload.type === "REQUEST_RESULT" &&
          payload.data.request_id === requestId
        ) {
          window.removeEventListener("message", handleResponse);
          if (payload.data.result.success) {
            resolve(payload.data.result.data);
          } else {
            reject(payload.data.result.error);
          }
        }
      } catch {
        // Ignore non-JSON messages
      }
    };

    window.addEventListener("message", handleResponse);

    iframe.contentWindow.postMessage(
      JSON.stringify({ type, request_id: requestId, data }),
      "*",
    );

    // Timeout after 30 seconds
    setTimeout(() => {
      window.removeEventListener("message", handleResponse);
      reject({ code: "timeout", message: "Request timed out" });
    }, 30000);
  });
};

// Listen for events sent by the iframe
window.addEventListener("message", (event) => {
  try {
    const payload = JSON.parse(event.data);
    switch (payload.type) {
      case "EDITOR_READY":
        console.log("Editor is ready");
        break;
      case "DOCUMENT_LOADED":
        console.log("Document loaded:", payload.data.document_id);
        break;
      case "PAGE_FOCUSED":
        console.log(
          "Page changed:",
          payload.data.current_page,
          "/",
          payload.data.total_pages,
        );
        break;
      case "SUBMISSION_SENT":
        console.log("Submission sent:", payload.data.submission_id);
        break;
    }
  } catch {
    // Ignore non-JSON messages
  }
});
```

### Usage Examples

```javascript
// Load a document
await sendEvent("LOAD_DOCUMENT", {
  data_url: "https://example.com/document.pdf",
  name: "my-document.pdf",
  page: 1,
});

// Navigate to a specific page
await sendEvent("GO_TO", { page: 3 });

// Select a tool
await sendEvent("SELECT_TOOL", { tool: "TEXT" }); // or "CHECKBOX", "SIGNATURE", "PICTURE", "COMB_TEXT", null

// Detect fields in the document
await sendEvent("DETECT_FIELDS", {});

// Delete all fields (or specific ones)
await sendEvent("DELETE_FIELDS", {}); // Delete all
await sendEvent("DELETE_FIELDS", { page: 1 }); // Delete page 1 only
await sendEvent("DELETE_FIELDS", {
  field_ids: ["f_kj8n2hd9x3m1p", "f_q7v5c4b6a0wyz"],
}); // Delete specific fields

// Extract document content
const content = await sendEvent("GET_DOCUMENT_CONTENT", {
  extraction_mode: "auto",
});
console.log("Document name:", content.name);
console.log("Pages:", content.pages); // [{ page: 1, content: "..." }, ...]

// Submit the document
await sendEvent("SUBMIT", { download_copy: true });

// Move a visible page (1-indexed) to a new position
await sendEvent("MOVE_PAGE", { from_page: 2, to_page: 5 });

// Delete one or more visible pages (1-indexed). At least one visible page must remain
await sendEvent("DELETE_PAGES", { pages: [3] });
await sendEvent("DELETE_PAGES", { pages: [2, 4, 6] });

// Rotate a visible page (1-indexed) 90° clockwise
await sendEvent("ROTATE_PAGE", { page: 1 });
```

---

## Reference: the editor contract (the spec)

Rather than re-list every operation and event here (where the copy drifts), the **single source of truth is the machine-readable contract the editor publishes**:

### [`https://simplepdf.com/embed/json`](https://simplepdf.com/embed/json)

It describes every operation (its `request_type`, input/output JSON Schema, and per-operation error codes), the outbound events, the supported locales, and the **complete closed set of error codes** — each `code` carrying a plain-language description of its meaning. It is the iframe / `postMessage` counterpart to the REST API's OpenAPI spec at [`/api/json`](https://simplepdf.com/api/json).

- **Typed access (recommended):** [`@simplepdf/embed`](https://github.com/SimplePDF/simplepdf-embed/tree/main/packages/embed) generates its typed client, zod schemas (`/schemas`), and agentic tool registry (`/tools`, `/ai-sdk`) from this exact contract — use the package and you never read the raw spec.
- **Agents / LLMs:** point the model at `/embed/json` (or `@simplepdf/embed/ai-sdk`) to discover and drive the editor programmatically.

### Wire shape

Every request you post is `{ "type": <request_type>, "request_id": <your id>, "data": <input> }`; the editor replies with `{ "type": "REQUEST_RESULT", "data": { "request_id": <same id>, "result": <result> } }`, where `result` is `{ "success": true, "data": … }` or `{ "success": false, "error": { "code", "message" } }`. Outbound events (`EDITOR_READY`, `DOCUMENT_LOADED`, `PAGE_FOCUSED`, `SUBMISSION_SENT`) are pushed the same way. `request_type` is the operation name (e.g. `get_fields`, `set_field_value`, `submit`) and is accepted case-insensitively (the historical `SCREAMING_SNAKE` forms still work). The full set of `code` values is in the contract's `editor_error_schema`.
