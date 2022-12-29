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

[Show me an example!](https://replit.com/@bendersej/Simple-PDF-Embed)

## Install

```sh
npm install @simplepdf/react-embed-pdf
```

## How to use it

### I don't have an account on SimplePDF:

Wrap any element with the following:

```javascript
import { EmbedPDF } from "@simplepdf/react-embed-pdf";

<EmbedPDF>
  <a href="https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf">
    Opens dummy.pdf
  </a>
</EmbedPDF>


<EmbedPDF>
  <button>Opens the simplePDF editor</button>
</EmbedPDF>
```

### I have an account on SimplePDF:

```javascript
import { EmbedPDF } from "@simplepdf/react-embed-pdf";

<EmbedPDF companyIdentifier="yourcompany">
  <a href="https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf">
    Opens dummy.pdf
  </a>
</EmbedPDF>

<EmbedPDF companyIdentifier="yourcompany">
  <button>Opens the simplePDF editor<button>
</EmbedPDF>
```

### Available props

<table>
  <tr>
    <th>Name</th>
    <th>Type</th>
    <th>Required</th>
  </tr>
  <tr>
    <td>children</td>
    <td>React.ReactElement</td>
    <td>Yes</td>
  </tr>
  <tr>
    <td>companyIdentifier</td>
    <td>string</td>
    <td>No</td>
  </tr>
  <tr>
    <td>onEmbedEvent</td>
    <td>(event: EmbedEvent) => Promise<void> | void</td>
    <td>No</td>
  </tr>
</table>

## How to dev

_Pre-requisite: make sure to link React from the target application to avoid duplicated react dependencies, more details [here](https://reactjs.org/warnings/invalid-hook-call-warning.html#duplicate-react)_

1. Link the widget

```sh
yarn link
yarn start
```

2. Use it in the target application

```sh
yarn link @simplepdf/react-embed-pdf
```
