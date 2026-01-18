<br/>
<br/>
<div align="center">
  <a href="https://simplepdf.com" target="_blank">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://cdn.simplepdf.com/simple-pdf/assets/simplepdf-github-white.png?">
    <img src="https://cdn.simplepdf.com/simple-pdf/assets/simplepdf-github.png?" width="280" alt="Logo"/>
  </picture>
  </a>
</div>
<br/>
<div align="center">
Add a powerful PDF editor directly into your website or React App.
</div>
<br/>
<div align="center">
  <a href="https://github.com/SimplePDF/simplepdf-embed/blob/main/LICENSE.md">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="SimplePDF embed is released under the MIT license." />
  </a>
  <a href="https://twitter.com/intent/tweet?text=Add+a+powerful+PDF+editor+directly+into+your+website+or+React+App!&url=https://simplepdf.com/embed">
    <img src="https://img.shields.io/twitter/url/http/shields.io.svg?style=social" alt="Tweet" />
  </a>
</div>
<br/>
<br/>
<p align="center">
<br />
<a href="https://simplepdf.com/embed" rel="dofollow"><strong>Read more about SimplePDF Embed »</strong></a>
<br />
<br/>
<a href="https://discord.gg/n6M8jb5GEP">Join Our Discord</a>
  ·
<a href="https://twitter.com/simple_pdf">Follow us on Twitter</a>
</p>

<div align="center">
  <h1><a href="https://simplePDF.github.io" target="_blank">🔗 Try SimplePDF Embed</a></h1>
</div>

https://github.com/SimplePDF/simplepdf-embed/assets/10613140/8924f018-6076-4e44-9ae5-eedf9a740bb1

# Features

- Client-based: the document and data filled in does not leave the browser
- Add text, checkboxes, pictures, and signatures to PDF documents
- Add, remove, re-arrange, rotate pages
- Automatic detection of pre-existing PDF fields

# Data Privacy & companyIdentifier

SimplePDF Embed operates in two distinct modes with different privacy characteristics:

## Default Mode (Free Editor)

**When `companyIdentifier` is NOT specified or uses a reserved value:**

| Value               | Mode   | Description                                |
| ------------------- | ------ | ------------------------------------------ |
| Not set / `"embed"` | Editor | Free editor with full editing capabilities |
| `"react-editor"`    | Editor | Same as `embed`, for React integration     |
| `"viewer"`          | Viewer | Read-only PDF viewer, no editing tools     |
| `"react-viewer"`    | Viewer | Same as `viewer`, for React integration    |

**In default mode:**

- All data stays in the browser - documents never leave the user's device
- Documents are processed entirely client-side
- No server communication for document processing
- No account required
- Includes "Powered by SimplePDF" branding
- Form submissions are NOT collected (download only)

**Privacy Policy:** [What data we don't collect](https://simplepdf.com/privacy_policy#what-data-we-dont-collect)

## Company Mode (Paid Feature)

**When `companyIdentifier` IS specified:**

- Submissions are stored and accessible via your dashboard
- Enables webhook integration for form automation (Basic plan+) - [learn more](https://simplepdf.com/help/how-to/configure-webhooks-pdf-form-submissions)
- Custom branding - remove "Powered by SimplePDF", add your own logo, headless mode... (Pro plan+) - [learn more](https://simplepdf.com/help/how-to/customize-the-pdf-editor-and-add-branding)
- Use your own S3/Azure Blob Storage for PDF documents (Pro plan+) - [learn more](https://simplepdf.com/help/how-to/use-your-own-s3-bucket-storage-for-pdf-form-submissions)

**Data Flow:**

```
User fills PDF -> Clicks Submit -> Metadata sent to SimplePDF -> Webhook triggered -> Available in dashboard
```

## Quick Reference

| Aspect                | Default Mode              | Company Mode                                |
| --------------------- | ------------------------- | ------------------------------------------- |
| `companyIdentifier`   | Not set / reserved values | Your company ID                             |
| Document storage      | Browser only              | Server (configurable)                       |
| User notification     | None needed               | Shown before submit                         |
| Submissions collected | No                        | Yes (Basic plan+)                           |
| Branding              | "Powered by SimplePDF"    | Customizable (Pro plan+)                    |
| Webhooks              | Not available             | Available (Basic plan+)                     |
| BYOS (S3/Azure)       | Not available             | Available (Pro plan+)                       |
| Price                 | Free                      | [Paid plans](https://simplepdf.com/pricing) |

# Branding Configuration

## Default Branding (Free Tier)

Without a SimplePDF account, the editor displays "Powered by SimplePDF" branding.

## Custom Branding (Pro Plan)

With a [Pro plan](https://simplepdf.com/pricing), you can:

- Remove "Powered by SimplePDF" entirely
- Add your own company logo
- Customize colors and appearance
- Enable headless mode (no sidebar, programmatic controls only)

**To remove/customize branding:**

1. [Subscribe to a Pro plan](https://simplepdf.com/pricing)
2. Go to your Dashboard
3. Upload your logo or remove the sidebar entirely
4. Use your `companyIdentifier` in the embed code:

```jsx
// React - branding configured in your dashboard settings
<EmbedPDF companyIdentifier="yourcompany">
  <button>Edit PDF</button>
</EmbedPDF>
```

```html
<!-- Script tag - branding configured in your dashboard settings -->
<script
  src="https://unpkg.com/@simplepdf/web-embed-pdf"
  companyIdentifier="yourcompany"
  defer
></script>
```

**Note:** Branding is configured through your SimplePDF dashboard, not via code props. The `companyIdentifier` links your embed to your dashboard settings.

For detailed customization options, see: [Customize the PDF Editor and Add Branding](https://simplepdf.com/help/how-to/customize-the-pdf-editor-and-add-branding)

# Architecture

## Client-Side Processing

SimplePDF Embed uses a **fully client-side architecture** for PDF processing:

```
+-----------------------------------------------------+
|                    User's Browser                   |
|  +-----------------+         +-------------------+  |
|  |    Your App     |-------->|    SimplePDF      |  |
|  |                 |         |     Iframe        |  |
|  +-----------------+         +-------------------+  |
|         |                            |              |
|         v                            v              |
|    postMessage               PDF editing / filling  |
|    Events                                           |
+-----------------------------------------------------+
                    | (Only with companyIdentifier)
                    v
+-----------------------------------------------------+
|                   SimplePDF Servers                 |
|         Submission storage, webhooks, etc.          |
+-----------------------------------------------------+
                    | (BYOS - Pro plan, optional)
                    v
+-----------------------------------------------------+
|        Your Own Storage (S3/Azure Blob Storage)     |
|         For HIPAA compliance, data residency, etc.  |
+-----------------------------------------------------+
```

## Benefits

| Benefit             | Description                                                     |
| ------------------- | --------------------------------------------------------------- |
| **Privacy**         | Documents never leave the browser (without `companyIdentifier`) |
| **Security**        | No server-side attack surface for document processing           |
| **Performance**     | No upload/download latency for editing                          |
| **Offline capable** | Works without internet after initial load                       |
| **Cost efficient**  | No server resources for document processing                     |
| **GDPR friendly**   | Data minimization - no server storage by default                |

## Limitations

| Limitation                        | Description                                     | Workaround                                                 |
| --------------------------------- | ----------------------------------------------- | ---------------------------------------------------------- |
| **No server-side PDF generation** | Cannot generate PDFs from templates server-side | Use client-side field creation via `createField()`         |
| **No bulk processing**            | Cannot process multiple PDFs in batch           | Process sequentially or use dedicated server-side library  |
| **No programmatic PDF retrieval** | Cannot get modified PDF as Blob/Base64 in JS    | Use webhooks + server storage for programmatic access      |
| **No persistent storage**         | PDFs don't persist without user action          | Use `companyIdentifier` for server-side submission storage |
| **Browser memory limits**         | Very large PDFs (100+ MB) may cause issues      | Recommend splitting large documents                        |

## When to Use SimplePDF Embed

**Good fit:**

- End-user PDF form filling
- Document signing workflows
- PDF annotation and commenting
- Privacy-sensitive document handling
- Embedding PDF editing in web apps

**Consider alternatives for:**

- Server-side PDF generation from templates
- Bulk PDF processing pipelines
- Automated document workflows (without user interaction)
- Extracting raw PDF bytes programmatically

# Retrieving PDF Data

## Text Content Extraction

Use `getDocumentContent()` to extract text from the PDF. See the [React](./react/README.md#programmatic-control) or [Iframe](./documentation/IFRAME.md#get_document_content) documentation for implementation details.

## Downloading the Modified PDF

Use `submit({ downloadCopyOnDevice: true })` to trigger a browser download of the modified PDF.

## Server-Side PDF Generation & Storage

SimplePDF handles PDF generation and storage so you don't have to. When users submit, the filled PDF is automatically generated and stored - either on SimplePDF's servers or your own storage.

| Method                                      | How It Works                  | Use Case                             |
| ------------------------------------------- | ----------------------------- | ------------------------------------ |
| `submit` with `downloadCopyOnDevice: true`  | Browser downloads the PDF     | End-user saves their work            |
| `submit` with `downloadCopyOnDevice: false` | PDF sent to SimplePDF servers | Server-side collection via webhooks  |
| S3/Azure Integration                        | PDF stored in your bucket     | Programmatic access via your storage |

**Available integrations:**

- **Webhooks**: Get notified when submissions are received - [Configure webhooks](https://simplepdf.com/help/how-to/configure-webhooks-pdf-form-submissions)
- **Bring Your Own Storage (BYOS)**: Store submissions directly in your storage - [S3 setup](https://simplepdf.com/help/how-to/use-your-own-s3-bucket-storage-for-pdf-form-submissions) / [Azure setup](https://simplepdf.com/help/how-to/use-your-own-azure-blob-storage-for-pdf-documents)

# Page Manipulation

SimplePDF includes built-in page manipulation capabilities:

| Feature              | How to Access                                                |
| -------------------- | ------------------------------------------------------------ |
| **Re-arrange pages** | Drag and drop pages in the thumbnail sidebar                 |
| **Add pages**        | Click "+" button in thumbnail sidebar or use "Add Page" menu |
| **Remove pages**     | Right-click page thumbnail -> "Delete page"                  |
| **Rotate pages**     | Right-click page thumbnail -> "Rotate" options               |

## Enabling Page Manipulation

Page manipulation is **enabled by default** - no configuration required. Users access these features through the page thumbnail sidebar on the left side of the editor.

## Disabling Page Manipulation

**Using viewer mode (free):**

```jsx
// React
<EmbedPDF companyIdentifier="react-viewer" ... />
```

```html
<!-- Script tag -->
<script ... companyIdentifier="viewer"></script>
```

**Using Pro plan customization:**

With a [Pro plan](https://simplepdf.com/pricing), you can selectively disable page manipulation while keeping editing features enabled. In your dashboard:

- Toggle "Allow moving, rotating, deleting pages" to disable re-arrange/rotate/delete
- Toggle "Allow adding new pages" to disable page insertion

See: [Customize the PDF Editor and Add Branding](https://simplepdf.com/help/how-to/customize-the-pdf-editor-and-add-branding)

## Programmatic Page Control

Currently, page manipulation (add/remove/re-arrange/rotate) is only available through the UI. There are no programmatic APIs for these operations. If you need this feature, [file an issue on the repository](https://github.com/SimplePDF/simplepdf-embed/issues).

**Available programmatic navigation:**

```jsx
// Navigate to a specific page
await actions.goTo({ page: 3 });
```

# Get started

[⚛️ Using the `EmbedPDF` React component](./react/README.md)

[🚀 Using a script tag](./web/README.md)

[🛠 Using the Iframe](./documentation/IFRAME.md)

# Why SimplePDF Embed?

- Fully-fledged PDF viewer & PDF form editor with a simple wrapper
- Completely free to use
- Tiny footprint (~5KB gzipped)

# FAQ

### Is SimplePDF Embed free?

Yes. The embed editor is free with no usage limits. It includes "Powered by SimplePDF" branding, which can be customized or removed with a [Pro plan](https://www.simplepdf.com/pricing).

### What happens to the document my users load and the data they fill in?

**For the default editor (`companyIdentifier` is not specified):**
It stays in their browser! The document(s) that they load and the data they fill in never leave their computer: [SimplePDF privacy policy](https://simplepdf.com/privacy_policy#what-data-we-dont-collect).

**For company editors (`companyIdentifier` is specified):**
The users are notified that the document and the data they submit is sent to the server. This is part of the `paid` offering of SimplePDF: allowing to automate form submissions.

### How come the library is so small?

The library is a simple wrapper around an Iframe that loads SimplePDF on-demand (whenever the user clicks the wrapped link), as such the footprint for this "opening an Iframe" mechanism is very tiny, the SimplePDF editor is of course bigger, but your users won't download anything until they have clicked the link. Think "lazy-loading".

### I'm looking for a PDF viewer only, can I disable the editing features?

Yes! Use viewer mode to display PDFs without any editing capabilities.

**React:**

```jsx
<EmbedPDF
  companyIdentifier="react-viewer"
  mode="inline"
  documentURL="https://example.com/document.pdf"
  style={{ width: 900, height: 800 }}
/>
```

**Script tag:**

```html
<script
  src="https://unpkg.com/@simplepdf/web-embed-pdf"
  companyIdentifier="viewer"
  defer
></script>
```

**Iframe:**

```html
<iframe src="https://viewer.simplepdf.com/editor?open=PDF_URL"></iframe>
```

**What's disabled in viewer mode:**

- All annotation tools (text, checkbox, signature, picture)
- Form field editing
- Page manipulation (add, remove, rotate, re-arrange)
- Submit functionality

**What remains available:**

- PDF viewing and navigation
- Zoom controls
- Page thumbnails
- Download original PDF
