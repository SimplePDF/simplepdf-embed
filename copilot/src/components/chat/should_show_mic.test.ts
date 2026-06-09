import { describe, expect, it } from 'vitest'
import type { DemoGate } from '../../routes/index'
import { shouldShowMic } from './should_show_mic'

const demo: DemoGate = { kind: 'demo', model: 'anthropic_haiku_4_5' }
const byok: DemoGate = { kind: 'byok' }

describe('shouldShowMic', () => {
  it('shows for a resolved valid demo entitlement', () => {
    expect(shouldShowMic({ canSend: true, demoGate: demo, voiceInputSupported: true })).toBe(true)
  })

  it('hides for byok — covers BOTH no-share and invalid-share, which both resolve to byok', () => {
    expect(shouldShowMic({ canSend: true, demoGate: byok, voiceInputSupported: true })).toBe(false)
  })

  it('hides when the browser cannot record', () => {
    expect(shouldShowMic({ canSend: true, demoGate: demo, voiceInputSupported: false })).toBe(false)
  })

  it('hides when the composer is not usable (not ready / streaming / locked)', () => {
    expect(shouldShowMic({ canSend: false, demoGate: demo, voiceInputSupported: true })).toBe(false)
  })
})
