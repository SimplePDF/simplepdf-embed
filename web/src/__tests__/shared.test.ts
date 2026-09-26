import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { getSimplePDFElements } from '../shared';
import pdfLinkCases from './fixtures/pdf-link-cases.json';

// The link cases live in a fixture so the WordPress plugin's PHP mirror of this rule (its
// "PDFs on your site" report) can assert the same file.
describe('getSimplePDFElements', () => {
  it('opens exactly the links the shared cases expect in SimplePDF', () => {
    const anchors = pdfLinkCases
      .map(({ href, classes }, index) => `<a href="${href}" class="${classes.join(' ')}">case ${index}</a>`)
      .join('');
    const dom = new JSDOM(`<!doctype html><html><body>${anchors}</body></html>`, { url: 'http://localhost' });

    const detectedCases = getSimplePDFElements(dom.window.document).map(({ innerHTML }) => innerHTML);
    const expectedCases = pdfLinkCases.flatMap(({ opens_in_simplepdf }, index) =>
      opens_in_simplepdf ? [`case ${index}`] : [],
    );

    expect(detectedCases).toStrictEqual(expectedCases);
  });

  it('opens a non-link element with the simplepdf class', () => {
    const dom = new JSDOM(
      `<!doctype html><html><body><button class="simplepdf">Button with class</button><span>Plain text</span></body></html>`,
      { url: 'http://localhost' },
    );

    expect(getSimplePDFElements(dom.window.document).map(({ innerHTML }) => innerHTML)).toStrictEqual([
      'Button with class',
    ]);
  });
});
