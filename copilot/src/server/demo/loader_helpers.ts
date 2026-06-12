import { createServerFn } from '@tanstack/react-start'
import { getRequestHeader } from '@tanstack/react-start/server'
import type { DemoModel } from '../../lib/demo/demo_model'
import { resolveDemoModel } from './demo_config'

// Demo-only loader server fns for the home route.

// Two-state gate: either the deployment is in demo mode (operator chat +
// transcription keys configured) and the chat runs against the demo model, or
// the visitor has to bring their own key. Derived purely from server config —
// no invite shares, no `?share=`.
export type DemoGate = { kind: 'byok' } | { kind: 'demo'; model: DemoModel }

// Reads demo mode straight from server config (same source the server routes
// gate on), so the client and the routes never disagree on `isDemo`. No input
// from the page URL.
export const readDemoGate = createServerFn({ method: 'GET' }).handler(async (): Promise<DemoGate> => {
  const model = resolveDemoModel()
  return model === null ? { kind: 'byok' } : { kind: 'demo', model }
})

// Cookie that records the user dismissing the first-load splash. Read
// server-side so the modal HTML is included (or omitted) directly in
// the SSR response — no localStorage round-trip, no hydration mismatch,
// no flash of the modal on subsequent visits. Lightweight inline parse:
// avoids pulling in a cookie-parsing dependency for one entry. Read and
// write helpers live in this file so the two sides cannot drift on
// cookie name, max-age, SameSite, or Secure flag.
// Kept as `form-copilot-welcome-dismissed` after the rename so returning
// visitors don't see the welcome modal again.
const WELCOME_DISMISSED_COOKIE = 'form-copilot-welcome-dismissed'

const cookieIsTruthy = (header: string | undefined, name: string): boolean => {
  if (header === undefined || header === '') {
    return false
  }
  for (const segment of header.split(';')) {
    const trimmed = segment.trim()
    const equalsIndex = trimmed.indexOf('=')
    if (equalsIndex === -1) {
      continue
    }
    const key = trimmed.slice(0, equalsIndex)
    if (key === name) {
      return trimmed.slice(equalsIndex + 1) === '1'
    }
  }
  return false
}

export const readWelcomeDismissed = createServerFn({ method: 'GET' }).handler(
  async (): Promise<boolean> => cookieIsTruthy(getRequestHeader('cookie'), WELCOME_DISMISSED_COOKIE),
)

// Browser-only: persist the welcome dismissal so the SSR loader's cookie
// read on the next request returns true and the modal does not re-render.
// 1-year persistence, first-party context only. `Secure` is added on HTTPS
// so production deploys default safe; localhost dev over HTTP would
// silently drop a Secure cookie, so we only set it when the protocol
// allows.
export const writeWelcomeDismissedCookie = (): void => {
  if (typeof document === 'undefined') {
    return
  }
  const secureFlag = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : ''
  // biome-ignore lint/suspicious/noDocumentCookie: deliberate first-party write; the CookieStore API is async and lacks the browser support this synchronous helper needs.
  document.cookie = `${WELCOME_DISMISSED_COOKIE}=1; path=/; max-age=31536000; SameSite=Lax${secureFlag}`
}
