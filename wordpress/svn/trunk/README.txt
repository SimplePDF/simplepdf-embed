=== SimplePDF Embed ===
Contributors:      bendersej
Tags:              pdf, embed pdf, fill & sign PDF, pdf editor
Tested up to:      6.7.1
Stable tag:        1.1.2
License:           GPLv2 or later
License URI:       https://www.gnu.org/licenses/gpl-2.0.html
Requires at least: 5.8
Requires PHP:      5.6.20

Your visitors can fill & sign PDFs without leaving your website.

== Description ==

A lightweight plugin that automatically opens any PDF file with SimplePDF: allowing your visitors to fill and edit PDFs (merge, rotate, delete pages) without leaving your website.

== Try it out! ==

https://wordpress.simplepdf.co/

== Features ==
- Any .pdf link on your website is automatically opened with SimplePDF
- Add text, checkboxes, pictures, signatures to PDFs
- Fill fillable form
- Add, delete, rotate, merge PDFs
- Download the resulting PDF
- Works on all browsers and mobile devices
- Works with both Gutenber and the classic editor
- Fully responsive

== Screenshots ==

1. SimplePDF Embed
2. Admin settings of SimplePDF Embed
3. Adding a PDF link using the Gutenber editor
4. Adding a PDF link using the classic editor
5. The PDF is opened on top of the existing website

== Installation ==

This section describes how to install the plugin and get it working.

e.g.

1. Install using the WordPress built-in Plugin installer, or Extract the zip file and drop the contents in the wp-content/plugins/ directory of your WordPress installation.
2. Activate the plugin through the ‘Plugins’ menu in WordPress.
3. Optional: Go to Settings > SimplePDF Embed and enter your "Company Identifier" (requires a SimplePDF account)
4. Now any PDF links in your wordpress pages are opened using SimplePDF (you can disable this behaviour in the settings: see 3.)

== Frequently Asked Questions ==
= I have installed the plugin: what should I do next? =

All the existing PDF files will now open with SimplePDF.

If you wish to add new PDFs to your website, simply upload them to your Wordpress, copy the link and add it as a link to any page or paragraph in your wordpress.

= The PDF is not opened with SimplePDF =

Make sure that the link ends with ".pdf".

Example: https://wordpress.simplepdf.co/wp-content/uploads/2024/01/example_wordpress.pdf

= Do I need a SimplePDF account to use this plugin? =

No: the plugin does not require an account to work: all features are available without any account.

= What are the differences between using the plugin without and with a SimplePDF account? =

Without an account, the plugin will open the PDF editor allowing your visitors to fill in documents and download them.

With an account, the filled in documents will be automatically transmitted to you. You can configure to receive email notifications as well as use your own logo and loading animation.

= Where should I submit my feature request or bug report? =

Feel free to reach out to us at wordpress@simplepdf.com!

= Where can I see the code? =

Our Github repository contains both the code for the Wordpress plugin as well as the underlying @simplepdf/web-embed-pdf code upon which it relies:
- [Wordpress plugin source code](https://github.com/SimplePDF/simplepdf-embed/tree/main/wordpress)
- [@simplepdf/web-embed-pdf](https://github.com/SimplePDF/simplepdf-embed/tree/main/web)

== Changelog ==

= 1.0.0 =
* Initial release
= 1.1.0 =
* Add support for SimplePDF form links
= 1.1.1 =
* Move to SimplePDF.com (from SimplePDF.eu)
= 1.1.2 =
* Plugin tested with the latest wordpress version (6.7.1)

