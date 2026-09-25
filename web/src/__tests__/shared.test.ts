import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { getSimplePDFElements } from '../shared';

describe('getSimplePDFElements', () => {
  it('detects elements to open with SimplePDF', () => {
    const dom = new JSDOM(
      `<!doctype html>
      <html>
      <body>
        <!--Should detect below-->
        <a href="https://pdfobject.com/pdf/sample-3pp.pdf">PDF link</a>
        <a href="https://example.com/some-pdf-without-extension" class="simplepdf">Regular link with class</a>
        <button class="simplepdf">Button with class</button>
        <a href="https://yourcompany.simplepdf.com/form/d8d57ec7-f3e9-4fc9-8cc5-4a92c02d30d0">SimplePDF form link</a>
        <a href="https://yourcompany.simplepdf.com/documents/d8d57ec7-f3e9-4fc9-8cc5-4a92c02d30d0">SimplePDF document link</a>
        <!--Should NOT detect below-->
        <a href="https://pdfobject.com/pdf/sample-3pp.pdf" class="exclude-simplepdf">PDF link with class exclusion</a>
        <a href="https://yourcompany.simplepdf.com/form/d8d57ec7-f3e9-4fc9-8cc5-4a92c02d30d0" class="exclude-simplepdf">SimplePDF form link with exclusion</a>
        <a href="https://www.pdfsomething.com/anything">Regular link containing .pdf</a>
        <a href="https://www.website.com/some-pdf">Should not be opened with SimplePDF</a>
        <a href="https://www.website.com/some-other.pdf.png">Should not be opened with SimplePDF</a>
        <a href="https://www.simplepdf.app/s/article/How-to-Manage-PDF-Settings">Should not be opened with SimplePDF</a>
        <a href="https://www.app.pdf/some-url">Should not be opened with SimplePDF</a>
      </body>
      </html>
    `,
      { url: 'http://localhost' },
    );
    const detectedElements = getSimplePDFElements(dom.window.document);
    expect(detectedElements).toHaveLength(5);
    expect(detectedElements.map(({ innerHTML }) => innerHTML)).toStrictEqual(
      expect.arrayContaining([
        'Button with class',
        'PDF link',
        'Regular link with class',
        'SimplePDF form link',
        'SimplePDF document link',
      ]),
    );
  });

  it('detects PDF links whatever the extension case, query string or fragment', () => {
    const dom = new JSDOM(
      `<!doctype html>
      <html>
      <body>
        <a href="https://example.com/files/Consent.PDF">Uppercase extension</a>
        <a href="/wp-content/uploads/intake-form.pdf?ver=2">Query string</a>
        <a href="https://example.com/files/guide.pdf#page=3">Fragment</a>
        <a href="https://example.com/download.php?file=Form.PDF">PDF name in the query</a>
        <a href="https://example.com/files/report.pdf.png">Image named after a PDF</a>
      </body>
      </html>
    `,
      { url: 'http://localhost' },
    );
    const detectedElements = getSimplePDFElements(dom.window.document);
    expect(detectedElements.map(({ innerHTML }) => innerHTML)).toStrictEqual([
      'Uppercase extension',
      'Query string',
      'Fragment',
      'PDF name in the query',
    ]);
  });
});
