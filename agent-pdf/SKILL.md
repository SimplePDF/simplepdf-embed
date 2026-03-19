---
name: simplepdf
description: Edit and fill PDF documents. Use when the user wants to fill a PDF form,
  add text/signatures/checkboxes/images to a PDF, or annotate a PDF. Accepts a PDF
  URL or file upload and returns a ready-to-use editor link. URL inputs are passed
  through directly. File uploads are stored temporarily (1 hour) then deleted.
---

# SimplePDF - PDF Editor

Edit and fill PDF documents directly in the browser. Add text, signatures, checkboxes, images, and more.

## From a URL

Pass the PDF URL as a query parameter:

```
GET https://agent.simplepdf.com?url=https://example.com/document.pdf
```

Returns JSON with editor links. No POST needed.

## From a file

Upload a PDF file as multipart:

```bash
curl -X POST https://agent.simplepdf.com -F file=@document.pdf
```

## Company-specific editor

Add `companyIdentifier` to route to a custom portal:

```
GET https://agent.simplepdf.com?url=https://example.com/form.pdf&companyIdentifier=acme
```

This routes to `acme.simplepdf.com` instead of the default editor.

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
| `iframe` | HTML snippet to embed the editor in a page       |
| `react`  | React component snippet using `EmbedPDF` from `@simplepdf/react-embed-pdf` |

## When to use each field

- **`url`**: Present this to the user as a clickable link to edit/fill the PDF
- **`iframe`**: Use when embedding the editor in a web page
- **`react`**: Use when integrating into a React application

## Privacy

- **URL input**: The PDF URL is passed directly to the browser-based editor. The PDF is never downloaded or stored by this service.
- **File upload**: The PDF is temporarily stored for up to 1 hour to make it accessible to the browser-based editor, then automatically deleted.
- **Editing**: All PDF editing happens client-side in the browser. The edited document is never sent to SimplePDF servers.

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
- URL must start with http:// or https://
- companyIdentifier must be alphanumeric with hyphens (max 63 chars)
