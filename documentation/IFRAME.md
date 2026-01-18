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
await sendEvent("SELECT_TOOL", { tool: "TEXT" }); // or "CHECKBOX", "SIGNATURE", "PICTURE", "BOXED_TEXT", null

// Create a field
await sendEvent("CREATE_FIELD", {
  type: "TEXT",
  page: 1,
  x: 100,
  y: 700,
  width: 200,
  height: 30,
  value: "Hello World",
});

// Clear all fields (or specific ones)
await sendEvent("CLEAR_FIELDS", {}); // Clear all
await sendEvent("CLEAR_FIELDS", { page: 1 }); // Clear page 1 only
await sendEvent("CLEAR_FIELDS", {
  field_ids: ["f_kj8n2hd9x3m1p", "f_q7v5c4b6a0wyz"],
}); // Clear specific fields

// Extract document content
const content = await sendEvent("GET_DOCUMENT_CONTENT", {
  extraction_mode: "auto",
});
console.log("Document name:", content.name);
console.log("Pages:", content.pages); // [{ page: 1, content: "..." }, ...]

// Submit the document
await sendEvent("SUBMIT", { download_copy: true });
```

---

## Events Reference

### Outgoing Events (sent by the iframe)

| Event             | Data                                                                                                          | Description                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `EDITOR_READY`    | `{}`                                                                                                          | Editor has loaded and is ready to receive commands |
| `DOCUMENT_LOADED` | `{ document_id: string }`                                                                                     | A document has been loaded into the editor         |
| `PAGE_FOCUSED`    | `{ previous_page: number \| null, current_page: number, total_pages: number }`                                | User navigated to a different page                 |
| `SUBMISSION_SENT` | `{ document_id: string, submission_id: string }`                                                              | Document was successfully submitted                |
| `REQUEST_RESULT`  | `{ request_id: string, result: { success: boolean, data?: any, error?: { code: string, message: string } } }` | Response to an incoming event                      |

### Incoming Events (sent to the iframe)

All incoming events require a `request_id` field and return a `REQUEST_RESULT` response.

#### LOAD_DOCUMENT

Load a PDF document into the editor.

| Field      | Type     | Required | Description                         |
| ---------- | -------- | -------- | ----------------------------------- |
| `data_url` | `string` | Yes      | URL or data URL (base64) of the PDF |
| `name`     | `string` | No       | Display name for the document       |
| `page`     | `number` | No       | Initial page to display (1-indexed) |

**Complete loading examples:**

```javascript
// Public URL
await sendEvent("LOAD_DOCUMENT", {
  data_url: "https://example.com/public/document.pdf",
  name: "my-document.pdf",
});

// Pre-signed S3 URL (must encode!)
const presignedUrl =
  "https://bucket.s3.amazonaws.com/doc.pdf?AWSAccessKeyId=...";
await sendEvent("LOAD_DOCUMENT", {
  data_url: encodeURIComponent(presignedUrl),
  name: "my-document.pdf",
});

// Base64 data URL
await sendEvent("LOAD_DOCUMENT", {
  data_url: "data:application/pdf;base64,JVBERi0xLjQK...",
  name: "my-document.pdf",
});

// Blob URL (created from File input)
const file = document.getElementById("fileInput").files[0];
const blobUrl = URL.createObjectURL(file);
await sendEvent("LOAD_DOCUMENT", {
  data_url: blobUrl,
  name: file.name,
});
```

#### GO_TO

Navigate to a specific page.

| Field  | Type     | Required | Description                            |
| ------ | -------- | -------- | -------------------------------------- |
| `page` | `number` | Yes      | Page number to navigate to (1-indexed) |

#### SELECT_TOOL

Select a drawing tool or return to cursor mode.

| Field  | Type             | Required | Description                                                                              |
| ------ | ---------------- | -------- | ---------------------------------------------------------------------------------------- |
| `tool` | `string \| null` | Yes      | `"TEXT"`, `"BOXED_TEXT"`, `"CHECKBOX"`, `"SIGNATURE"`, `"PICTURE"`, or `null` for cursor |

#### CREATE_FIELD

Create a new field on the document.

| Field    | Type     | Required | Description                                                           |
| -------- | -------- | -------- | --------------------------------------------------------------------- |
| `type`   | `string` | Yes      | `"TEXT"`, `"BOXED_TEXT"`, `"CHECKBOX"`, `"SIGNATURE"`, or `"PICTURE"` |
| `page`   | `number` | Yes      | Page number (1-indexed)                                               |
| `x`      | `number` | Yes      | X coordinate (PDF points from left)                                   |
| `y`      | `number` | Yes      | Y coordinate (PDF points from bottom)                                 |
| `width`  | `number` | Yes      | Field width in PDF points                                             |
| `height` | `number` | Yes      | Field height in PDF points                                            |
| `value`  | `string` | No       | Initial value (see value formats below)                               |

**Value formats by field type:**

- `TEXT` / `BOXED_TEXT`: Plain text content
- `CHECKBOX`: `"checked"` or `"unchecked"`
- `PICTURE`: Data URL (base64)
- `SIGNATURE`: Data URL (base64 image) or plain text (generates a typed signature)

**Response data:**

```json
{
  "field_id": "f_kj8n2hd9x3m1p"
}
```

#### CLEAR_FIELDS

Remove fields from the document.

| Field       | Type       | Required | Description                                      |
| ----------- | ---------- | -------- | ------------------------------------------------ |
| `field_ids` | `string[]` | No       | Specific field IDs to remove (omit to clear all) |
| `page`      | `number`   | No       | Only clear fields on this page                   |

**Response data:**

```json
{
  "cleared_count": 5
}
```

#### GET_DOCUMENT_CONTENT

Extract text content from the loaded document.

| Field             | Type     | Required | Description                                           |
| ----------------- | -------- | -------- | ----------------------------------------------------- |
| `extraction_mode` | `string` | No       | `"auto"` (default) or `"ocr"` to force OCR processing |

**Response data:**

```json
{
  "name": "document.pdf",
  "pages": [
    { "page": 1, "content": "Text content from page 1..." },
    { "page": 2, "content": "Text content from page 2..." }
  ]
}
```

#### SUBMIT

Submit the document for processing.

| Field           | Type      | Required | Description                                     |
| --------------- | --------- | -------- | ----------------------------------------------- |
| `download_copy` | `boolean` | Yes      | Whether to trigger a download of the filled PDF |

See [Retrieving PDF Data](../README.md#retrieving-pdf-data) for server-side storage and webhook integration options.

---

## Error Codes

| Code                               | Description                                     |
| ---------------------------------- | ----------------------------------------------- |
| `bad_request:signup_required`      | Feature requires a SimplePDF account            |
| `bad_request:editor_not_ready`     | Editor is not ready to handle the event         |
| `bad_request:invalid_page`         | Page must be an integer                         |
| `bad_request:page_out_of_range`    | Requested page does not exist                   |
| `bad_request:page_not_found`       | Could not get dimensions for the requested page |
| `bad_request:invalid_field_type`   | Unknown field type                              |
| `bad_request:invalid_tool`         | Unknown tool type                               |
| `bad_request:event_not_allowed`    | Event is not allowed for your configuration     |
| `forbidden:editing_not_allowed`    | Editing is disabled                             |
| `forbidden:origin_not_whitelisted` | Origin is not in your allowed origins list      |
| `forbidden:whitelist_required`     | Event requires origin whitelisting              |
