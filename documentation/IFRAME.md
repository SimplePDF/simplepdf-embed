# SimplePDF Embed using an iFrame

SimplePDF Embed [React](../react/README.md) and [Web](../web/README.md) allow you to easily integrate `SimplePDF` using a single line of code by displaying the editor in a modal.

**If you're however interested in having more control over the way SimplePDF is displayed in your app**, such as changing the way the modal looks or dropping it altogether – injecting the editor into a `div` for example, **read on:**

## [Show me an example!](https://replit.com/@bendersej/Simple-PDF-Embed-iFrame)

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


## Without a SimplePDF account (to use the free PDF editor)

_Notice how `COMPANY_IDENTIFIER` has been replaced with `embed`_


#### Let your users pick the file on their computer

```html
<iframe src="https://embed.simplePDF.eu/editor" frameBorder="0">
</iframe>
```

#### Open a given PDF file automatically

_- Replace `PUBLICLY_AVAILABLE_PDF_URL` with the url of the PDF to use._
```html
<iframe src="https://embed.simplePDF.eu/editor?open=PUBLICLY_AVAILABLE_PDF_URL" frameBorder="0">
</iframe>
```

