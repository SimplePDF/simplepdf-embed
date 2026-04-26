import { createServerFn } from '@tanstack/react-start'
import { getRequestHeader } from '@tanstack/react-start/server'
import type { DemoModel } from '../../lib/demo/demo_model'
import { resolveShareModel } from './shared_keys'

// Demo-only loader server fns. The home route imports them when
// IS_DEMO_MODE is true; a customer-fork's loader skips this module
// entirely (DemoGate is hardcoded to 'byok', the welcome cookie path
// becomes inert because the WelcomeModal isn't rendered, etc.).

// Two-state gate: either the invite is valid and the chat runs against
// the per-share demo model, or the visitor has to bring their own key.
export type DemoGate = { kind: 'byok' } | { kind: 'demo'; model: DemoModel }

// The share id lives directly in `?share=<id>` on the page URL — no
// cookie round-trip, no URL stripping — so an invite link can be
// copy-pasted and reused verbatim. The loader forwards the id to this
// server fn, which treats a blank / missing id as "no invite".
//
// No same-origin gate here: a direct address-bar navigation doesn't send
// Origin or Referer, so a strict check would collapse every paste of an
// invite link into the 'byok' branch. Cross-origin JS fetches to this
// server-fn endpoint can't read the response under the browser's default
// CORS policy, so an attacker can't enumerate shares from another site.
export const readDemoGate = createServerFn({ method: 'GET' })
  .inputValidator((raw: unknown): { shareId: string | null } => {
    if (typeof raw !== 'object' || raw === null || !('shareId' in raw)) {
      return { shareId: null }
    }
    const value: unknown = raw.shareId
    if (typeof value !== 'string' || value === '') {
      return { shareId: null }
    }
    return { shareId: value }
  })
  .handler(async ({ data }): Promise<DemoGate> => {
    const model = resolveShareModel(data.shareId)
    if (model === null) {
      return { kind: 'byok' }
    }
    return { kind: 'demo', model }
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
  document.cookie = `${WELCOME_DISMISSED_COOKIE}=1; path=/; max-age=31536000; SameSite=Lax${secureFlag}`
}
