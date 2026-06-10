import { describe, expect, it } from 'vitest'
import { validateCustomSttUrl } from './custom_stt_url'

describe('validateCustomSttUrl', () => {
  it('accepts a remote HTTPS base URL and normalizes the trailing slash', () => {
    const result = validateCustomSttUrl('https://api.example.com/v1/')
    expect(result).toEqual({ success: true, data: { baseUrl: 'https://api.example.com/v1' } })
  })

  it('keeps the port and a bare host with no path', () => {
    expect(validateCustomSttUrl('https://gateway.example.com:8443')).toEqual({
      success: true,
      data: { baseUrl: 'https://gateway.example.com:8443' },
    })
  })

  it('accepts http for localhost, 127.0.0.0/8, and [::1]', () => {
    expect(validateCustomSttUrl('http://localhost:11434/v1').success).toBe(true)
    expect(validateCustomSttUrl('http://127.0.0.1:8080/v1').success).toBe(true)
    expect(validateCustomSttUrl('http://127.5.6.7/v1').success).toBe(true)
    expect(validateCustomSttUrl('http://[::1]:9000/v1').success).toBe(true)
  })

  it('rejects http for a remote host', () => {
    const result = validateCustomSttUrl('http://api.example.com/v1')
    expect(result).toMatchObject({ success: false, error: { code: 'http_requires_loopback' } })
  })

  it('rejects a deceptive loopback-looking hostname', () => {
    expect(validateCustomSttUrl('http://localhost.evil.com/v1')).toMatchObject({
      success: false,
      error: { code: 'http_requires_loopback' },
    })
  })

  it('rejects a non-loopback IPv6 over http', () => {
    expect(validateCustomSttUrl('http://[2001:db8::1]/v1')).toMatchObject({
      success: false,
      error: { code: 'http_requires_loopback' },
    })
  })

  it('rejects embedded credentials, query, and fragment', () => {
    expect(validateCustomSttUrl('https://user:pass@api.example.com/v1')).toMatchObject({
      error: { code: 'embedded_credentials' },
    })
    expect(validateCustomSttUrl('https://api.example.com/v1?key=secret')).toMatchObject({
      error: { code: 'has_query' },
    })
    expect(validateCustomSttUrl('https://api.example.com/v1#frag')).toMatchObject({
      error: { code: 'has_fragment' },
    })
  })

  it('rejects non-http(s) schemes and garbage', () => {
    expect(validateCustomSttUrl('ftp://api.example.com')).toMatchObject({
      error: { code: 'unsupported_scheme' },
    })
    expect(validateCustomSttUrl('not a url')).toMatchObject({ error: { code: 'invalid_url' } })
    expect(validateCustomSttUrl('')).toMatchObject({ error: { code: 'invalid_url' } })
  })
})
