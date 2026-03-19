---
name: edit-pdf
description: Edit and fill PDF documents. Use when the user wants to fill a PDF form,
  add text/signatures/checkboxes/images to a PDF, or annotate a PDF. Accepts a PDF
  URL or file upload and returns a ready-to-use editor link. URL inputs are passed
  through directly. File uploads are stored temporarily (24 hours) then deleted.
---

# SimplePDF - PDF Editor

Edit and fill PDF documents directly in the browser. Add text, signatures, checkboxes, images, and more.

## From a URL

For public PDF URLs, use GET with the URL as a query parameter:

```
GET https://agent.simplepdf.com?url=https://example.com/form.pdf
```

For signed or sensitive URLs (e.g. presigned S3 links), use POST with a JSON body to keep the URL out of logs and browser history:

```bash
curl -X POST https://agent.simplepdf.com \
  -H "Content-Type: application/json" \
  -d '{"url": "https://s3.amazonaws.com/bucket/doc.pdf?X-Amz-Signature=..."}'
```

Both return JSON with the editor URL and embed snippets.

## From a file

Upload a PDF file to the API. For security and privacy, the file is stored temporarily (24 hours) then automatically deleted. The user has 24 hours to open the link. Once opened, the PDF is loaded into the browser and processed entirely client-side, so the tab can stay open indefinitely.

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
GET https://agent.simplepdf.com?url=https://example.com/form.pdf&companyIdentifier=acme
```

Or in a POST JSON body:

```json
{"url": "https://example.com/form.pdf", "companyIdentifier": "acme"}
```

### SimplePDF account features

When using a `companyIdentifier`, the account owner has access to:

- **Custom branding**: customize the editor appearance ([guide](https://simplepdf.com/help/how-to/customize-the-pdf-editor-and-add-branding))
- **Email notifications**: receive an email each time a user submits a filled PDF
- **Webhook notifications**: receive submissions via webhook to integrate with any backend ([guide](https://simplepdf.com/help/how-to/configure-webhooks-pdf-form-submissions))
- **Bring Your Own Storage (BYOS)**: route submitted PDFs directly to the company's own S3 or Azure storage bucket ([guide](https://simplepdf.com/help/how-to/use-your-own-s3-bucket-storage-for-pdf-form-submissions))

These features are configured in the SimplePDF admin console. No additional API parameters are needed - they apply automatically when the `companyIdentifier` is set.

## Response

```json
{
  "url": "https://...",
  "iframe": "<iframe src=\"...\" width=\"100%\" height=\"800\" frameborder=\"0\"></iframe>",
  "react": "<EmbedPDF mode=\"inline\" documentURL=\"...\" />"
}
```

| Field    | Description                                      |
|----------|--------------------------------------------------|
| `url`    | Direct link to open the PDF in the SimplePDF editor |
| `iframe` | HTML snippet to embed the editor in a web page   |
| `react`  | React component snippet (see example below)      |

### React integration

Requires `@simplepdf/react-embed-pdf` (`npm install @simplepdf/react-embed-pdf`):

```tsx
import { EmbedPDF } from "@simplepdf/react-embed-pdf";

const PDFEditor = ({ documentURL }: { documentURL: string }) => (
  <EmbedPDF mode="inline" companyIdentifier="ai" documentURL={documentURL} />
);
```

With a company-specific portal, replace `"ai"` with the portal identifier:

```tsx
<EmbedPDF
  mode="inline"
  companyIdentifier="acme"
  documentURL="https://example.com/form.pdf"
/>
```

## Privacy

- **URL input**: The PDF URL is passed directly to the browser-based editor. The PDF is never downloaded or stored by this service.
- **File upload**: For security and privacy, uploaded PDFs are stored for up to 24 hours then automatically deleted. Once the editor loads the PDF in the browser, the tab works independently of the stored file.
- **Editing**: All PDF editing happens client-side in the browser. The edited document is never sent to SimplePDF servers.

## Supported operations

Once the user opens the editor link, they can:

- Automatic detection of form fields
- Fill form fields (text inputs, checkboxes, radio buttons, dropdowns)
- Add free text annotations anywhere on the page
- Draw or type signatures
- Add images
- Add checkboxes and checkmarks

## Limits

- Maximum PDF size: 50 MB (file uploads only)
- Uploaded files expire after 24 hours
- Rate limit: 30 requests per minute per IP
- URL must start with http:// or https://
- companyIdentifier must be a valid SimplePDF portal identifier

## Legal

SimplePDF is not responsible for the content of uploaded PDFs. By using this service, you agree that you have the right to process the documents you upload. For concerns or requests, contact support@simplepdf.com.
