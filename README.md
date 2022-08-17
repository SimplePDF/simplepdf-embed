# simplepdf-react

## Install

```sh
npm install @simplepdf/react-embed-pdf
```

## How to use

Wrap any anchor element with the following:

```javascript
import { EmbedPDF } from "@simplepdf/react-embed-pdf";

<EmbedPDF>
  <a href="https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf">
    Dummy PDF
  </a>
</EmbedPDF>;
```

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
