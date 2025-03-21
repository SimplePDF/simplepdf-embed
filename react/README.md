</br>
</br>
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
</br>
</br>
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

- [Aautomatically collect your users' submissions](https://simplepdf.com/embed)
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

_Requires a SimplePDF account_

Use `const { embedRef, actions } = useEmbed();` to programmatically control the embed editor:

- `actions.submit`: Submit the document (specify or not whether to download a copy of the document on the device of the user)
- `actions.selectTool`: Select a tool to use

```jsx
import { EmbedPDF, useEmbed } from "@simplepdf/react-embed-pdf";

const { embedRef, actions } = useEmbed();

return (
   <>
      <button onClick={() => await actions.submit({ downloadCopyOnDevice: false })}>Submit</button>
      <button onClick={() => await actions.selectTool('TEXT')}>Select Text Tool</button>
      <EmbedPDF
         companyIdentifier="yourcompany"
         ref={embedRef}
         mode="inline"
         style={{ width: 900, height: 800 }}
         documentURL="https://cdn.simplepdf.com/simple-pdf/assets/sample.pdf"
      />
   </>
);
```

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
    <td>EmbedRefHandlers</td>
    <td>No</td>
    <td>Used for programmatic control of the editor</td>
  </tr>
  <tr>
    <td>mode</td>
    <td>"inline" | "modal"</td>
    <td>No (defaults to "modal")</td>
    <td>Inline the editor or display it inside a modal</td>
  </tr>
    <tr>
    <td>locale</td>
    <td>"en" | "de" | "es" | "fr" | "it" | "pt"</td>
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
    <td><a href="https://simplepdf.com/embed">Allows collecting customers submissions</a></td>
  </tr>
  <tr>
    <td>context</td>
    <td>Record&lt;string, unknown&gt;</td>
    <td>No</td>
    <td><a href="https://simplepdf.com/help/how-to/configure-webhooks-pdf-form-submissions#events">Sent via webhooks</a></td>
  </tr>
  <tr>
    <td>onEmbedEvent</td>
    <td>(event: EmbedEvent) => Promise<void> | void</td>
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
yarn link
yarn start
```

2. Use it in the target application

```sh
yarn link @simplepdf/react-embed-pdf
```
