import type { ServerErrorBody } from '../../lib/api_envelope'
import { getClientIp, hashIp, isSameOrigin, looksLikeBrowserFetch } from '../rate_limit'
import { type DemoResolution, resolveDemoConfig } from './demo_config'
import { isMisbehaving, markMisbehavior } from './misbehavior'

// Demo-only preflight gate shared by /api/chat, /api/summarize, and
// /api/transcribe. Bundles the request-level checks specific to the demo:
// misbehavior detection, same-origin enforcement (paired with the Sec-Fetch-*
// second-chance lane), and the single demo-config lookup that produces the
// model + API key + per-IP bucket the rate limiter needs.
//
// Demo mode is config-driven (`isDemo`): the deployment is "in demo mode" iff
// the operator configured both a chat key/model/turn-cap and a transcription
// key. There are no invite shares and no `?share=`. A deployment without that
// config runs BYOK-only and never reaches the `allowed` branch.

type DemoPreflightResult =
  | { kind: 'response'; response: Response }
  | { kind: 'allowed'; ipHash: string; resolution: Extract<DemoResolution, { kind: 'demo' }> }

export const applyDemoPreflight = async (request: Request): Promise<DemoPreflightResult> => {
  const ip = getClientIp(request)
  const ipHash = await hashIp(ip)
  if (isMisbehaving(ipHash)) {
    return {
      kind: 'response',
      response: Response.json({ error: 'forbidden_blocked' } satisfies ServerErrorBody, { status: 403 }),
    }
  }
  // Same-origin is the happy path; Sec-Fetch-* is the second-chance lane
  // for privacy-hardened browsers that strip Origin/Referer. If neither
  // passes, the caller is almost certainly not a browser (curl, bot,
  // non-browser script) — flag + 403.
  if (!isSameOrigin(request) && !looksLikeBrowserFetch(request)) {
    markMisbehavior(ipHash, 'non_browser_origin')
    return {
      kind: 'response',
      response: Response.json({ error: 'forbidden_origin' } satisfies ServerErrorBody, { status: 403 }),
    }
  }
  const resolution = resolveDemoConfig()
  switch (resolution.kind) {
    case 'not_demo':
      // The deployment isn't in demo mode (no operator chat + transcription
      // keys). A real demo client never calls these routes when `isDemo` is
      // false — its `demoGate` is derived from the same config — so this is
      // pure defense-in-depth against a non-demo/script caller.
      return {
        kind: 'response',
        response: Response.json(
          { error: 'service_unavailable', reason: 'demo_not_configured' } satisfies ServerErrorBody,
          { status: 503 },
        ),
      }
    case 'demo':
      return { kind: 'allowed', ipHash, resolution }
    default:
      resolution satisfies never
      throw new Error('unreachable: unhandled DemoResolution kind')
  }
}
