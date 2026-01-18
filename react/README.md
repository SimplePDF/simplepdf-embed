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
Add a powerful PDF editor directly into your React App.
</div>
<br/>
<br/>
<p align="center">
<br/>
<a href="https://simplepdf.com/embed" rel="dofollow"><strong>Read more about SimplePDF Embed »</strong></a>
<br/>
<br/>
<a href="https://discord.gg/n6M8jb5GEP">Join Our Discord</a>
  ·
<a href="https://twitter.com/simple_pdf">Follow us on Twitter</a>
</p>
<br/>
<br/>

Easily add [SimplePDF](https://simplepdf.com) to your React app, by using the `EmbedPDF` component.

## [Demo](https://codesandbox.io/p/sandbox/m8p3gz)

## Install

```sh
npm install @simplepdf/react-embed-pdf
```

## How to use it

The `EmbedPDF` component has two modes: `"modal"` (default) and `"inline"`.

**[List of all available props](#available-props)**

### Account-specific features

_The features below require a [SimplePDF account](https://simplepdf.com/pricing#g)_

While the component does not require any account to be used (without any limits), you can specify the `companyIdentifier` to:

- [Automatically collect your users' submissions](https://simplepdf.com/embed)
- [Customize the editor and use your own branding](https://simplepdf.com/help/how-to/customize-the-pdf-editor-and-add-branding)
- [Configure webhooks](https://simplepdf.com/help/how-to/configure-webhooks-pdf-form-submissions)
- **Use your own storage**: [S3-compatible](https://simplepdf.com/help/how-to/use-your-own-s3-bucket-storage-for-pdf-form-submissions) / [Azure Blob Storage](https://simplepdf.com/help/how-to/use-your-own-azure-blob-storage-for-pdf-documents)

_Example_

```jsx
import { EmbedPDF } from '@simplepdf/react-embed-pdf';

<EmbedPDF companyIdentifier="yourcompany">
  <a href="https://cdn.simplepdf.com/simple-pdf/assets/sample.pdf">Opens sample.pdf</a>
</EmbedPDF>;
```

### Modal mode

Wrap any HTML element with `EmbedPDF` to open a modal with the editor on user click.

```jsx
import { EmbedPDF } from "@simplepdf/react-embed-pdf";

// Opens the PDF on click
<EmbedPDF>
  <a href="https://cdn.simplepdf.com/simple-pdf/assets/sample.pdf">
    Opens sample.pdf
  </a>
</EmbedPDF>

// Let the user pick the PDF
<EmbedPDF>
  <button>Opens the simplePDF editor</button>
</EmbedPDF>
```

### Inline mode

Render the PDF editor directly in your app

```jsx
import { EmbedPDF } from "@simplepdf/react-embed-pdf";

// The PDF is displayed when rendering the component
 <EmbedPDF
  mode="inline"
  style={{ width: 900, height: 800 }}
  documentURL="https://cdn.simplepdf.com/simple-pdf/assets/sample.pdf"
/>

// The PDF picker is displayed when rendering the component
 <EmbedPDF
  mode="inline"
  style={{ width: 900, height: 800 }}
/>
```

### Viewer mode only

Specify `react-viewer` as `companyIdentifier` to disable the editing features:

```jsx
import { EmbedPDF } from '@simplepdf/react-embed-pdf';

// The PDF is displayed using the viewer: all editing features are disabled
<EmbedPDF
  companyIdentifier="react-viewer"
  mode="inline"
  style={{ width: 900, height: 800 }}
  documentURL="https://cdn.simplepdf.com/simple-pdf/assets/sample.pdf"
/>;
```

### Programmatic Control

_Some actions require a SimplePDF account_

Use `const { embedRef, actions } = useEmbed();` to programmatically control the embed editor:

| Action                                           | Description                                                                                                         |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `actions.goTo({ page })`                         | Navigate to a specific page                                                                                         |
| `actions.selectTool(toolType)`                   | Select a tool: `'TEXT'`, `'BOXED_TEXT'`, `'CHECKBOX'`, `'PICTURE'`, `'SIGNATURE'`, or `null` to deselect (`CURSOR`) |
| `actions.createField(options)`                   | Create a field at specified position (see below)                                                                    |
| `actions.clearFields(options?)`                  | Clear fields by `fieldIds` or `page`, or all fields if no options                                                   |
| `actions.getDocumentContent({ extractionMode })` | Extract document content (`extractionMode: 'auto'` or `'ocr'`)                                                      |
| `actions.submit({ downloadCopyOnDevice })`       | Submit the document                                                                                                 |

All actions return a `Promise` with a result object: `{ success: true, data: ... }` or `{ success: false, error: { code, message } }`.

```jsx
import { EmbedPDF, useEmbed } from '@simplepdf/react-embed-pdf';

const Editor = () => {
  const { embedRef, actions } = useEmbed();

  const handleSubmit = async () => {
    const result = await actions.submit({ downloadCopyOnDevice: false });
    if (result.success) {
      console.log('Submitted!');
    }
  };

  const handleExtract = async () => {
    const result = await actions.getDocumentContent({ extractionMode: 'auto' });
    if (result.success) {
      console.log('Document name:', result.data.name);
      console.log('Pages:', result.data.pages);
    }
  };

  const handleCreateTextField = async () => {
    const result = await actions.createField({
      type: 'TEXT',
      page: 1,
      x: 100,
      y: 200,
      width: 150,
      height: 30,
      value: 'Hello World',
    });
    if (result.success) {
      console.log('Created field:', result.data.field_id);
    }
  };

  return (
    <>
      <button onClick={handleSubmit}>Submit</button>
      <button onClick={handleExtract}>Extract Content</button>
      <button onClick={handleCreateTextField}>Add Text Field</button>
      <button onClick={() => actions.selectTool('TEXT')}>Select Text Tool</button>
      <button onClick={() => actions.goTo({ page: 2 })}>Go to Page 2</button>
      <EmbedPDF
        companyIdentifier="yourcompany"
        ref={embedRef}
        mode="inline"
        style={{ width: 900, height: 800 }}
        documentURL="https://cdn.simplepdf.com/simple-pdf/assets/sample.pdf"
      />
    </>
  );
};
```

#### `createField` options

The `createField` action uses a discriminated union based on field type:

| Type                  | `value` format                                              |
| --------------------- | ----------------------------------------------------------- |
| `TEXT` / `BOXED_TEXT` | Plain text content                                          |
| `CHECKBOX`            | `'checked'` or `'unchecked'`                                |
| `PICTURE`             | Data URL (base64)                                           |
| `SIGNATURE`           | Data URL (base64) or plain text (generates typed signature) |

All field types share these base options: `page`, `x`, `y`, `width`, `height` (coordinates in PDF points, origin at bottom-left).

See [Retrieving PDF Data](../README.md#retrieving-pdf-data) for text extraction, downloading, and server-side storage options.

### <a id="available-props"></a>Available props

<table>
  <tr>
    <th>Name</th>
    <th>Type</th>
    <th>Required</th>
    <th>Description</th>
  </tr>
  <tr>
    <td>ref</td>
    <td>EmbedActions</td>
    <td>No</td>
    <td>Used for programmatic control of the editor (see Programmatic Control section)</td>
  </tr>
  <tr>
    <td>mode</td>
    <td>"inline" | "modal"</td>
    <td>No (defaults to "modal")</td>
    <td>Inline the editor or display it inside a modal</td>
  </tr>
  <tr>
    <td>locale</td>
    <td>"en" | "de" | "es" | "fr" | "it" | "nl" | "pt"</td>
    <td>No (defaults to "en")</td>
    <td>Language to display the editor in (ISO locale)</td>
  </tr>
  <tr>
    <td>children</td>
    <td>React.ReactElement</td>
    <td>Yes in "modal" mode</td>
    <td>Elements triggering the editor</td>
  </tr>
  <tr>
    <td>companyIdentifier</td>
    <td>string</td>
    <td>No</td>
    <td>
      Your SimplePDF portal. See <a href="../README.md#data-privacy--companyidentifier">Data Privacy & companyIdentifier</a> for reserved values and data handling details.
    </td>
  </tr>
  <tr>
    <td>baseDomain</td>
    <td>string</td>
    <td>No</td>
    <td>Override the base domain for self-hosted deployments (e.g., "yourdomain.com"). Contact sales@simplepdf.com for enterprise self-hosting</td>
  </tr>
  <tr>
    <td>context</td>
    <td>Record&lt;string, unknown&gt;</td>
    <td>No</td>
    <td><a href="https://simplepdf.com/help/how-to/configure-webhooks-pdf-form-submissions#events">Sent via webhooks</a></td>
  </tr>
  <tr>
    <td>onEmbedEvent</td>
    <td><code>(event: EmbedEvent) =&gt; Promise&lt;void&gt; | void</code></td>
    <td>No</td>
    <td><a href="https://github.com/SimplePDF/simplepdf-embed/blob/main/documentation/IFRAME.md#iframe-communication">Events sent by the Iframe</a></td>
  </tr>
  <tr>
    <td>documentURL</td>
    <td>string</td>
    <td>No</td>
    <td>Supports blob URLs, CORS URLs, and authenticated URLs (against the same origin). Available for inline mode only</td>
  </tr>
  <tr>
    <td>style</td>
    <td>React.CSSProperties</td>
    <td>No</td>
    <td>Available for inline mode only</td>
  </tr>
  <tr>
    <td>className</td>
    <td>string</td>
    <td>No</td>
    <td>Available for inline mode only</td>
  </tr>
</table>

## How to dev

1. Link the widget

```sh
npm link
npm start
```

2. Use it in the target application

```sh
npm link @simplepdf/react-embed-pdf
```
