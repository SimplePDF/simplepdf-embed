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
<h1 align="center">Simple PDF Web Embed</h1>
<div align="center">
Add a powerful PDF editor directly into your website.
</div>
</br>
</br>
<p align="center">
<br/>
<a href="https://simplepdf.eu/embed" rel="dofollow"><strong>Read more about Simple PDF Embed »</strong></a>
<br/>
<br/>
<a href="https://discord.gg/TvRFMCTN">Join Our Discord</a>
  ·
<a href="https://twitter.com/simple_pdf">Follow us on Twitter</a>
</p>
<br/>
<br/>

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