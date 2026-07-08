import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildEditorDomain, buildEditorURL, createEmbed, EmbedConfigError, encodeContext } from '../src/mount'
import type { Embed } from '../src/types'

// Recover the document URL from ?open= the same way the editor does. Kept here so this test pins the
// CONTRACT both sides rely on - the SDK builds the ?open value and the editor reads it back - not just
// the SDK half.
const recoverDocumentUrlFromOpen = (requestUrl: string): string | null => {
  const queryStart = requestUrl.indexOf('?')
  if (queryStart === -1) return null
  const match = requestUrl.slice(queryStart + 1).match(/(?:^|&)open=(.*)$/)
  if (match === null) return null
  const rawOpenValue = match[1]
  const firstSegment = rawOpenValue.split('&')[0]
  const decode = (value: string): string => {
    try {
      return decodeURIComponent(value)
    } catch {
      return value
    }
  }
  // No raw ? in the value: it is a single query param, so a + is an encoded space. A raw ? means the
  // URL carries its own query, which is kept verbatim.
  const documentUrl = firstSegment.includes('?') ? decode(rawOpenValue) : decode(firstSegment.replace(/\+/g, ' '))
  return documentUrl === '' ? null : documentUrl
}

describe(buildEditorURL.name, () => {
  const openFallbackRoundTrip = (documentUrl: string): string | null => {
    const editorUrl = buildEditorURL({
      editorOrigin: 'https://acme.simplepdf.com',
      locale: undefined,
      encodedContext: null,
      hasDocumentUrl: false,
      openFallbackUrl: documentUrl,
    })
    const { pathname, search } = new URL(editorUrl)
    return recoverDocumentUrlFromOpen(`${pathname}${search}`)
  }

  it.each([
    'https://cdn.example.com/report.pdf',
    // A space in the consumer's URL is encoded as + by URLSearchParams; the editor must restore it.
    'https://cdn.example.com/my file.pdf',
    // A literal + is encoded as %2B (not +), so it survives as a literal +.
    'https://cdn.example.com/a+b.pdf',
    // The document URL carries its own query - the whole thing is percent-encoded, so it round-trips.
    'https://gen.example.com/doc?id=7&v=2',
    // A base64 ?context= (contains a literal +) in the document's OWN query.
    'https://gen.example.com/doc?context=eyJjdXN0b21lcklkIjoiY3VzXzlmMyIsImNpdHkiOiLQnNC+0YHQutCy0LAifQ==',
  ])('the ?open fallback URL round-trips through the editor parser: %s', (documentUrl) => {
    expect(openFallbackRoundTrip(documentUrl)).toBe(documentUrl)
  })

  it('encodes context so the editor decodes it back to the original object', () => {
    const context = { customerId: 'cus_9f3', ref: 'invoice-42' }
    const editorUrl = buildEditorURL({
      editorOrigin: 'https://acme.simplepdf.com',
      locale: undefined,
      encodedContext: encodeContext(context),
      hasDocumentUrl: false,
      openFallbackUrl: 'https://cdn.example.com/f.pdf',
    })
    // The editor URL-decodes the context param once, then base64-decodes it back to the object.
    const contextParam = new URL(editorUrl).searchParams.get('context')
    expect(contextParam).not.toBeNull()
    expect(JSON.parse(atob(decodeURIComponent(contextParam ?? '')))).toEqual(context)
  })
})

describe(buildEditorDomain.name, () => {
  it('uses https for production base domains', () => {
    expect(buildEditorDomain({ companyIdentifier: 'acme', baseDomain: 'simplepdf.com' })).toBe('https://acme.simplepdf.com')
  })

  it('uses http for local/.nil base domains', () => {
    expect(buildEditorDomain({ companyIdentifier: 'acme', baseDomain: 'localhost:3000' })).toBe('http://acme.localhost:3000')
    expect(buildEditorDomain({ companyIdentifier: 'acme', baseDomain: 'acme.nil' })).toBe('http://acme.acme.nil')
  })
})

describe(encodeContext.name, () => {
  it('returns null for undefined context', () => {
    expect(encodeContext(undefined)).toBeNull()
  })

  it('base64-url-encodes a context object round-trip', () => {
    const encoded = encodeContext({ ref: 'abc', n: 1 })
    expect(encoded).not.toBeNull()
    const decoded = JSON.parse(atob(decodeURIComponent(encoded ?? '')))
    expect(decoded).toEqual({ ref: 'abc', n: 1 })
  })

  it('returns null (does not throw) on a non-Latin1 context (btoa limitation)', () => {
    expect(encodeContext({ name: 'café 😀 日本' })).toBeNull()
  })
})

describe(createEmbed.name, () => {
  const mounted: Embed[] = []

  afterEach(() => {
    for (const embed of mounted) {
      embed.lifecycle.dispose()
    }
    mounted.length = 0
    document.body.innerHTML = ''
  })

  // Defaults companyIdentifier so the document/target tests stay terse; pass companyIdentifier to override.
  const mount = (args: Omit<Parameters<typeof createEmbed>[0], 'companyIdentifier'> & { companyIdentifier?: string }): Embed => {
    const embed = createEmbed({ companyIdentifier: 'acme', ...args })
    mounted.push(embed)
    return embed
  }

  it('throws EmbedConfigError when the target selector matches nothing', () => {
    expect(() => mount({ target: '#missing' })).toThrow(EmbedConfigError)
  })

  it('throws EmbedConfigError for an invalid companyIdentifier', () => {
    document.body.innerHTML = '<div id="root"></div>'
    expect(() => mount({ target: '#root', companyIdentifier: 'Not A Label' })).toThrow(/DNS label/)
  })

  // Mount with a document source against a fresh root (most document tests only
  // care that construction does/doesn't throw synchronously).
  const mountWith = (doc: Parameters<typeof createEmbed>[0]['document']): Embed => {
    document.body.innerHTML = '<div id="root"></div>'
    return mount({ target: '#root', document: doc })
  }

  // --- Accepts (we don't gatekeep) -----------------------------------------

  it('accepts an http document url (mixed-content is the browser\'s gate, not ours)', () => {
    expect(() => mountWith({ url: 'http://example.com/a.pdf' })).not.toThrow()
  })

  it('accepts a credentialed document url (routes through the editor ?open loader)', () => {
    expect(() => mountWith({ url: 'https://user:pass@example.com/a.pdf' })).not.toThrow()
  })

  it('accepts a Blob via { file }', () => {
    const file = new File(['%PDF-1.4'], 'form.pdf', { type: 'application/pdf' })
    expect(() => mountWith({ file })).not.toThrow()
  })

  it('accepts a data URL via { dataUrl }', () => {
    expect(() => mountWith({ dataUrl: 'data:application/pdf;base64,AAAA' })).not.toThrow()
  })

  // --- Rejects with a message that names the right arm ----------------------

  it('rejects a non-http(s) url scheme', () => {
    expect(() => mountWith({ url: 'ftp://example.com/a.pdf' })).toThrow('http(s)')
  })

  it('tells you to use { file } when a Blob is passed to url', () => {
    const blob = new Blob(['%PDF-1.4'], { type: 'application/pdf' })
    // @ts-expect-error exercising the runtime guard for untyped JS callers
    expect(() => mountWith({ url: blob })).toThrow('document: { file }')
  })

  it('tells you to use { dataUrl } when a data URL is passed to url', () => {
    expect(() => mountWith({ url: 'data:application/pdf;base64,AAAA' })).toThrow('document: { dataUrl }')
  })

  it('tells you to use { file } when a blob: URL is passed to url', () => {
    expect(() => mountWith({ url: 'blob:https://example.com/abc' })).toThrow('document: { file }')
  })

  it('tells you to use a url/dataUrl when a string is passed to file', () => {
    // @ts-expect-error exercising the runtime guard for untyped JS callers
    expect(() => mountWith({ file: 'https://example.com/a.pdf' })).toThrow('document: { url }')
  })

  it('tells you to use { file } when a Blob is passed to dataUrl', () => {
    const blob = new Blob(['x'], { type: 'application/pdf' })
    // @ts-expect-error exercising the runtime guard for untyped JS callers
    expect(() => mountWith({ dataUrl: blob })).toThrow('document: { file }')
  })

  it('rejects a document with no source arm', () => {
    expect(() => mountWith({})).toThrow('exactly one source')
  })

  it('rejects a document with more than one source arm', () => {
    // @ts-expect-error exercising the runtime guard for untyped JS callers
    expect(() => mountWith({ url: 'https://x.com/a.pdf', dataUrl: 'data:application/pdf;base64,AAAA' })).toThrow(
      'exactly one source',
    )
  })

  it('accepts the reserved "embed" companyIdentifier (reserved-portal rejection is WEM-only)', () => {
    document.body.innerHTML = '<div id="root"></div>'
    expect(() => mount({ target: '#root', companyIdentifier: 'embed' })).not.toThrow()
  })

  it('mounts an iframe under the target with the locale + context in the URL', () => {
    document.body.innerHTML = '<div id="root"></div>'
    mount({ target: '#root', companyIdentifier: 'acme', locale: 'fr', context: { a: 1 } })
    const iframe = document.querySelector('#root iframe')
    if (!(iframe instanceof HTMLIFrameElement)) {
      throw new Error('expected an iframe under the target')
    }
    const src = new URL(iframe.src)
    expect(src.origin).toBe('https://acme.simplepdf.com')
    expect(src.pathname).toBe('/fr/editor')
    expect(src.searchParams.get('context')).not.toBeNull()
  })

  it('navigates straight to a SimplePDF documents URL (preserving its query, appending context, bridging to its own subdomain)', () => {
    document.body.innerHTML = '<div id="root"></div>'
    mount({
      target: '#root',
      companyIdentifier: 'acme',
      context: { a: 1 },
      document: { url: 'https://demo.simplepdf.com/documents/abc-123?prefill=p-9' },
    })
    const iframe = document.querySelector('#root iframe')
    if (!(iframe instanceof HTMLIFrameElement)) {
      throw new Error('expected an iframe under the target')
    }
    const src = new URL(iframe.src)
    // Bridges to the URL's own subdomain (demo), not the configured companyIdentifier (acme).
    expect(src.origin).toBe('https://demo.simplepdf.com')
    expect(src.pathname).toBe('/documents/abc-123')
    expect(src.searchParams.get('prefill')).toBe('p-9')
    expect(src.searchParams.get('context')).not.toBeNull()
    // It is a direct navigation, not the host-fetch /editor path.
    expect(src.searchParams.get('loadingPlaceholder')).toBeNull()
  })

  it('treats a /documents/ url off the base-domain family as a normal PDF url (builds /editor)', () => {
    document.body.innerHTML = '<div id="root"></div>'
    mount({ target: '#root', companyIdentifier: 'acme', document: { url: 'https://evil.com/documents/abc-123' } })
    const iframe = document.querySelector('#root iframe')
    if (!(iframe instanceof HTMLIFrameElement)) {
      throw new Error('expected an iframe under the target')
    }
    const src = new URL(iframe.src)
    expect(src.origin).toBe('https://acme.simplepdf.com')
    expect(src.pathname).toBe('/en/editor')
  })

  it('does not direct-load a documents URL on a nested subdomain (one tenant label only)', () => {
    document.body.innerHTML = '<div id="root"></div>'
    mount({ target: '#root', companyIdentifier: 'acme', document: { url: 'https://a.b.simplepdf.com/documents/abc' } })
    const iframe = document.querySelector('#root iframe')
    if (!(iframe instanceof HTMLIFrameElement)) {
      throw new Error('expected an iframe under the target')
    }
    // a.b.simplepdf.com is two labels above the base domain → not a tenant documents
    // URL → falls back to the configured tenant's /editor host-fetch path.
    expect(new URL(iframe.src).origin).toBe('https://acme.simplepdf.com')
    expect(new URL(iframe.src).pathname).toBe('/en/editor')
  })

  it('does not direct-load a documents URL at the apex base domain (a tenant subdomain is required)', () => {
    document.body.innerHTML = '<div id="root"></div>'
    mount({ target: '#root', companyIdentifier: 'acme', document: { url: 'https://simplepdf.com/documents/abc' } })
    const iframe = document.querySelector('#root iframe')
    if (!(iframe instanceof HTMLIFrameElement)) {
      throw new Error('expected an iframe under the target')
    }
    expect(new URL(iframe.src).pathname).toBe('/en/editor')
  })

  it('does not direct-load a documents URL with extra path segments (anchored /documents/<id>)', () => {
    document.body.innerHTML = '<div id="root"></div>'
    mount({
      target: '#root',
      companyIdentifier: 'acme',
      document: { url: 'https://demo.simplepdf.com/documents/abc/extra' },
    })
    const iframe = document.querySelector('#root iframe')
    if (!(iframe instanceof HTMLIFrameElement)) {
      throw new Error('expected an iframe under the target')
    }
    expect(new URL(iframe.src).pathname).toBe('/en/editor')
  })

  it('removes the iframe it created on dispose', () => {
    document.body.innerHTML = '<div id="root"></div>'
    const embed = createEmbed({ target: '#root', companyIdentifier: 'acme' })
    expect(document.querySelector('#root iframe')).not.toBeNull()
    embed.lifecycle.dispose()
    expect(document.querySelector('#root iframe')).toBeNull()
  })

  it('loads the document once readiness is reached via the probe (gate posts LOAD_DOCUMENT)', async () => {
    vi.useFakeTimers()
    document.body.innerHTML = '<div id="root"></div>'
    mount({ target: '#root', document: { dataUrl: 'data:application/pdf;base64,AAAA' } })
    const iframe = document.querySelector('#root iframe')
    if (!(iframe instanceof HTMLIFrameElement) || iframe.contentWindow === null) {
      throw new Error('expected an iframe with a contentWindow')
    }
    const contentWindow = iframe.contentWindow
    const posted: { type: string; request_id: string }[] = []
    vi.spyOn(contentWindow, 'postMessage').mockImplementation((message: unknown) => {
      if (typeof message === 'string') {
        posted.push(JSON.parse(message))
      }
    })
    // Advance to a probe tick: readiness reached with NO EDITOR_READY / DOCUMENT_LOADED
    // event — only the probe. The readiness gate must still fire the deferred load.
    await vi.advanceTimersByTimeAsync(500)
    const probe = posted.find((message) => message.type === 'GET_FIELDS')
    if (probe === undefined) {
      throw new Error('expected a readiness probe')
    }
    window.dispatchEvent(
      new MessageEvent('message', {
        data: JSON.stringify({
          type: 'REQUEST_RESULT',
          data: { request_id: probe.request_id, result: { success: true, data: { fields: [] } } },
        }),
        origin: 'https://acme.simplepdf.com',
        source: contentWindow,
      }),
    )
    // Flush the gate's microtask + the async data-URL resolution.
    await vi.advanceTimersByTimeAsync(0)
    expect(posted.some((message) => message.type === 'LOAD_DOCUMENT')).toBe(true)
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('attaches to an existing <iframe> target instead of creating one, and leaves it on dispose', () => {
    document.body.innerHTML = '<iframe id="ed" src="https://acme.simplepdf.com/editor"></iframe>'
    const iframeCountBefore = document.querySelectorAll('iframe').length
    const embed = mount({ target: '#ed', companyIdentifier: 'acme' })
    // No new iframe is created: we bridge to the one you rendered.
    expect(document.querySelectorAll('iframe').length).toBe(iframeCountBefore)
    // dispose() must NOT remove an iframe the consumer owns.
    embed.lifecycle.dispose()
    expect(document.querySelector('#ed')).not.toBeNull()
  })

  it('rejects an attached iframe whose src origin does not match the companyIdentifier', () => {
    document.body.innerHTML = '<iframe id="ed" src="https://other.simplepdf.com/editor"></iframe>'
    expect(() => mount({ target: '#ed', companyIdentifier: 'acme' })).toThrow('https://other.simplepdf.com')
  })

  it('rejects a documents URL when attaching to an existing iframe (mount-only feature)', () => {
    document.body.innerHTML = '<iframe id="ed" src="https://demo.simplepdf.com/documents/abc"></iframe>'
    expect(() =>
      mount({ target: '#ed', companyIdentifier: 'acme', document: { url: 'https://demo.simplepdf.com/documents/abc' } }),
    ).toThrow(/documents URL/)
  })

  it('does not false-positive the origin guard when the iframe has no usable src', () => {
    for (const html of ['<iframe id="x"></iframe>', '<iframe id="x" src=""></iframe>', '<iframe id="x" src="about:blank"></iframe>']) {
      document.body.innerHTML = html
      expect(() => mount({ target: '#x', companyIdentifier: 'acme' })).not.toThrow()
    }
  })

  it('rejects a missing companyIdentifier', () => {
    // @ts-expect-error companyIdentifier is required; exercise the runtime guard for untyped JS callers
    expect(() => createEmbed({ target: '#root' })).toThrow(/companyIdentifier is required/)
  })

  it('rejects a non-element, non-string target with a clean error', () => {
    // @ts-expect-error exercising the runtime guard for untyped JS callers
    expect(() => createEmbed({ target: 123, companyIdentifier: 'acme' })).toThrow(/target must be/)
  })

  it('rejects a non-object document with a clean error', () => {
    document.body.innerHTML = '<div id="root"></div>'
    // @ts-expect-error exercising the runtime guard for untyped JS callers
    expect(() => mount({ target: '#root', document: null })).toThrow(/document must be an object/)
  })

  it('rejects a non-object args with a clean error', () => {
    // @ts-expect-error exercising the runtime guard for untyped JS callers
    expect(() => createEmbed(null)).toThrow(/config object/)
  })

  it('rejects a non-string baseDomain with a clean error', () => {
    // @ts-expect-error exercising the runtime guard for untyped JS callers
    expect(() => createEmbed({ target: '#root', companyIdentifier: 'acme', baseDomain: 123 })).toThrow(/baseDomain must be a string/)
  })
})
