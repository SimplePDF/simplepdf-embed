import { monitoring } from '../../lib/monitoring'

// In-memory set of IP hashes that tripped a server-side heuristic flagging
// the caller as non-browser (raw curl, bot, crawler). Once flagged, every
// subsequent call from the same hash is short-circuited with a 403 before
// we spend any work on auth / rate-limit / LLM. In-memory means the list
// resets on deploy; good enough for a demo, and persistence can piggy-back
// on the rate-limit S3 blob later if abuse becomes structural.
const blocked = new Set<string>()

export type MisbehaviorReason = 'non_browser_origin'

export const isMisbehaving = (ipHash: string): boolean => blocked.has(ipHash)

export const markMisbehavior = (ipHash: string, reason: MisbehaviorReason): void => {
  const alreadyBlocked = blocked.has(ipHash)
  blocked.add(ipHash)
  if (!alreadyBlocked) {
    monitoring.warn('misbehavior.flagged', { ip_hash: ipHash, reason })
  }
}
