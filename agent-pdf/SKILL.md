---
name: simplepdf
description: Edit and fill PDF documents. Use when the user wants to fill a PDF form,
  add text/signatures/checkboxes/images to a PDF, or annotate a PDF. Accepts a PDF
  URL or file upload and returns a ready-to-use editor link. Documents are processed
  client-side and never stored on SimplePDF servers.
---

# SimplePDF - PDF Editor

Edit and fill PDF documents directly in the browser. Add text, signatures, checkboxes, images, and more.

## Endpoint

`POST https://agents.simplepdf.com`

## Usage

### From a URL

When you have a PDF URL, send it as JSON:

```bash
curl -X POST https://agents.simplepdf.com \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/document.pdf"}'
```

### From a file

When you have a PDF file, upload it as multipart:

```bash
curl -X POST https://agents.simplepdf.com \
  -F file=@document.pdf
```

### Company-specific editor

If the user has a SimplePDF portal with a custom subdomain, pass it as a query parameter:

```bash
curl -X POST "https://agents.simplepdf.com?companyIdentifier=acme" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/form.pdf"}'
```

This routes to `acme.simplepdf.com` instead of the default editor.

## Response

```json
{
  "id": "abc-123",
  "url": "https://embed.simplepdf.com/editor?open=https://example.com/form.pdf",
  "iframe": "<iframe src=\"...\" width=\"100%\" height=\"800\" frameborder=\"0\"></iframe>",
  "react": "<EmbedPDF mode=\"inline\" documentURL=\"...\" />"
}
```

| Field    | Description                                      |
|----------|--------------------------------------------------|
| `id`     | Unique identifier for the upload (or `url-passthrough` for URL inputs) |
| `url`    | Direct link to open the PDF in the SimplePDF editor |
| `iframe` | HTML snippet to embed the editor in a page       |
| `react`  | React component snippet using `EmbedPDF` from `@simplepdf/react-embed-pdf` |

## When to use each field

- **`url`**: Present this to the user as a clickable link to edit/fill the PDF
- **`iframe`**: Use when embedding the editor in a web page
- **`react`**: Use when integrating into a React application

## Supported operations

Once the user opens the editor link, they can:

- Fill form fields (text inputs, checkboxes, radio buttons, dropdowns)
- Add free text annotations anywhere on the page
- Draw or type signatures
- Add images and stamps
- Add checkboxes and checkmarks
- Highlight, underline, or strikethrough text
- Add sticky notes

## Limits

- Maximum PDF size: 50 MB (file uploads only)
- Uploaded files expire after 1 hour
- Rate limit: 30 requests per minute per IP
