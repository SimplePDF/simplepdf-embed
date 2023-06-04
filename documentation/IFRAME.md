# SimplePDF Embed using an Iframe

SimplePDF Embed [React](../react/README.md) and [Web](../web/README.md) allow you to easily integrate `SimplePDF` using a single line of code by displaying the editor in a modal.

**If you're however interested in having more control over the way SimplePDF is displayed in your app**, such as changing the way the modal looks or dropping it altogether – injecting the editor into a `div` for example, **read on:**

## [Show me an example!](https://replit.com/@bendersej/Simple-PDF-Embed-Iframe)

## With a SimplePDF account (to collect customers' submissions)

_[Get your own SimplePDF account](https://simplepdf.eu/pricing)_


### Let your users pick the file on their computer
_- Replace `COMPANY_IDENTIFIER` with your own_
```html
<iframe src="https://COMPANY_IDENTIFIER.simplePDF.eu/editor" frameBorder="0">
</iframe>
```

### Open a given PDF file automatically
_- Replace `COMPANY_IDENTIFIER` with your own_

_- Replace `PUBLICLY_AVAILABLE_PDF_URL` with the url of the PDF to use._
```html
<iframe src="https://COMPANY_IDENTIFIER.simplePDF.eu/editor?open=PUBLICLY_AVAILABLE_PDF_URL" frameBorder="0">
</iframe>
```

### Specifying a context

_The context is sent as part of the submission via the webhooks integration: [read more](https://simplepdf.eu/help/how-to/configure-webhooks-pdf-form-submissions#events)_

**Use-cases:**

- Link a submission back to a customer
- Specify the environment / configuration of the editor

_Do not store sensitive information in the context (!!) as it is available locally to anyone inspecting the code_


```html
<iframe src="https://COMPANY_IDENTIFIER.simplePDF.eu/editor?open=PUBLICLY_AVAILABLE_PDF_URL&context=CONTEXT" frameBorder="0">
</iframe>
```

Where `CONTEXT` is a URL safe Base64 encoded stringified JSON.

### Implementation example
```javascript
const context = { customerId: '123', environment: 'production' };

const encodedContext = encodeURIComponent(btoa(JSON.stringify(context)))

const url = `https://COMPANY_IDENTIFIER.simplePDF.eu/editor?open=PUBLICLY_AVAILABLE_PDF_URL&context=${encodedContext}`
```


## Without a SimplePDF account (to use the free PDF editor)

_Notice how `COMPANY_IDENTIFIER` has been replaced with `embed`_


### Let your users pick the file on their computer

```html
<iframe src="https://embed.simplePDF.eu/editor" frameBorder="0">
</iframe>
```

### Open a given PDF file automatically

_- Replace `PUBLICLY_AVAILABLE_PDF_URL` with the url of the PDF to use._
```html
<iframe src="https://embed.simplePDF.eu/editor?open=PUBLICLY_AVAILABLE_PDF_URL" frameBorder="0">
</iframe>
```

## Iframe Communication
_Only available with a SimplePDF account_

When your users interact with the editor, the Iframe sends events that can allow you to reconcile data on your side or remove the `Iframe` from your app once a submission has been successfully sent.

Currently two events are sent by the Iframe:
- `DOCUMENT_LOADED`, containing the `document_id`: the document has been successfully loaded
- `SUBMISSION_SENT`, containing the `submission_id`: the customer has successfully sent the submission

### Implementation example
```javascript

const eventHandler = async (event) => {
  if (event.origin !== "https://yourcompany.simplepdf.eu") {
    return;
  }

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
      console.log("Event received:", payload)
      return;

    default:
      return;
  }
};

window.addEventListener("message", eventHandler, false);
```
