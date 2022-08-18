# @simplepdf/react-embed-pdf

Easily add the simplePDF Form Editor into your website, by wrapping with any anchor tag with the `EmbedPDF` component.

- Compl
- Insanely small footprint ([< 1.4KB gzipped](https://bundlephobia.com/package/@simplepdf/react-embed-pdf@1.0.3))

## Install

```sh
npm install @simplepdf/react-embed-pdf
```

## How to use

### I don't have an account on SimplePDF:

Wrap any anchor element with the following:

```javascript
import { EmbedPDF } from "@simplepdf/react-embed-pdf";

<EmbedPDF>
  <a href="https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf">
    Dummy PDF
  </a>
</EmbedPDF>;
```

### I have an account on SimplePDF:

```javascript
import { EmbedPDF } from "@simplepdf/react-embed-pdf";

<EmbedPDF companyIdentifier="yourcompany">
  <a href="https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf">
    Dummy PDF
  </a>
</EmbedPDF>;
```

## FAQ

### This seems to good to be true, is it free?

Yes! The embed editor is and will remain free, it comes with a branding ("Powered by SimplePDF") that can be replaced (or removed) with your own logo under the [Premium Plan](https://www.simplepdf.eu/pricing)

### What happens to the document my users load and the data they fill in?

**For the default editor (`companyIdentifier` is not specified):**
It stays in their browser! The document(s) that they load and the data they fill in never leaves their computer: [SimplePDF privacy policy](https://simplepdf.eu/privacy_policy#what-data-we-dont-collect).

**For company editors (`companyIdentifier` is specified):**
The users are notified that the document and the data they submit is sent to the server: this is part of the `paid` offering of SimplePDF: allowing to automate form submissions.

### How come the library is so small?

The library is a simple wrapper around an iFrame that loads simplePDF on-demand (whenever the user clicks the wrapped link), as such the footprint for this "opening an iFrame" mechanism is very tiny, simplePDF is of course much bigger, but your users won't download anything until they have clicked the link. Think "lazy-loading".

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
