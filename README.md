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
Embed a powerful PDF editor in your app. Free for end-users. White-label, healthcare-ready, with webhooks, API, and bring-your-own-storage for businesses.
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
<p align="center">
<a href="https://simplepdf.com/embed" rel="dofollow"><strong>Read more about SimplePDF Embed »</strong></a>
<br/>
<br/>
<a href="https://discord.gg/n6M8jb5GEP">Join Our Discord</a>
  ·
<a href="https://twitter.com/simple_pdf">Follow us on Twitter</a>
</p>

<div align="center">
  <h1><a href="https://simplePDF.github.io" target="_blank">🔗 Try SimplePDF Embed</a></h1>
</div>

https://github.com/SimplePDF/simplepdf-embed/assets/10613140/8924f018-6076-4e44-9ae5-eedf9a740bb1

# Get started

- ⚛️ [React component](./react/README.md) - `@simplepdf/react-embed-pdf`
- 🚀 [Script tag](./web/README.md) - `@simplepdf/web-embed-pdf`
- 🛠 [Iframe API](./documentation/IFRAME.md) - `postMessage` events
- 🤖 [SimplePDF Copilot](./copilot/README.md) - AI form-filling reference implementation

# Features

- Edit, sign, and fill PDFs in the browser: text, checkboxes, pictures, signatures
- Auto-detection of pre-existing PDF form fields
- Page manipulation: add, remove, rotate, re-arrange
- White-label and headless mode (Pro plan+)
- Webhooks, API, bring-your-own-storage: S3, Azure Blob Storage, SharePoint
- AI [Copilot](./copilot/README.md) that fills forms step-by-step (opt-in)
- Tiny footprint (~5KB gzipped) - the editor lazy-loads on user interaction

# Built for healthcare and privacy-sensitive products

PHI never leaves the browser unless you explicitly enable submissions. BAA available, end-users need no signup, and submitted documents can land directly in your own S3, Azure Blob Storage, or SharePoint. Used in production by health-tech platforms.

[Learn more about SimplePDF for healthcare »](https://simplepdf.com/use-cases/healthcare)

# AI Copilot

AI that helps users fill PDF forms step by step, inside the SimplePDF editor.

Copilot is a turn-key, MIT-licensed reference implementation. Users answer in plain language; Copilot maps answers to the right fields, asks for what's missing, and the user reviews and signs. Fork it, wire up your AI provider, and ship it inside your product without writing the iframe bridge, tool plumbing, or streaming chat from scratch.

**Privacy by design:**

- PDF data stays in the browser. The SimplePDF iframe never uploads document bytes.
- Chat traffic flows through your server. You control the provider, the keys, and the logs.
- Submissions go direct to your storage (S3, Azure Blob Storage, or SharePoint).

**Links:**

- 🎬 [Live demo on a healthcare form](https://copilot.simplepdf.com/?share=78b6f31195aa35f3a8117ec5ade21bad2634b47638dc18d96d8429e044b61b47&form=healthcare)
- 📖 [Copilot README](./copilot/README.md) - architecture, fork points, deploy targets
- 🤖 [`skills/fork-and-go/SKILL.md`](./copilot/skills/fork-and-go/SKILL.md) - point Claude Code or Codex at it for a guided setup

---

<details>
<summary><strong>Privacy & data model</strong></summary>

## Data Privacy

SimplePDF Embed operates in two modes:

### Free editor

- All data stays in the browser - documents never leave the user's device
- Processed entirely client-side, no server communication
- No account or signup required
- Includes "Powered by SimplePDF" branding
- Submissions are not collected - users can only download their work

[What data we don't collect](https://simplepdf.com/privacy_policy#what-data-we-dont-collect)

### Paid plans

- Submissions stored and accessible via your dashboard
- Webhooks for form automation (Basic plan+) - [learn more](https://simplepdf.com/help/how-to/configure-webhooks-pdf-form-submissions)
- White-label: remove "Powered by SimplePDF", add your own logo, headless mode (Pro plan+) - [learn more](https://simplepdf.com/help/how-to/customize-the-pdf-editor-and-add-branding)
- Bring-your-own-storage: S3-compatible or Azure Blob Storage (Pro plan+), SharePoint (Premium plan) - [learn more](https://simplepdf.com/help/how-to/use-your-own-s3-bucket-storage-for-pdf-form-submissions)
- BAA available for healthcare customers

### Quick reference

| Aspect                     | Free editor            | Paid plans                                  |
| -------------------------- | ---------------------- | ------------------------------------------- |
| Document storage           | Browser only           | Server (configurable)                       |
| Submissions collected      | No                     | Yes (Basic plan+)                           |
| Branding                   | "Powered by SimplePDF" | Customizable (Pro plan+)                    |
| Webhooks                   | Not available          | Available (Basic plan+)                     |
| BYOS (S3/Azure/SharePoint) | Not available          | Available (plan-dependent)                  |
| Price                      | Free                   | [Paid plans](https://simplepdf.com/pricing) |

</details>

<details>
<summary><strong>Branding & white-labeling</strong></summary>

## Branding Configuration

### Default Branding (Free Tier)

Without a SimplePDF account, the editor displays "Powered by SimplePDF" branding.

### Custom Branding (Pro Plan)

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

</details>

<details>
<summary><strong>Architecture</strong></summary>

## Architecture

### Client-side processing

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
                    | (Only on paid plans)
                    v
+-----------------------------------------------------+
|                   SimplePDF Servers                 |
|         Submission storage, webhooks, etc.          |
+-----------------------------------------------------+
                    | (BYOS - paid plans, optional)
                    v
+-----------------------------------------------------+
|   Your Own Storage (S3/Azure Blob Storage/SharePoint)|
|         For HIPAA compliance, data residency, etc.  |
+-----------------------------------------------------+
```

### Benefits

| Benefit             | Description                                                     |
| ------------------- | --------------------------------------------------------------- |
| **Privacy**         | Documents never leave the browser (free editor)                 |
| **Security**        | No server-side attack surface for document processing           |
| **Performance**     | No upload/download latency for editing                          |
| **Offline capable** | Works without internet after initial load                       |
| **Cost efficient**  | No server resources for document processing                     |
| **GDPR friendly**   | Data minimization - no server storage by default                |

### Limitations

| Limitation                        | Description                                     | Workaround                                                 |
| --------------------------------- | ----------------------------------------------- | ---------------------------------------------------------- |
| **No server-side PDF generation** | Cannot generate PDFs from templates server-side | Use client-side field detection via `detectFields()`       |
| **No bulk processing**            | Cannot process multiple PDFs in batch           | Process sequentially or use dedicated server-side library  |
| **No programmatic PDF retrieval** | Cannot get modified PDF as Blob/Base64 in JS    | Use webhooks + server storage for programmatic access      |
| **No persistent storage**         | PDFs don't persist without user action          | Use a paid plan for server-side submission storage         |
| **Browser memory limits**         | Very large PDFs (100+ MB) may cause issues      | Recommend splitting large documents                        |

### When to use SimplePDF Embed

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

</details>

<details>
<summary><strong>Retrieving PDF data</strong></summary>

## Retrieving PDF Data

### Text content extraction

Use `getDocumentContent()` to extract text from the PDF. See the [React](./react/README.md#programmatic-control) or [Iframe](./documentation/IFRAME.md#get_document_content) documentation for implementation details.

### Downloading the modified PDF

Use `submit({ downloadCopyOnDevice: true })` to trigger a browser download of the modified PDF.

### Server-side PDF generation & storage

SimplePDF handles PDF generation and storage so you don't have to. When users submit, the filled PDF is automatically generated and stored - either on SimplePDF's servers or your own storage.

| Method                                      | How it works                  | Use case                             |
| ------------------------------------------- | ----------------------------- | ------------------------------------ |
| `submit` with `downloadCopyOnDevice: true`  | Browser downloads the PDF     | End-user saves their work            |
| `submit` with `downloadCopyOnDevice: false` | PDF sent to SimplePDF servers | Server-side collection via webhooks  |
| S3/Azure/SharePoint integration             | PDF stored in your storage    | Programmatic access via your storage |

**Available integrations:**

- **Webhooks**: get notified when submissions are received - [Configure webhooks](https://simplepdf.com/help/how-to/configure-webhooks-pdf-form-submissions)
- **Bring-your-own-storage (BYOS)**: store submissions directly in your storage - [S3 setup](https://simplepdf.com/help/how-to/use-your-own-s3-bucket-storage-for-pdf-form-submissions) / [Azure setup](https://simplepdf.com/help/how-to/bring-your-own-azure-blob-storage-for-pdf-storage) / [SharePoint setup](https://simplepdf.com/help/how-to/connect-sharepoint-as-your-own-storage-for-pdf-submissions)

</details>

<details>
<summary><strong>Page manipulation</strong></summary>

## Page Manipulation

SimplePDF includes built-in page manipulation capabilities:

| Feature              | How to access                                                |
| -------------------- | ------------------------------------------------------------ |
| **Re-arrange pages** | Drag and drop pages in the thumbnail sidebar                 |
| **Add pages**        | Click "+" button in thumbnail sidebar or use "Add Page" menu |
| **Remove pages**     | Right-click page thumbnail → "Delete page"                   |
| **Rotate pages**     | Right-click page thumbnail → "Rotate" options                |

### Enabling page manipulation

Page manipulation is **enabled by default** - no configuration required. Users access these features through the page thumbnail sidebar on the left side of the editor.

### Disabling page manipulation

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

### Programmatic control

Page manipulation and editor actions are available programmatically through the iframe `postMessage` API and the React component. Full event reference: [React](./react/README.md#programmatic-control) | [Iframe](./documentation/IFRAME.md#incoming-events-sent-to-the-iframe).

</details>

<details>
<summary><strong>FAQ</strong></summary>

## FAQ

### Is SimplePDF Embed free?

Yes. The embed editor is free with no usage limits. It includes "Powered by SimplePDF" branding, which can be customized or removed with a [Pro plan](https://www.simplepdf.com/pricing).

### What happens to the document my users load and the data they fill in?

**Free editor:**
It stays in their browser. The document(s) that they load and the data they fill in never leave their computer: [SimplePDF privacy policy](https://simplepdf.com/privacy_policy#what-data-we-dont-collect).

**Paid plans:**
Users are notified that the document and the data they submit is sent to the server. This is part of the paid offering: automated form submissions, webhooks, BYOS, and dashboard access.

### How come the library is so small?

The library is a thin wrapper around an iframe that loads SimplePDF on-demand (whenever the user clicks the wrapped link). The footprint for the wrapper is tiny; the editor itself is bigger but only loads when the user opens it. Think "lazy-loading".

### I'm looking for a PDF viewer only - can I disable editing?

Yes. Use viewer mode to display PDFs without any editing capabilities.

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

**Disabled in viewer mode:** annotation tools, form field editing, page manipulation, submit.
**Available in viewer mode:** PDF viewing and navigation, zoom, page thumbnails, download original PDF.

</details>
