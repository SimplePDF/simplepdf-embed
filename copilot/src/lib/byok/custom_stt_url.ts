// Runtime policy for a user-supplied custom (OpenAI-compatible) STT base URL
// (P070-02, V1 #3 / V2 #3 / V3). The value is an API BASE URL — the SDK
// appends `/audio/transcriptions`. Because microphone audio (and optionally a
// bearer key) is sent to this endpoint browser-direct, the policy is strict:
//
//   - https:// for any remote host
//   - http://  ONLY for loopback: `localhost`, the full 127.0.0.0/8 range,
//     and [::1] (W3C Secure-Contexts trustworthy origins) — never
//     `localhost.evil.com`
//   - no embedded credentials (userinfo), no query string, no fragment
//   - non-http(s) schemes rejected
//   - trailing slashes normalized away

export type CustomSttUrlErrorCode =
  | 'embedded_credentials'
  | 'has_fragment'
  | 'has_query'
  | 'http_requires_loopback'
  | 'invalid_url'
  | 'unsupported_scheme'

type ValidateCustomSttUrlResult =
  | { success: true; data: { baseUrl: string } }
  | { success: false; error: { code: CustomSttUrlErrorCode; message: string } }

const fail = (code: CustomSttUrlErrorCode, message: string): ValidateCustomSttUrlResult => ({
  success: false,
  error: { code, message },
})

// Loopback per the Secure-Contexts trustworthy-origin algorithm: `localhost`,
// any 127.0.0.0/8 IPv4, and the IPv6 loopback. A multi-label host such as
// `localhost.evil.com` is NOT loopback.
const isLoopbackHost = (hostname: string): boolean => {
  const lower = hostname.toLowerCase()
  if (lower === 'localhost' || lower === '[::1]' || lower === '::1') {
    return true
  }
  const octets = lower.split('.')
  if (octets.length !== 4 || octets[0] !== '127') {
    return false
  }
  return octets.every((octet) => /^\d{1,3}$/.test(octet) && Number(octet) <= 255)
}

export const validateCustomSttUrl = (raw: string): ValidateCustomSttUrlResult => {
  const parsed = ((): URL | null => {
    try {
      return new URL(raw.trim())
    } catch {
      return null
    }
  })()
  if (parsed === null) {
    return fail('invalid_url', 'Enter a valid URL (e.g. https://host/v1)')
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return fail('unsupported_scheme', 'Only http:// and https:// are supported')
  }
  if (parsed.username !== '' || parsed.password !== '') {
    return fail('embedded_credentials', 'Do not put credentials in the URL')
  }
  if (parsed.search !== '') {
    return fail('has_query', 'Remove the query string from the URL')
  }
  if (parsed.hash !== '') {
    return fail('has_fragment', 'Remove the # fragment from the URL')
  }
  if (parsed.protocol === 'http:' && !isLoopbackHost(parsed.hostname)) {
    return fail('http_requires_loopback', 'http:// is only allowed for localhost / 127.0.0.0/8 / [::1]')
  }
  // Normalize: keep scheme + host (+ port) + path, drop trailing slashes so
  // the SDK appends `/audio/transcriptions` cleanly.
  const baseUrl = `${parsed.protocol}//${parsed.host}${parsed.pathname.replace(/\/+$/, '')}`
  return { success: true, data: { baseUrl } }
}
