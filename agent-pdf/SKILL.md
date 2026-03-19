---
name: simplepdf
description: Edit and fill PDF documents. Use when the user wants to fill a PDF form,
  add text/signatures/checkboxes/images to a PDF, or annotate a PDF. Accepts a PDF
  URL or file upload and returns a ready-to-use editor link. URL inputs are passed
  through directly. File uploads are stored temporarily (1 hour) then deleted.
---

# SimplePDF - PDF Editor

Edit and fill PDF documents directly in the browser. Add text, signatures, checkboxes, images, and more.

## How it works

The SimplePDF editor opens any PDF via a URL in this format:

```
https://<host>.simplepdf.com/editor?open=<url-encoded-pdf-url>
```

Where `<host>` is either `embed` (default) or a company-specific portal identifier.

For PDFs already hosted at a URL, you can construct this link directly without any API call. The API at `agent.simplepdf.com` is a convenience layer that builds these links for you and handles file uploads for PDFs that are not hosted anywhere.

## From a URL

If the PDF is already accessible at a URL, you have two options:

### Option 1: Construct the editor URL directly (no API call needed)

URL-encode the PDF URL and append it to the editor base:

```
https://embed.simplepdf.com/editor?open=https%3A%2F%2Fexample.com%2Fform.pdf
```

### Option 2: Use the API

```
GET https://agent.simplepdf.com?url=https://example.com/form.pdf
```

Returns JSON with the editor URL and embed snippets.

## From a file

If the PDF is a local file (not hosted anywhere), upload it to the API. The file is stored temporarily (1 hour) to make it accessible to the browser-based editor.

### Shell

```bash
curl -X POST https://agent.simplepdf.com -F file=@document.pdf
```

### TypeScript

```typescript
const form = new FormData();
form.append("file", new Blob([pdfBytes], { type: "application/pdf" }), "document.pdf");

const response = await fetch("https://agent.simplepdf.com", { method: "POST", body: form });
const { url } = await response.json();
```

### Python

```python
import requests

with open("document.pdf", "rb") as f:
    response = requests.post("https://agent.simplepdf.com", files={"file": f})

url = response.json()["url"]
```

## Presenting the result to the user

Always present the `url` field as a clickable link. This is the primary way users will open the editor.

If you have access to a browser automation tool (e.g. agent-browser, Playwright, chrome-devtools MCP server), offer to open the `url` directly so the user can edit the PDF without leaving the conversation.

The `iframe` and `react` fields are for developers embedding the editor in a web application. Only present these when the user is building a web app.

## Company-specific editor

Add `companyIdentifier` to route to a custom SimplePDF portal:

```
https://agent.simplepdf.com?url=https://example.com/form.pdf&companyIdentifier=acme
```

Or construct it directly:

```
https://acme.simplepdf.com/editor?open=https%3A%2F%2Fexample.com%2Fform.pdf
```

### Portal features

When using a `companyIdentifier`, the portal owner has access to:

- **Email notifications**: receive an email each time a user submits a filled PDF
- **Webhook notifications**: receive submissions via webhook to integrate with any backend
- **Bring Your Own Storage (BYOS)**: route submitted PDFs directly to the company's own S3 or Azure storage bucket

These features are configured by the portal owner in the SimplePDF admin console. No additional API parameters are needed - they apply automatically when the `companyIdentifier` is set.

## Response

```json
{
  "id": "url-passthrough",
  "url": "https://embed.simplepdf.com/editor?open=https%3A%2F%2Fexample.com%2Fform.pdf",
  "iframe": "<iframe src=\"...\" width=\"100%\" height=\"800\" frameborder=\"0\"></iframe>",
  "react": "<EmbedPDF mode=\"inline\" documentURL=\"...\" />"
}
```

| Field    | Description                                      |
|----------|--------------------------------------------------|
| `id`     | Unique identifier for the upload (or `url-passthrough` for URL inputs) |
| `url`    | Direct link to open the PDF in the SimplePDF editor |
| `iframe` | HTML snippet to embed the editor in a web page   |
| `react`  | React component snippet (see example below)      |

### React integration

Requires `@simplepdf/react-embed-pdf` (`npm install @simplepdf/react-embed-pdf`):

```tsx
import { EmbedPDF } from "@simplepdf/react-embed-pdf";

const PDFEditor = ({ documentURL }: { documentURL: string }) => (
  <EmbedPDF mode="inline" documentURL={documentURL} />
);
```

With a company-specific portal:

```tsx
<EmbedPDF
  mode="inline"
  companyIdentifier="acme"
  documentURL="https://example.com/form.pdf"
/>
```

## Privacy

- **URL input**: The PDF URL is passed directly to the browser-based editor. The PDF is never downloaded or stored by this service.
- **File upload**: The PDF is temporarily stored for up to 1 hour to make it accessible to the browser-based editor, then automatically deleted.
- **Editing**: All PDF editing happens client-side in the browser. The edited document is never sent to SimplePDF servers.

## Supported operations

Once the user opens the editor link, they can:

- Fill form fields (text inputs, checkboxes, radio buttons, dropdowns)
- Add free text annotations anywhere on the page
- Draw or type signatures
- Add images
- Add checkboxes and checkmarks

## Limits

- Maximum PDF size: 50 MB (file uploads only)
- Uploaded files expire after 1 hour
- Rate limit: 30 requests per minute per IP
- URL must start with http:// or https://
- companyIdentifier must be a valid SimplePDF portal identifier
