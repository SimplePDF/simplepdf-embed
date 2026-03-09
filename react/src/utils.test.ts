import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildEditorDomain, encodeContext, buildEditorURL, extractDocumentName, generateRandomID, isSimplePDFDocumentURL } from './utils';

describe(generateRandomID.name, () => {
  it('generates unique IDs with timestamp_randomstring format', () => {
    const before = Date.now();
    const ids = Array.from({ length: 100 }, () => generateRandomID());
    const after = Date.now();

    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(100);

    ids.forEach((id) => {
      expect(id).toMatch(/^\d+_[a-z0-9]+$/);
      const timestamp = parseInt(id.split('_')[0] ?? '0', 10);
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });
  });
});

describe(buildEditorDomain.name, () => {
  it.each([
    {
      baseDomain: undefined,
      companyIdentifier: undefined,
      expected: 'https://react-editor.simplepdf.com',
      description: 'uses defaults when nothing provided',
    },
    {
      baseDomain: 'custom.com',
      companyIdentifier: undefined,
      expected: 'https://react-editor.custom.com',
      description: 'uses provided baseDomain with default subdomain',
    },
    {
      baseDomain: undefined,
      companyIdentifier: 'mycompany',
      expected: 'https://mycompany.simplepdf.com',
      description: 'uses provided companyIdentifier with default domain',
    },
    {
      baseDomain: 'custom.com',
      companyIdentifier: 'mycompany',
      expected: 'https://mycompany.custom.com',
      description: 'uses both when provided',
    },
    {
      baseDomain: 'simplepdf.nil:3000',
      companyIdentifier: 'e2e',
      expected: 'http://e2e.simplepdf.nil:3000',
      description: 'uses http for .nil domains (local dev)',
    },
    {
      baseDomain: 'localhost:3000',
      companyIdentifier: 'test',
      expected: 'http://test.localhost:3000',
      description: 'uses http for localhost',
    },
    {
      baseDomain: 'simplepdf.com',
      companyIdentifier: 'company',
      expected: 'https://company.simplepdf.com',
      description: 'uses https for production domains',
    },
  ])('$description', ({ baseDomain, companyIdentifier, expected }) => {
    expect(buildEditorDomain({ baseDomain, companyIdentifier })).toBe(expected);
  });
});

describe(encodeContext.name, () => {
  it('returns null when context is undefined', () => {
    expect(encodeContext(undefined)).toBeNull();
  });

  it.each([
    { context: {}, description: 'empty object' },
    { context: { key: 'value' }, description: 'simple object' },
    { context: { user: { id: 123, name: 'Test' }, tags: ['a', 'b'] }, description: 'nested object' },
    { context: { message: 'Hello & goodbye! <script>' }, description: 'special characters' },
  ])('encodes and decodes $description correctly', ({ context }) => {
    const result = encodeContext(context);

    expect(result).not.toBeNull();
    if (result === null) {
      throw new Error('Expected result to be non-null');
    }
    const decoded = JSON.parse(atob(decodeURIComponent(result)));
    expect(decoded).toEqual(context);
  });

  describe('error handling', () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it.each([
      { context: { emoji: '🎉' }, description: 'unicode characters (btoa limitation)' },
      {
        context: (() => {
          const c: Record<string, unknown> = { a: 1 };
          c['self'] = c;
          return c;
        })(),
        description: 'circular references',
      },
    ])('returns null and logs error for $description', ({ context }) => {
      expect(encodeContext(context)).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });
});

describe(isSimplePDFDocumentURL.name, () => {
  describe('default domain', () => {
    it.each([
      { url: 'https://company.simplepdf.com/documents/abc123', expected: true, description: 'documents URL' },
      { url: 'https://company.simplepdf.com/form/abc123', expected: true, description: 'form URL' },
      { url: 'https://company.simplepdf.com/fr/documents/abc123', expected: true, description: 'documents URL with locale' },
      { url: 'https://company.simplepdf.com/en/form/abc123', expected: true, description: 'form URL with locale' },
      { url: 'https://other.simplepdf.com/documents/xyz', expected: true, description: 'different subdomain' },
      { url: 'https://example.com/documents/abc123', expected: false, description: 'non-simplepdf domain' },
      { url: 'https://company.simplepdf.com/editor', expected: false, description: 'editor URL (no documents/form)' },
      { url: 'https://company.simplepdf.com/file.pdf', expected: false, description: 'PDF file on simplepdf domain' },
      { url: 'https://company.simplepdf.com/documents/abc123?page=3', expected: true, description: 'documents URL with page param' },
      { url: 'https://company.simplepdf.com/form/abc123?page=5', expected: true, description: 'form URL with page param' },
      { url: 'https://company.simplepdf.com/documents/', expected: false, description: 'documents path without ID' },
      { url: 'not-a-url', expected: false, description: 'invalid URL' },
    ])('returns $expected for $description', ({ url, expected }) => {
      expect(isSimplePDFDocumentURL({ url, baseDomain: undefined })).toBe(expected);
    });
  });

  describe('custom baseDomain', () => {
    it.each([
      { url: 'https://company.custom.com/documents/abc123', baseDomain: 'custom.com', expected: true, description: 'custom domain documents URL' },
      { url: 'http://e2e.simplepdf.nil:3000/documents/abc123', baseDomain: 'simplepdf.nil:3000', expected: true, description: 'local dev with port' },
      { url: 'http://e2e.simplepdf.nil:3000/fr/form/abc123', baseDomain: 'simplepdf.nil:3000', expected: true, description: 'local dev with locale and form' },
      { url: 'https://company.simplepdf.com/documents/abc123', baseDomain: 'custom.com', expected: false, description: 'simplepdf URL with custom domain configured' },
    ])('returns $expected for $description', ({ url, baseDomain, expected }) => {
      expect(isSimplePDFDocumentURL({ url, baseDomain })).toBe(expected);
    });
  });
});

describe(buildEditorURL.name, () => {
  const defaults = {
    editorDomain: 'https://company.simplepdf.com',
    locale: undefined,
    encodedContext: null,
    document: null,
  } as const;

  it.each([
    {
      params: defaults,
      expectedPath: '/en/editor',
      expectedParams: {},
      description: 'basic URL with default locale',
    },
    {
      params: { ...defaults, locale: 'fr' as const },
      expectedPath: '/fr/editor',
      expectedParams: {},
      description: 'uses provided locale',
    },
    {
      params: { ...defaults, encodedContext: 'abc123' },
      expectedPath: '/en/editor',
      expectedParams: { context: 'abc123' },
      description: 'adds context query param',
    },
    {
      params: {
        ...defaults,
        document: { type: 'external' as const, url: 'https://example.com/doc.pdf', corsProxyFallbackUrl: null },
      },
      expectedPath: '/en/editor',
      expectedParams: { loadingPlaceholder: 'true' },
      description: 'adds loadingPlaceholder for external document',
    },
    {
      params: {
        ...defaults,
        document: {
          type: 'external' as const,
          url: 'https://example.com/doc.pdf',
          corsProxyFallbackUrl: 'https://example.com/doc.pdf',
        },
      },
      expectedPath: '/en/editor',
      expectedParams: { loadingPlaceholder: 'true', open: 'https://example.com/doc.pdf' },
      description: 'adds open param for CORS fallback',
    },
    {
      params: {
        editorDomain: 'https://test.simplepdf.com',
        locale: 'de' as const,
        encodedContext: 'ctx123',
        document: {
          type: 'external' as const,
          url: 'https://example.com/file.pdf',
          corsProxyFallbackUrl: 'https://example.com/file.pdf',
        },
      },
      expectedPath: '/de/editor',
      expectedParams: { context: 'ctx123', loadingPlaceholder: 'true', open: 'https://example.com/file.pdf' },
      description: 'combines all query params',
    },
    {
      params: { ...defaults, editorDomain: 'http://e2e.simplepdf.nil:3000' },
      expectedPath: '/en/editor',
      expectedParams: {},
      description: 'handles local dev domain',
    },
  ])('$description', ({ params, expectedPath, expectedParams }) => {
    const result = buildEditorURL(params);
    const url = new URL(result);

    expect(url.pathname).toBe(expectedPath);
    Object.entries(expectedParams).forEach(([key, value]) => {
      expect(url.searchParams.get(key)).toBe(value);
    });
    const expectedParamCount = Object.keys(expectedParams).length;
    expect([...url.searchParams.keys()].length).toBe(expectedParamCount);
  });

  describe('SimplePDF document', () => {
    it('returns the SimplePDF document URL directly', () => {
      const result = buildEditorURL({
        ...defaults,
        document: { type: 'simplepdf', url: 'https://company.simplepdf.com/documents/abc123' },
      });
      expect(result).toBe('https://company.simplepdf.com/documents/abc123');
    });

    it('appends context to the SimplePDF document URL', () => {
      const result = buildEditorURL({
        ...defaults,
        encodedContext: 'ctx123',
        document: { type: 'simplepdf', url: 'https://company.simplepdf.com/documents/abc123' },
      });
      const url = new URL(result);
      expect(url.origin).toBe('https://company.simplepdf.com');
      expect(url.pathname).toBe('/documents/abc123');
      expect(url.searchParams.get('context')).toBe('ctx123');
    });

    it('preserves existing query params like page', () => {
      const result = buildEditorURL({
        ...defaults,
        document: { type: 'simplepdf', url: 'https://company.simplepdf.com/documents/abc123?page=3' },
      });
      const url = new URL(result);
      expect(url.pathname).toBe('/documents/abc123');
      expect(url.searchParams.get('page')).toBe('3');
    });

    it('preserves page param alongside context', () => {
      const result = buildEditorURL({
        ...defaults,
        encodedContext: 'ctx123',
        document: { type: 'simplepdf', url: 'https://company.simplepdf.com/documents/abc123?page=5' },
      });
      const url = new URL(result);
      expect(url.searchParams.get('page')).toBe('5');
      expect(url.searchParams.get('context')).toBe('ctx123');
    });

    it('does not add loadingPlaceholder or open params', () => {
      const result = buildEditorURL({
        ...defaults,
        document: { type: 'simplepdf', url: 'https://company.simplepdf.com/documents/abc123' },
      });
      const url = new URL(result);
      expect(url.searchParams.get('loadingPlaceholder')).toBeNull();
      expect(url.searchParams.get('open')).toBeNull();
    });
  });
});

describe(extractDocumentName.name, () => {
  it.each([
    { url: 'https://example.com/document.pdf', expected: 'document.pdf', description: 'simple URL' },
    { url: 'https://example.com/path/to/file.pdf', expected: 'file.pdf', description: 'URL with path segments' },
    { url: 'https://example.com/doc.pdf?token=abc&v=1', expected: 'doc.pdf', description: 'strips query parameters' },
    { url: 'https://example.com/', expected: '', description: 'URL with trailing slash' },
    { url: 'https://example.com', expected: 'example.com', description: 'URL without path' },
    { url: 'https://example.com/my%20document.pdf', expected: 'my%20document.pdf', description: 'encoded characters' },
    {
      url: 'https://example.com/doc-v1.2_final.pdf',
      expected: 'doc-v1.2_final.pdf',
      description: 'special characters',
    },
    { url: '', expected: '', description: 'empty string' },
  ])('extracts "$expected" from $description', ({ url, expected }) => {
    expect(extractDocumentName(url)).toBe(expected);
  });
});
