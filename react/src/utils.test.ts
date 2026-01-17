import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildEditorDomain, encodeContext, buildEditorURL, extractDocumentName, generateRandomID } from './utils';

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

describe(buildEditorURL.name, () => {
  const defaults = {
    editorDomain: 'https://company.simplepdf.com',
    locale: undefined,
    encodedContext: null,
    hasDocumentUrl: false,
    corsProxyFallbackUrl: null,
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
      params: { ...defaults, hasDocumentUrl: true },
      expectedPath: '/en/editor',
      expectedParams: { loadingPlaceholder: 'true' },
      description: 'adds loadingPlaceholder when hasDocumentUrl',
    },
    {
      params: { ...defaults, corsProxyFallbackUrl: 'https://example.com/doc.pdf' },
      expectedPath: '/en/editor',
      expectedParams: { open: 'https://example.com/doc.pdf' },
      description: 'adds open param for CORS fallback',
    },
    {
      params: {
        editorDomain: 'https://test.simplepdf.com',
        locale: 'de' as const,
        encodedContext: 'ctx123',
        hasDocumentUrl: true,
        corsProxyFallbackUrl: 'https://example.com/file.pdf',
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
