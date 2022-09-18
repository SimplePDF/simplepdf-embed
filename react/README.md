# @simplepdf/react-embed-pdf

Easily add [SimplePDF](https://simplepdf.eu) into your website, by wrapping any HTML element with the `EmbedPDF` component.

[Show me an example!](https://replit.com/@bendersej/Simple-PDF-Embed)

## Why SimplePDF Embed?

- Fully-fledged PDF viewer & PDF form editor with a simple wrapper
- Completely free to use
- Insanely small footprint ([1.5KB gzipped](https://bundlephobia.com/package/@simplepdf/react-embed-pdf@1.2.0))

## Install

```sh
npm install @simplepdf/react-embed-pdf
```

## How to use

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

```javascript
import { EmbedPDF } from "@simplepdf/react-embed-pdf";
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

## FAQ

### This seems too good to be true, is it free?

Yes! The embed editor is and will remain free, it comes with a branding ("Powered by SimplePDF") that can be replaced (or removed) with your own logo under the [Premium Plan](https://www.simplepdf.eu/pricing)

### What happens to the document my users load and the data they fill in?

**For the default editor (`companyIdentifier` is not specified):**
It stays in their browser! The document(s) that they load and the data they fill in never leaves their computer: [SimplePDF privacy policy](https://simplepdf.eu/privacy_policy#what-data-we-dont-collect).

**For company editors (`companyIdentifier` is specified):**
The users are notified that the document and the data they submit is sent to the server. This is part of the `paid` offering of SimplePDF: allowing to automate form submissions.

### How come the library is so small?

The library is a simple wrapper around an iFrame that loads SimplePDF on-demand (whenever the user clicks the wrapped link), as such the footprint for this "opening an iFrame" mechanism is very tiny, the SimplePDF editor is of course bigger, but your users won't download anything until they have clicked the link. Think "lazy-loading".

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
