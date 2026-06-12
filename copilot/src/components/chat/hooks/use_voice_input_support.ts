import { useSyncExternalStore } from 'react'
import { isVoiceInputSupported } from '../../../lib/voice/is_voice_input_supported'

const noop = (): void => {}
// Voice support is static once the page has loaded, so there is nothing to
// subscribe to — the store never changes.
const subscribe = (): (() => void) => noop

// Hydration-safe mic gate (D21): the server snapshot is always false and the
// client snapshot is the real capability. useSyncExternalStore reconciles the
// SSR/hydration difference without a mismatch warning (mirrors
// use_iframe_bridge.ts), so the mic appears after hydration. chat_pane reads
// THIS hook, never isVoiceInputSupported() inline in render.
export const useVoiceInputSupport = (): boolean =>
  useSyncExternalStore(subscribe, isVoiceInputSupported, () => false)
