import { getClientIp, hashIp, isSameOrigin, looksLikeBrowserFetch } from '../rate_limit'
import { isMisbehaving, markMisbehavior } from './misbehavior'
import { readShareIdFromUrl } from './share_query'
import { resolveApiKey, type SharedKeyResolution } from './shared_keys'

// Demo-only preflight gate shared by /api/chat and /api/summarize. Bundles
// every request-level check that is specific to the SimplePDF-hosted
// demo: misbehavior detection, same-origin enforcement (paired with the
// Sec-Fetch-* second-chance lane), invite-share resolution, and the
// shared-key catalogue lookup that produces the model + API key + bucket
// the rate limiter needs.
//
// A customer-fork (IS_DEMO_MODE === false) does NOT call this — it
// reads its single API key from env and skips every gate here. The
// route handler picks one path or the other; nothing in the file system
// outside `server/demo/` references this module.

export type DemoPreflightResult =
  | { kind: 'response'; response: Response }
  | { kind: 'allowed'; ipHash: string; resolution: Extract<SharedKeyResolution, { kind: 'shared' }> }

export const applyDemoPreflight = async (request: Request): Promise<DemoPreflightResult> => {
  const ip = getClientIp(request)
  const ipHash = await hashIp(ip)
  if (isMisbehaving(ipHash)) {
    return {
      kind: 'response',
      response: Response.json({ error: 'forbidden_blocked' }, { status: 403 }),
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
      response: Response.json({ error: 'forbidden_origin' }, { status: 403 }),
    }
  }
  const shareId = readShareIdFromUrl(request)
  const resolution = resolveApiKey(shareId)
  if (resolution.kind === 'misconfigured') {
    return {
      kind: 'response',
      response: Response.json(
        { error: 'misconfigured_environment', message: 'Misconfigured environment' },
        { status: 500 },
      ),
    }
  }
  if (resolution.kind === 'share_required') {
    // Message omitted on purpose — the client's ErrorBanner renders
    // localised chat.errorAuth* strings for the authentication kind.
    return {
      kind: 'response',
      response: Response.json({ error: 'share_required' }, { status: 401 }),
    }
  }
  return { kind: 'allowed', ipHash, resolution }
}
