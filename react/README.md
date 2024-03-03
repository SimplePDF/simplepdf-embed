</br>
</br>
<div align="center">
  <a href="https://simplepdf.eu" target="_blank">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://cdn.simplepdf.eu/simple-pdf/assets/simplepdf-github-white.png">
    <img src="https://cdn.simplepdf.eu/simple-pdf/assets/simplepdf-github.png" width="280" alt="Logo"/>
  </picture>
  </a>
</div>
<h1 align="center">SimplePDF React Embed</h1>
<div align="center">
Add a powerful PDF editor directly into your React App.
</div>
</br>
</br>
<p align="center">
<br/>
<a href="https://simplepdf.eu/embed" rel="dofollow"><strong>Read more about SimplePDF Embed »</strong></a>
<br/>
<br/>
<a href="https://discord.gg/TvRFMCTN">Join Our Discord</a>
  ·
<a href="https://twitter.com/simple_pdf">Follow us on Twitter</a>
</p>
<br/>
<br/>

Easily add [SimplePDF](https://simplepdf.eu) into your website, by wrapping any HTML element with the `EmbedPDF` component.

## [Show me an example!](https://replit.com/@bendersej/Simple-PDF-Embed)

## Install

```sh
npm install @simplepdf/react-embed-pdf
```

## How to use it

### I don't have an account on SimplePDF:

```javascript
import { EmbedPDF } from "@simplepdf/react-embed-pdf";

// Modal mode: opens the PDF on click
<EmbedPDF>
  <a href="https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf">
    Opens dummy.pdf
  </a>
</EmbedPDF>

// Inline mode: the PDF is displayed when rendering the component
 <EmbedPDF
  mode="inline"
  style={{ width: 900, height: 800 }}
  documentURL="https://cdn.simplepdf.eu/simple-pdf/assets/placeholder.pdf"
/>

// Modal mode: let the user pick the PDF
<EmbedPDF>
  <button>Opens the simplePDF editor</button>
</EmbedPDF>

// Inline mode: the PDF picker is displayed when rendering the component
 <EmbedPDF
  mode="inline"
  style={{ width: 900, height: 800 }}
/>
```

### I have an account on SimplePDF:

```javascript
import { EmbedPDF } from "@simplepdf/react-embed-pdf";

// Modal mode: opens the PDF on click
<EmbedPDF companyIdentifier="yourcompany">
  <a href="https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf">
    Opens dummy.pdf
  </a>
</EmbedPDF>

// Inline mode: the PDF is displayed when rendering the component
 <EmbedPDF
  mode="inline"
  style={{ width: 900, height: 800 }}
  companyIdentifier="yourcompany"
  documentURL="https://cdn.simplepdf.eu/simple-pdf/assets/placeholder.pdf"
/>

// Modal mode: let the user pick the PDF
<EmbedPDF companyIdentifier="yourcompany">
  <button>Opens the simplePDF editor</button>
</EmbedPDF>

// Inline mode: the PDF picker is displayed when rendering the component
<EmbedPDF
  mode="inline"
  style={{ width: 900, height: 800 }}
  companyIdentifier="yourcompany"
/>
```

### Available props

<table>
  <tr>
    <th>Name</th>
    <th>Type</th>
    <th>Required</th>
    <th>Description</th>
  </tr>
    <tr>
    <td>mode</td>
    <td>"inline" | "modal"</td>
    <td>No</td>
    <td>Inline the editor or display it inside a modal</td>
  </tr>
  <tr>
    <td>children</td>
    <td>React.ReactElement</td>
    <td>Yes</td>
    <td>Elements triggering the editor</td>
  </tr>
  <tr>
    <td>companyIdentifier</td>
    <td>string</td>
    <td>No</td>
    <td><a href="https://simplePDF.eu/embed">Allows collecting customers submissions</a></td>
  </tr>
    <tr>
    <td>context</td>
    <td>Record&lt;string, unknown&gt;</td>
    <td>No</td>
    <td><a href="https://simplepdf.eu/help/how-to/configure-webhooks-pdf-form-submissions#events">Sent via webhooks</a></td>
  </tr>
  <tr>
    <td>onEmbedEvent</td>
    <td>(event: EmbedEvent) => Promise<void> | void</td>
    <td>No</td>
    <td><a href="https://github.com/SimplePDF/simplepdf-embed/blob/main/documentation/IFRAME.md#iframe-communication">Events sent by the Iframe</a></td>
  </tr>
    <tr>
    <td>style</td>
    <td>React.CSSProperties</td>
    <td>No</td>
    <td>Available for inline mode only</td>
  </tr>
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
