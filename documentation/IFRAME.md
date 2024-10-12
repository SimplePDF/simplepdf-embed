# SimplePDF Embed using an Iframe

SimplePDF Embed [React](../react/README.md) and [Web](../web/README.md) allow you to easily integrate `SimplePDF` using a single line of code by displaying the editor in a modal.

**If you're however interested in having more control over the way SimplePDF is displayed in your app**, such as changing the way the modal looks or dropping it altogether – injecting the editor into a `div` for example, **read on:**

## [Show me an example!](https://replit.com/@bendersej/Simple-PDF-Embed-Iframe)

## With a SimplePDF account (to collect customers' submissions)

_[Get your own SimplePDF account](https://simplepdf.com/pricing)_

### Let your users pick the file on their computer

_- Replace `COMPANY_IDENTIFIER` with your own_

```html
<iframe src="https://COMPANY_IDENTIFIER.simplepdf.com/editor" frameborder="0">
</iframe>
```

### Open a given PDF file automatically

_- Replace `COMPANY_IDENTIFIER` with your own_

_- Replace `PUBLICLY_AVAILABLE_PDF_URL` with the url of the PDF to use._

```html
<iframe
  src="https://COMPANY_IDENTIFIER.simplepdf.com/editor?open=PUBLICLY_AVAILABLE_PDF_URL"
  frameborder="0"
>
</iframe>
```

### Specifying a context

_The context is sent as part of the submission via the webhooks integration: [read more](https://simplepdf.com/help/how-to/configure-webhooks-pdf-form-submissions#events)_

**Use-cases:**

- Link a submission back to a customer
- Specify the environment / configuration of the editor

_Do not store sensitive information in the context (!!) as it is available locally to anyone inspecting the code_

```html
<iframe
  src="https://COMPANY_IDENTIFIER.simplepdf.com/editor?open=PUBLICLY_AVAILABLE_PDF_URL&context=CONTEXT"
  frameborder="0"
>
</iframe>
```

Where `CONTEXT` is a URL safe Base64 encoded stringified JSON.

### Implementation example

```javascript
const context = { customerId: "123", environment: "production" };

const encodedContext = encodeURIComponent(btoa(JSON.stringify(context)));

const url = `https://COMPANY_IDENTIFIER.simplepdf.com/editor?open=PUBLICLY_AVAILABLE_PDF_URL&context=${encodedContext}`;
```

## Without a SimplePDF account (to use the free PDF editor)

_Notice how `COMPANY_IDENTIFIER` has been replaced with `embed`_

### Let your users pick the file on their computer

```html
<iframe src="https://embed.simplepdf.com/editor" frameborder="0"> </iframe>
```

### Open a given PDF file automatically

_- Replace `PUBLICLY_AVAILABLE_PDF_URL` with the url of the PDF to use._

```html
<iframe
  src="https://embed.simplepdf.com/editor?open=PUBLICLY_AVAILABLE_PDF_URL"
  frameborder="0"
>
</iframe>
```

## Iframe Communication

_Only available with a SimplePDF account_

[Head over here to see the incoming and outgoing events communication](../examples/with-iframe/index.html)

When your users interact with the editor, the Iframe sends events that can allow you to reconcile data on your side or remove the `Iframe` from your app once a submission has been successfully sent.

### Events `sent by` the Iframe:

_Events are stringified (`JSON.stringify`) before they are sent out_

- `DOCUMENT_LOADED`

```
type: 'DOCUMENT_LOADED'
data: { document_id: string }
```

Where `document_id` is the unique ID of the document that was successfully loaded.

- `SUBMISSION_SENT`

```
type: 'SUBMISSION_SENT'
data: { submission_id: string }
```

Where the `submission_id` is the unique ID of the submission successfully sent.

#### Implementation example

```javascript
const eventHandler = async (event) => {
  const payload = (() => {
    try {
      return JSON.parse(event.data);
    } catch (e) {
      console.error("Failed to parse Iframe event payload");
      return null;
    }
  })();

  switch (payload?.type) {
    case "DOCUMENT_LOADED":
    case "SUBMISSION_SENT":
      console.log("Event received:", payload);
      return;

    default:
      return;
  }
};

window.addEventListener("message", eventHandler, false);
```

### Events `sent to` the Iframe:

_Events must be stringified (`JSON.stringify`) before they are sent out_

- `LOAD_DOCUMENT`

```
type: "LOAD_DOCUMENT",
data: { data_url: string }
```

#### Implementation example

```javascript
const iframe = document.getElementById("iframe");

const response = await fetch(
  "https://cdn.simplepdf.com/simple-pdf/assets/example_en.pdf"
);
const blob = await response.blob();
const reader = new FileReader();
await new Promise((resolve, reject) => {
  reader.onload = resolve;
  reader.onerror = reject;
  reader.readAsDataURL(blob);
});

iframe.contentWindow.postMessage(
  JSON.stringify({
    type: "LOAD_DOCUMENT",
    data: { data_url: reader.result },
  }),
  "*"
);
```
