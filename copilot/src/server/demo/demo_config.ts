import { z } from 'zod'
import { type DemoModel, DemoModelSchema } from '../../lib/demo/demo_model'
import { monitoring } from '../../lib/monitoring'
import { readTranscriptionKey } from '../transcription_model'

// The demo runs on ONE operator-configured chat key + model + per-IP turn cap.
// When that chat config AND a transcription key are BOTH present, the
// deployment is "in demo mode": every visitor gets the demo on the operator's
// keys, rate-limited per IP. `isDemo` is purely derived from config presence —
// there are no invite shares and no `?share=`. BYOK still overrides per
// capability. (Replaces the former SHARED_API_KEYS invite-map + ?share=
// machinery — the per-invite budgets/models were over-engineered for a demo.)

// Single per-IP rate-limit bucket (Redis key `rl:__default__:<ipHash>`). The
// per-IP turn lifetime IS the abuse control now that the route is open to any
// visitor in demo mode.
export const DEMO_BUCKET = '__default__'

const DemoChatConfigSchema = z.object({
  apiKey: z.string().min(1),
  model: DemoModelSchema,
  // Total demo turns a single IP may spend (the lifetime cap).
  lifetime: z.coerce.number().int().positive(),
})
type DemoChatConfig = z.infer<typeof DemoChatConfigSchema>

export type DemoResolution =
  | { kind: 'demo'; apiKey: string; lifetime: number; bucket: string; model: DemoModel }
  | { kind: 'not_demo' }

// Config is read fresh per call (3 env vars + a tiny Zod parse — negligible).
// The transcription-key presence is part of the gate, so it must reflect the
// live env, hence no memoisation. The log flags only stop a misconfigured
// deployment from re-spamming the same line on every request.
let invalidWarned = false
let transcriptionWarned = false

const readDemoChatConfig = (): DemoChatConfig | null => {
  const apiKey = process.env.DEMO_CHAT_API_KEY?.trim() ?? ''
  const model = process.env.DEMO_CHAT_MODEL?.trim() ?? ''
  const lifetime = process.env.DEMO_RATE_LIMIT_TURNS?.trim() ?? ''
  if (apiKey === '' && model === '' && lifetime === '') {
    // Plain BYOK-only deployment — nothing configured, nothing to warn about.
    return null
  }
  const parsed = DemoChatConfigSchema.safeParse({ apiKey, model, lifetime })
  if (!parsed.success) {
    if (!invalidWarned) {
      monitoring.error('demo_config.invalid', { detail: z.prettifyError(parsed.error) })
      invalidWarned = true
    }
    return null
  }
  return parsed.data
}

export const resolveDemoConfig = (): DemoResolution => {
  const chat = readDemoChatConfig()
  if (chat === null) {
    return { kind: 'not_demo' }
  }
  // "Both required": a chat config without a transcription key is an incomplete
  // demo (voice would be missing), so treat the whole thing as not-demo.
  if (!readTranscriptionKey().success) {
    if (!transcriptionWarned) {
      // Always-on (monitoring.error, not warn) so a deployment that sets the
      // chat config but forgets the transcription key — which silently drops to
      // BYOK-only — is visible in prod, same as the invalid-config path.
      monitoring.error('demo_config.transcription_key_missing', {})
      transcriptionWarned = true
    }
    return { kind: 'not_demo' }
  }
  return {
    kind: 'demo',
    apiKey: chat.apiKey,
    lifetime: chat.lifetime,
    bucket: DEMO_BUCKET,
    model: chat.model,
  }
}

export const resolveDemoModel = (): DemoModel | null => {
  const resolution = resolveDemoConfig()
  return resolution.kind === 'demo' ? resolution.model : null
}
