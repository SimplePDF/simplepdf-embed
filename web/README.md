# @simplepdf/web-embed-pdf

Open PDF files with [SimplePDF](https://simplepdf.eu), using a simple script tag:

[Show me an example!](https://replit.com/@bendersej/Simple-PDF-Embed-Web)

## How to use

### I don't have an account on SimplePDF:

Add this script in the head of your webpage:

```javascript
<script src="https://unpkg.com/@simplepdf/web-embed-pdf" defer></script>
```

### I have an account on SimplePDF:

_Replace `companyIdentifier` with your own_

```javascript
<script
  src="https://unpkg.com/@simplepdf/web-embed-pdf"
  companyIdentifier="yourcompany"
  defer
></script>
```

## Why SimplePDF Embed?

- Fully-fledged PDF viewer & PDF form editor with simple script tag
- Completely free to use
- Insanely small footprint ([1.5KB gzipped](https://bundlephobia.com/package/@simplepdf/web-embed-pdf))

## How does it work?

**Anchor links (`a`) with an href pointing to a PDF file (`.pdf`) are automatically opened in [SimplePDF](https://simplepdf.eu)**

### I don't want every PDF document to be opened in SimplePDF

Exclude any anchor tags from opening SimplePDF by adding the class `exclude-simplepdf`:

```html
<a href="/example.pdf" class="exclude-simplepdf">Doesn't open with SimplePDF</a>
```

### My PDF file doesn't have a .pdf extension

Add a class `simplepdf` to any anchor tag to open them with SimplePDF:

```html
<a href="/example.pdf" class="simplepdf">Open with SimplePDF</a>
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
