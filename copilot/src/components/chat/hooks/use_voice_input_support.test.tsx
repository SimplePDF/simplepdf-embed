// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { useVoiceInputSupport } from './use_voice_input_support'

// Delegate target is mocked so the test asserts the hook's WIRING (server
// snapshot is hardcoded false; client snapshot defers to the helper) without
// fiddling browser globals.
vi.mock('../../../lib/voice/is_voice_input_supported', () => ({
  isVoiceInputSupported: () => true,
}))

const Probe = () => <span>{useVoiceInputSupport() ? 'yes' : 'no'}</span>

describe('useVoiceInputSupport', () => {
  it('server snapshot is false even when the client would support voice (hydration-safe)', () => {
    expect(renderToString(<Probe />)).toContain('no')
  })

  it('client snapshot delegates to isVoiceInputSupported()', () => {
    const { result } = renderHook(() => useVoiceInputSupport())
    expect(result.current).toBe(true)
  })
})
