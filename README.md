</br>
</br>
<div align="center">
  <a href="https://simplepdf.com" target="_blank">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://cdn.simplepdf.com/simple-pdf/assets/simplepdf-github-white.png?">
    <img src="https://cdn.simplepdf.com/simple-pdf/assets/simplepdf-github.png?" width="280" alt="Logo"/>
  </picture>
  </a>
</div>
<br/>
<div align="center">
Add a powerful PDF editor directly into your website or React App.
</div>
</br>
<div align="center">
  <a href="https://github.com/SimplePDF/simplepdf-embed/blob/main/LICENSE.md">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="SimplePDF embed is released under the MIT license." />
  </a>
  <a href="https://twitter.com/intent/tweet?text=Add+a+powerful+PDF+editor+directly+into+your+website+or+React+App!&url=https://simplepdf.com/embed">
    <img src="https://img.shields.io/twitter/url/http/shields.io.svg?style=social" alt="Tweet" />
  </a>
</div>
</br>
</br>
<p align="center">
<br />
<a href="https://simplepdf.com/embed" rel="dofollow"><strong>Read more about SimplePDF Embed »</strong></a>
<br />
<br/>
<a href="https://discord.gg/n6M8jb5GEP">Join Our Discord</a>
  ·
<a href="https://twitter.com/simple_pdf">Follow us on Twitter</a>
</p>

<div align="center">
  <h1><a href="https://simplePDF.github.io" target="_blank">🔗 Try SimplePDF Embed</a></h1>
</div>

https://github.com/SimplePDF/simplepdf-embed/assets/10613140/8924f018-6076-4e44-9ae5-eedf9a740bb1

# Features

- Client-based: the document and data filled in does not leave the browser
- Add text, checkboxes, pictures, signatures to PDF documents
- Add, remove, re-arrange, rotate pages
- Automatic detection of pre-existing PDF fields

# Get started

[⚛️ Using the `EmbedPDF` React component](./react/README.md)

[🚀 Using a script tag](./web/README.md)

[🛠 Using the Iframe](./documentation/IFRAME.md)

# Why SimplePDF Embed?

- Fully-fledged PDF viewer & PDF form editor with a simple wrapper
- Completely free to use
- Insanely small footprint ([1.5KB gzipped](https://bundlephobia.com/package/@simplepdf/react-embed-pdf))

# FAQ

### This seems too good to be true, is it free?

Yes! The embed editor is and will remain free, it comes with a branding ("Powered by SimplePDF") that can be replaced (or removed) with your own logo under the [Premium Plan](https://www.simplepdf.com/pricing)

### What happens to the document my users load and the data they fill in?

**For the default editor (`companyIdentifier` is not specified):**
It stays in their browser! The document(s) that they load and the data they fill in never leaves their computer: [SimplePDF privacy policy](https://simplepdf.com/privacy_policy#what-data-we-dont-collect).

**For company editors (`companyIdentifier` is specified):**
The users are notified that the document and the data they submit is sent to the server. This is part of the `paid` offering of SimplePDF: allowing to automate form submissions.

### How come the library is so small?

The library is a simple wrapper around an Iframe that loads SimplePDF on-demand (whenever the user clicks the wrapped link), as such the footprint for this "opening an Iframe" mechanism is very tiny, the SimplePDF editor is of course bigger, but your users won't download anything until they have clicked the link. Think "lazy-loading".
