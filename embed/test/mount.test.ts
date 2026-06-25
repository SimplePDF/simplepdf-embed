import { afterEach, describe, expect, it } from 'vitest'
import { buildEditorDomain, createEmbed, EmbedConfigError, encodeContext } from '../src/mount'
import type { Embed } from '../src/types'

describe(buildEditorDomain.name, () => {
  it('uses https for production base domains', () => {
    expect(buildEditorDomain({ tenant: 'acme', baseDomain: 'simplepdf.com' })).toBe('https://acme.simplepdf.com')
  })

  it('uses http for local/.nil base domains', () => {
    expect(buildEditorDomain({ tenant: 'acme', baseDomain: 'localhost:3000' })).toBe('http://acme.localhost:3000')
    expect(buildEditorDomain({ tenant: 'acme', baseDomain: 'acme.nil' })).toBe('http://acme.acme.nil')
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
      embed.dispose()
    }
    mounted.length = 0
    document.body.innerHTML = ''
  })

  // Defaults tenant so the document/target tests stay terse; pass tenant to override.
  const mount = (args: Omit<Parameters<typeof createEmbed>[0], 'tenant'> & { tenant?: string }): Embed => {
    const embed = createEmbed({ tenant: 'acme', ...args })
    mounted.push(embed)
    return embed
  }

  it('throws EmbedConfigError when the target selector matches nothing', () => {
    expect(() => mount({ target: '#missing' })).toThrow(EmbedConfigError)
  })

  it('throws EmbedConfigError for an invalid tenant', () => {
    document.body.innerHTML = '<div id="root"></div>'
    expect(() => mount({ target: '#root', tenant: 'Not A Label' })).toThrow(/DNS label/)
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

  it('accepts the reserved "embed" tenant (reserved-portal rejection is WEM-only)', () => {
    document.body.innerHTML = '<div id="root"></div>'
    expect(() => mount({ target: '#root', tenant: 'embed' })).not.toThrow()
  })

  it('mounts an iframe under the target with the locale + context in the URL', () => {
    document.body.innerHTML = '<div id="root"></div>'
    mount({ target: '#root', tenant: 'acme', locale: 'fr', context: { a: 1 } })
    const iframe = document.querySelector('#root iframe')
    if (!(iframe instanceof HTMLIFrameElement)) {
      throw new Error('expected an iframe under the target')
    }
    const src = new URL(iframe.src)
    expect(src.origin).toBe('https://acme.simplepdf.com')
    expect(src.pathname).toBe('/fr/editor')
    expect(src.searchParams.get('context')).not.toBeNull()
  })

  it('removes the iframe it created on dispose', () => {
    document.body.innerHTML = '<div id="root"></div>'
    const embed = createEmbed({ target: '#root', tenant: 'acme' })
    expect(document.querySelector('#root iframe')).not.toBeNull()
    embed.dispose()
    expect(document.querySelector('#root iframe')).toBeNull()
  })

  it('attaches to an existing <iframe> target instead of creating one, and leaves it on dispose', () => {
    document.body.innerHTML = '<iframe id="ed" src="https://acme.simplepdf.com/editor"></iframe>'
    const iframeCountBefore = document.querySelectorAll('iframe').length
    const embed = mount({ target: '#ed', tenant: 'acme' })
    // No new iframe is created: we bridge to the one you rendered.
    expect(document.querySelectorAll('iframe').length).toBe(iframeCountBefore)
    // dispose() must NOT remove an iframe the consumer owns.
    embed.dispose()
    expect(document.querySelector('#ed')).not.toBeNull()
  })

  it('rejects an attached iframe whose src origin does not match the tenant', () => {
    document.body.innerHTML = '<iframe id="ed" src="https://other.simplepdf.com/editor"></iframe>'
    expect(() => mount({ target: '#ed', tenant: 'acme' })).toThrow('https://other.simplepdf.com')
  })

  it('rejects a missing tenant', () => {
    // @ts-expect-error tenant is required; exercise the runtime guard for untyped JS callers
    expect(() => createEmbed({ target: '#root' })).toThrow(/tenant is required/)
  })
})
