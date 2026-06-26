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

The package root (`<EmbedPDF>`, `useEmbed`) has no `zod` dependency. Only the agentic tools — the opt-in [`@simplepdf/react-embed-pdf/ai-sdk`](#agentic--useembedtools-vercel-ai-sdk) subpath — need `zod` (a peer). Install it alongside if you use them (npm 7+ adds it automatically; pnpm / Yarn PnP users must add it explicitly):

```sh
npm install zod
```

## Related documentation

For shared product behavior and account-specific features, see the main embed README:

- [Data Privacy & `companyIdentifier`](../README.md#data-privacy--companyidentifier)
- [Branding Configuration](../README.md#branding-configuration)
- [Retrieving PDF Data](../README.md#retrieving-pdf-data)
- [Page Manipulation](../README.md#page-manipulation)
- [FAQ](../README.md#faq)

## How to use it

The `EmbedPDF` component has two modes: `"modal"` (default) and `"inline"`.

**[List of all available props](#available-props)**

### Account-specific features

_The features below require a [SimplePDF account](https://simplepdf.com/pricing#g)_

While the component does not require any account to be used (without any limits), you can specify the `companyIdentifier` to:

- [Automatically collect your users' submissions, configure webhooks, and use BYOS](../README.md#retrieving-pdf-data)
- [Customize branding and white-label behavior](../README.md#branding-configuration)
- [Use company mode instead of the default mode](../README.md#data-privacy--companyidentifier)

_Example_

```jsx
import { EmbedPDF } from '@simplepdf/react-embed-pdf';

<EmbedPDF mode="modal" companyIdentifier="yourcompany">
  <a href="https://cdn.simplepdf.com/simple-pdf/assets/sample.pdf">Opens sample.pdf</a>
</EmbedPDF>;
```

### Modal mode

Pass `mode="modal"` and wrap any HTML element to open a modal with the editor on user click.

```jsx
import { EmbedPDF } from "@simplepdf/react-embed-pdf";

// Opens the PDF on click
<EmbedPDF mode="modal">
  <a href="https://cdn.simplepdf.com/simple-pdf/assets/sample.pdf">
    Opens sample.pdf
  </a>
</EmbedPDF>

// Let the user pick the PDF
<EmbedPDF mode="modal">
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
  document={{ url: 'https://cdn.simplepdf.com/simple-pdf/assets/sample.pdf' }}
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
  document={{ url: 'https://cdn.simplepdf.com/simple-pdf/assets/sample.pdf' }}
/>;
```

See [Data Privacy & `companyIdentifier`](../README.md#data-privacy--companyidentifier) for reserved values and mode behavior.

### Programmatic Control

_Some actions require a SimplePDF account. See [Retrieving PDF Data](../README.md#retrieving-pdf-data) for storage and submission behavior._

`const { embedRef, actions } = useEmbed();` drives the editor imperatively (`actions`); the agentic `tools` come from the opt-in `@simplepdf/react-embed-pdf/ai-sdk` subpath (`useEmbedTools(embedRef)`). Attach `embedRef` to the component: `<EmbedPDF ref={embedRef} mode="inline" … />`.

#### Imperative — `actions`

Actions are camelCase (the editor's snake_case wire is transformed for you). `useEmbed().actions` exposes the FULL editor surface; the most common:

| Action                                           | Description                                                                                             |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `actions.goTo({ page })`                         | Navigate to a specific page                                                                             |
| `actions.selectTool({ tool })`                   | Select a tool: `'TEXT'`, `'COMB_TEXT'`, `'CHECKBOX'`, `'PICTURE'`, `'SIGNATURE'`, or `null` to deselect |
| `actions.detectFields()`                         | Automatically detect form fields in the document                                                        |
| `actions.deleteFields({ fieldIds?, page? })`     | Delete fields by id or page, or all fields if both are omitted                                          |
| `actions.getDocumentContent({ extractionMode })` | Extract document content (`'auto'` or `'ocr'`)                                                          |
| `actions.setFieldValue({ fieldId, value })`      | Set a field's value                                                                                     |
| `actions.submit({ downloadCopy })`               | Submit the document                                                                                     |

…plus `createField`, `getFields`, `focusField`, `movePage`, `rotatePage`, `deletePages`, `download`, and `loadDocument`. All actions return a `Promise` with a result object: `{ success: true, data: ... }` or `{ success: false, error: { code, message } }`.

```jsx
import { EmbedPDF, useEmbed } from '@simplepdf/react-embed-pdf';

const Editor = () => {
  const { embedRef, actions } = useEmbed();

  const handleSubmit = async () => {
    const result = await actions.submit({ downloadCopy: false });
    if (result.success) console.log('Submitted!');
  };

  const handleExtract = async () => {
    const result = await actions.getDocumentContent({ extractionMode: 'auto' });
    if (result.success) console.log('Pages:', result.data.pages);
  };

  return (
    <>
      <button onClick={handleSubmit}>Submit</button>
      <button onClick={handleExtract}>Extract Content</button>
      <button onClick={() => actions.detectFields()}>Detect Fields</button>
      <button onClick={() => actions.selectTool({ tool: 'TEXT' })}>Select Text Tool</button>
      <button onClick={() => actions.goTo({ page: 2 })}>Go to Page 2</button>
      <EmbedPDF
        ref={embedRef}
        mode="inline"
        companyIdentifier="yourcompany"
        style={{ width: 900, height: 800 }}
        document={{ url: 'https://cdn.simplepdf.com/simple-pdf/assets/sample.pdf' }}
      />
    </>
  );
};
```

**"Fill and read this document for me"** is just these actions in sequence — exactly what an AI agent calls on your behalf (read the fields, fill one, then walk the user to a signature: navigate to its page, focus it, open the signature tool):

```jsx
const { embedRef, actions } = useEmbed();

const fields = await actions.getFields(); // read
await actions.setFieldValue({ fieldId: 'f_full_name', value: 'Jane Doe' }); // fill
await actions.goTo({ page: 3 });
await actions.focusField({ fieldId: 'f_signature' });
await actions.selectTool({ tool: 'SIGNATURE' });
```

#### Agentic — `useEmbedTools` (Vercel AI SDK)

The agentic tools live in the opt-in `@simplepdf/react-embed-pdf/ai-sdk` subpath — importing it is what pulls `zod`, so a non-agentic app never loads it (mirroring `@simplepdf/embed`'s `/ai-sdk`). `useEmbedTools(embedRef)` binds the SimplePDF tool set to the live editor — drop it straight into the AI SDK and an LLM can drive the editor:

```jsx
import { useChat } from '@ai-sdk/react';
import { EmbedPDF, useEmbed } from '@simplepdf/react-embed-pdf';
import { useEmbedTools } from '@simplepdf/react-embed-pdf/ai-sdk';

const CopilotEditor = () => {
  const { embedRef } = useEmbed();
  const tools = useEmbedTools(embedRef);
  useChat({ tools }); // the model's tool calls run against the live editor
  return <EmbedPDF ref={embedRef} mode="inline" companyIdentifier="yourcompany" style={{ width: 900, height: 800 }} />;
};
```

For server-side tool definitions (execute-less, for `streamText`), import `simplePDFToolDefinitions` from `@simplepdf/react-embed-pdf/ai-sdk`. `embedRef.current` is the flat editor-actions handle — every camelCase operation, with the 1.x `selectTool` / `submit` overloads; subscribe to editor events via the `onEmbedEvent` prop. (The framework-free `@simplepdf/embed` core exposes the grouped `embed.actions` / `embed.events` / `embed.lifecycle` handle for non-React use.)

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
    <td>The live editor-actions handle, for programmatic control (see Programmatic Control). Attach the <code>embedRef</code> from <code>useEmbed()</code>.</td>
  </tr>
  <tr>
    <td>mode</td>
    <td>"inline" | "modal"</td>
    <td>No (defaults to "modal")</td>
    <td>Inline the editor in your layout, or display it inside a click-to-open modal</td>
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
    <td>document</td>
    <td>{ url: string } | { dataUrl: string } | { file: File | Blob }</td>
    <td>No</td>
    <td>The document to open (same typed shape as <code>createEmbed</code>): a URL (CORS / authenticated same-origin / a SimplePDF documents URL), a data URL, or a File/Blob</td>
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
