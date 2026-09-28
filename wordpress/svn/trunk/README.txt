=== SimplePDF Embed ===
Contributors:      bendersej
Tags:              pdf, pdf form, fill pdf, sign pdf, form submissions
Tested up to:      7.1.2
Stable tag:        1.2.0
License:           GPLv2 or later
License URI:       https://www.gnu.org/licenses/gpl-2.0.html
Requires at least: 5.8
Requires PHP:      5.6.20

Visitors fill and sign your PDFs right on your site. With a SimplePDF account, every filled PDF comes back to you, automatically.

== Description ==

You put a PDF form on your site. Visitors download it, print it, fill it, scan it and email it back, if they remember. Then you retype the answers.

SimplePDF Embed turns every PDF link on your site into a form your visitors fill and sign right on the page. Nothing to rebuild: link a PDF the way you always have.

**Get every filled PDF back, automatically**

With a SimplePDF account, visitors click Submit and the filled PDF lands in your dashboard. No chasing.

* Email alerts on every submission
* Webhooks to send filled PDFs to your own systems
* Export the form data to CSV or Excel
* Required fields, so forms come back complete
* Your logo in the editor (Pro and above)
* Filled PDFs saved to your own storage (S3 or Azure Blob Storage on Pro, SharePoint on Premium)

Every plan starts with a 7-day free trial: [see the plans](https://simplepdf.com/pricing?ref=wordpress).

**Free, without an account**

Visitors fill and sign your PDFs, then download them. The document is filled in their browser.

**Works the way your site already works**

* Every PDF link opens in SimplePDF by default, whatever the extension case (`Consent.PDF`) or query string (`form.pdf?ver=2`)
* Or limit it to the pages and posts you pick, and try it on a draft before going live
* The settings page lists the PDF links on your pages and posts, and where each one opens
* Add the `exclude-simplepdf` class to a link to keep the browser's own PDF viewer
* Visitors who browse with an AI assistant (ChatGPT's browser, Chrome with WebMCP) can ask it to fill the form for them, and check every answer before they submit. One checkbox turns it off.

**The settings page**

See every PDF link on your pages and posts, and where each one opens:

![The PDF links on your site and where each one opens](https://cdn.simplepdf.com/simple-pdf/assets/wordpress/plugin-settings-pdf-links.png)

Try it on one page before going live, and choose whether AI assistants can fill your forms:

![Where it runs: everywhere, or only on the pages and posts you pick](https://cdn.simplepdf.com/simple-pdf/assets/wordpress/plugin-settings-where-it-runs-v2.png)

See what an account adds before you sign up:

![Today versus with a SimplePDF account](https://cdn.simplepdf.com/simple-pdf/assets/wordpress/plugin-settings-account-pitch-v3.png)

**What visitors can do in the editor**

* Fill fillable forms, or add text, checkboxes, pictures and signatures to any PDF
* Add, delete, rotate and merge pages
* Works on desktop and mobile, in every modern browser
* Works with the block editor and the classic editor

== Try it out ==

https://wordpress.simplepdf.co/

== Screenshots ==

1. Filled PDFs land in your SimplePDF dashboard
2. The settings page: the PDF links on your site and where each one opens
3. Adding a PDF link using the block editor
4. Adding a PDF link using the classic editor
5. The PDF opens on top of your page

== Installation ==

1. Install the plugin from Plugins > Add New, or upload the zip file to `wp-content/plugins/`.
2. Activate it from the Plugins menu.
3. Go to Settings > SimplePDF Embed: it lists the PDF links on your site and where each one opens.
4. Optional: to get the filled PDFs back, enter your company identifier (for `acme.simplepdf.com`, enter `acme`).

== Frequently Asked Questions ==

= What changes with a SimplePDF account? =

Without an account, visitors fill your PDF and download it. It is then up to them to send it to you.

With an account, they click Submit and the filled PDF lands in your dashboard, with an email alert or a webhook if you want one. You can export the answers to CSV or Excel, make fields required, and add your logo. [See the plans](https://simplepdf.com/pricing?ref=wordpress).

= Where do the filled PDFs go? =

Without an account, the visitor downloads the filled PDF: it is not sent to SimplePDF.

With an account, submitted PDFs are stored in your SimplePDF dashboard, or in your own storage (S3, Azure Blob Storage or SharePoint) on the plans that include it.

= Do I need a SimplePDF account? =

No. Visitors can fill, sign and download PDFs without one. An account is what brings the filled PDFs back to you.

= Can I try it on one page first? =

Yes. In Settings > SimplePDF Embed, set "Where it runs" to "Only on pages and posts I pick" and pick a draft or private page. Every other PDF link keeps opening in the browser.

= I installed the plugin: what next? =

Every PDF link on your site now opens in SimplePDF. Open Settings > SimplePDF Embed to see which pages link a PDF and where each link opens. To add a new form, upload the PDF to your Media Library and link to it from any page or post.

= A PDF link does not open in SimplePDF =

Settings > SimplePDF Embed lists the PDF links on your pages and posts, with the reason next to any link that opens in the browser. The usual causes:

* The link does not point to a `.pdf` file
* The link has the `exclude-simplepdf` class
* The page is not picked in "Where it runs"

Links added by a page builder, a menu or a widget open the same way but are not listed.

= How do I keep one PDF in the browser's viewer? =

Add the `exclude-simplepdf` class to that link.

= Can AI assistants fill my forms? =

Yes, when a visitor browses with one (ChatGPT's browser, Chrome with WebMCP). The assistant fills the form in the editor on your page, where the visitor checks every answer, and required and read-only fields still apply. To turn it off, untick "Give AI assistants direct access to your forms" in Settings > SimplePDF Embed. Assistants that click and type like a person can still fill your forms, as on any website.

= Where do I send a feature request or a bug report? =

Email us at wordpress@simplepdf.com.

= Where can I see the code? =

The plugin and the script it bundles are open source:

* [WordPress plugin](https://github.com/SimplePDF/simplepdf-embed/tree/main/wordpress)
* [@simplepdf/web-embed-pdf](https://github.com/SimplePDF/simplepdf-embed/tree/main/web)

== External services ==

This plugin connects to SimplePDF (https://simplepdf.com) in two ways.

**The PDF editor.** When a visitor clicks a PDF link, the plugin opens the SimplePDF editor from `https://<your company identifier>.simplepdf.com` (`wordpress.simplepdf.com` without an account) in a frame on your page. The visitor's browser loads the PDF and hands it to the editor (or passes the PDF's address when it cannot load it), and the PDF is filled in the browser. When the visitor submits a filled PDF to your SimplePDF account, the filled PDF is sent to SimplePDF, or to your own storage if you set one up. Nothing is sent before a visitor clicks a PDF link.

**The account check.** On the plugin's settings page only, the plugin sends one request to `https://<your company identifier>.simplepdf.com` to check that the account exists. It sends the plugin's version and nothing about your site or your visitors, and the result is cached for up to an hour.

* [Terms of service](https://simplepdf.com/terms-of-service)
* [Privacy policy](https://simplepdf.com/privacy-policy)

== Changelog ==

= 1.2.0 =
* New settings page: see every PDF link on your pages and posts, and where each one opens
* Choose where it runs: everywhere, or only on the pages and posts you pick, drafts included
* Your company identifier is checked, so a typo shows up right away
* PDF links open in SimplePDF whatever the extension case (`Consent.PDF`), query string or `#page` fragment
* AI assistants in your visitors' browser can now fill your forms (WebMCP). This is on after the update: to turn it off, untick "Give AI assistants direct access to your forms" in Settings > SimplePDF Embed
* Uninstalling the plugin removes its settings
* Update web-embed-pdf to 1.9.0
* Plugin tested with the latest WordPress version (7.1.2)

= 1.1.3 =
* Update web-embed-pdf to 1.8.4
* Plugin tested with the latest WordPress version (6.9.4)

= 1.1.2 =
* Plugin tested with the latest WordPress version (6.7.1)

= 1.1.1 =
* Move to SimplePDF.com (from SimplePDF.eu)

= 1.1.0 =
* Add support for SimplePDF form links

= 1.0.0 =
* Initial release
