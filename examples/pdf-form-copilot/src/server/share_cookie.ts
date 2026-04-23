import { setCookie } from '@tanstack/react-start/server'

// Cookie-based share carrier. The share id never lives in the URL past the
// first page load: on arrival we validate the `?share=` query parameter,
// write this cookie, and issue a redirect to the clean URL. Every subsequent
// server request (API routes, demo-gate server fn) reads the share id from
// the cookie, so a user copy-pasting their address bar never leaks the
// invite secret.
//
// Security posture:
// - HttpOnly: the browser never exposes the raw share id to client JS.
// - Secure: TLS only in prod (same attribute is skipped on http://localhost
//   dev via the runtime; setCookie honours the standard spec there).
// - SameSite=Strict: blocks cross-site POSTs from replaying the cookie.
// - Path=/: the API routes and the landing loader both need it.
// - 24h TTL: long enough for a single session of casual play, short enough
//   to limit the blast radius of a leaked cookie from a shared device.

const SHARE_COOKIE_NAME = 'simplepdf-share'
const SHARE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24

export const readShareCookie = (request: Request): string | null => {
  const header = request.headers.get('cookie')
  if (header === null || header === '') {
    return null
  }
  for (const entry of header.split(';')) {
    const [rawName, ...rawValueParts] = entry.split('=')
    if (rawName === undefined) {
      continue
    }
    if (rawName.trim() !== SHARE_COOKIE_NAME) {
      continue
    }
    const rawValue = rawValueParts.join('=').trim()
    if (rawValue === '') {
      return null
    }
    try {
      return decodeURIComponent(rawValue)
    } catch {
      return null
    }
  }
  return null
}

export const writeShareCookie = (shareId: string): void => {
  setCookie(SHARE_COOKIE_NAME, shareId, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: SHARE_COOKIE_MAX_AGE_SECONDS,
  })
}
