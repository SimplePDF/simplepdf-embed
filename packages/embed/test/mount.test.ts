import { afterEach, describe, expect, it } from 'vitest'
import { buildEditorDomain, EmbedConfigError, encodeContext, mountEmbed } from '../src/mount'
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
})

describe(mountEmbed.name, () => {
  const mounted: Embed[] = []

  afterEach(() => {
    for (const embed of mounted) {
      embed.dispose()
    }
    mounted.length = 0
    document.body.innerHTML = ''
  })

  const mount = (args: Parameters<typeof mountEmbed>[0]): Embed => {
    const embed = mountEmbed(args)
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

  it('throws EmbedConfigError for a non-https document url', () => {
    document.body.innerHTML = '<div id="root"></div>'
    expect(() => mount({ target: '#root', document: { url: 'http://example.com/a.pdf' } })).toThrow(/https/)
  })

  it('throws EmbedConfigError for a document url carrying credentials', () => {
    document.body.innerHTML = '<div id="root"></div>'
    expect(() => mount({ target: '#root', document: { url: 'https://user:pass@example.com/a.pdf' } })).toThrow(
      EmbedConfigError,
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
    const embed = mountEmbed({ target: '#root', tenant: 'acme' })
    expect(document.querySelector('#root iframe')).not.toBeNull()
    embed.dispose()
    expect(document.querySelector('#root iframe')).toBeNull()
  })
})
