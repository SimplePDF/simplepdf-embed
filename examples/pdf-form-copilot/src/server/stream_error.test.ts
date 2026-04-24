import { describe, expect, it } from 'vitest'
import { serializeStreamError } from './stream_error'

// Only regression-guarding cases here. Helper tests for getUpstreamStatus /
// non-object inputs / passthrough-of-plain-Errors intentionally omitted —
// they restate branches without encoding a decision that can silently drift.

const upstream = (statusCode: number, message: string): Error =>
  Object.assign(new Error(message), { statusCode })

describe(serializeStreamError.name, () => {
  // The allow-list is the decision. Each of these four statuses means "the
  // shared demo key can't serve this request"; broadening (back to "all 4xx")
  // would reintroduce the misleading "demo is capped" banner on malformed
  // prompts. Shrinking would leave the BYOK-switch flow broken on real auth
  // rejections.
  it.each([401, 402, 403, 429])('rewrites upstream %i into the demo_key_rejected envelope', (status) => {
    const serialized = serializeStreamError(upstream(status, 'upstream said no'))
    expect(JSON.parse(serialized)).toEqual({ error: 'rate_limited', reason: 'demo_key_rejected' })
  })

  // 400 stands in for the "other 4xx" class (404, 413, 422, 451, ...). Must
  // pass through untouched so the generic panel shows the real diagnostic
  // instead of a "Thanks for trying the demo!" banner the user can't act on.
  it('passes upstream 400 through untouched (other 4xx are not demo-related)', () => {
    expect(serializeStreamError(upstream(400, 'bad request body'))).toBe('bad request body')
  })
})
