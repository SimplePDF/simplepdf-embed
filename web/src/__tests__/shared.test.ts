import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { getSimplePDFElements, isSimplePDFLink, deriveTrustedOrigin } from '../shared';

describe('isSimplePDFLink', () => {
  describe('default domain', () => {
    it.each([
      { url: 'https://company.simplepdf.com/documents/abc123', expected: true, description: 'documents URL' },
      { url: 'https://company.simplepdf.com/form/abc123', expected: true, description: 'form URL' },
      { url: 'https://company.simplepdf.com/fr/documents/abc123', expected: true, description: 'documents URL with locale' },
      { url: 'https://company.simplepdf.com/en/form/abc123', expected: true, description: 'form URL with locale' },
      { url: 'https://other.simplepdf.com/documents/xyz', expected: true, description: 'different subdomain' },
      { url: 'https://company.simplepdf.com/documents/abc123?page=3', expected: true, description: 'documents URL with page param' },
      { url: 'https://company.simplepdf.com/form/abc123?page=5', expected: true, description: 'form URL with page param' },
      { url: 'http://company.simplepdf.com/documents/abc123', expected: true, description: 'http protocol' },
      { url: 'https://example.com/documents/abc123', expected: false, description: 'non-simplepdf domain' },
      { url: 'https://company.simplepdf.com/editor', expected: false, description: 'editor URL' },
      { url: 'https://company.simplepdf.com/file.pdf', expected: false, description: 'PDF file on simplepdf domain' },
      { url: 'https://company.simplepdf.com/documents/', expected: false, description: 'documents path without ID' },
      { url: 'not-a-url', expected: false, description: 'invalid URL' },
    ])('returns $expected for $description', ({ url, expected }) => {
      expect(isSimplePDFLink({ url })).toBe(expected);
    });
  });

  describe('custom baseDomain', () => {
    it.each([
      { url: 'https://company.custom.com/documents/abc123', baseDomain: 'custom.com', expected: true, description: 'custom domain documents URL' },
      { url: 'http://e2e.simplepdf.nil:3000/documents/abc123', baseDomain: 'simplepdf.nil:3000', expected: true, description: 'local dev with port' },
      { url: 'http://e2e.simplepdf.nil:3000/fr/form/abc123', baseDomain: 'simplepdf.nil:3000', expected: true, description: 'local dev with locale and form' },
      { url: 'https://company.simplepdf.com/documents/abc123', baseDomain: 'custom.com', expected: false, description: 'simplepdf URL with custom domain configured' },
    ])('returns $expected for $description', ({ url, baseDomain, expected }) => {
      expect(isSimplePDFLink({ url, baseDomain })).toBe(expected);
    });
  });
});

describe('deriveTrustedOrigin', () => {
  it('uses iframe src origin when available', () => {
    expect(
      deriveTrustedOrigin({
        iframeSrc: 'https://other.simplepdf.com/documents/abc123',
        fallbackDomain: 'https://embed.simplepdf.com',
      }),
    ).toBe('https://other.simplepdf.com');
  });

  it('falls back to configured domain when iframe src is undefined', () => {
    expect(
      deriveTrustedOrigin({
        iframeSrc: undefined,
        fallbackDomain: 'https://embed.simplepdf.com',
      }),
    ).toBe('https://embed.simplepdf.com');
  });

  it('strips path and query from iframe src', () => {
    expect(
      deriveTrustedOrigin({
        iframeSrc: 'https://company.simplepdf.com/fr/documents/abc123?page=3',
        fallbackDomain: 'https://embed.simplepdf.com',
      }),
    ).toBe('https://company.simplepdf.com');
  });
});

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
});
