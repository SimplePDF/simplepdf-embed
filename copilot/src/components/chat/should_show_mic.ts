import type { DemoGate } from '../../routes/index'

// Mic-visibility predicate, extracted from chat_pane for direct testing. Gates
// on a RESOLVED valid demo entitlement (D13): an invalid `?share=` resolves to
// `{ kind: 'byok' }` server-side while leaving a non-null shareIdRef, so the
// share string alone is NOT sufficient and would 401 on POST. `canSend`
// already folds in `isReady`, so the mic tracks the same composer-usable state
// as the textarea. `voiceInputSupported` is the hydration-safe browser gate.
export const shouldShowMic = ({
  canSend,
  demoGate,
  voiceInputSupported,
}: {
  canSend: boolean
  demoGate: DemoGate
  voiceInputSupported: boolean
}): boolean => canSend && demoGate.kind === 'demo' && voiceInputSupported
