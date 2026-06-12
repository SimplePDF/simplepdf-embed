import type { DemoGate } from '../../routes/index'
import type { ByokConfig, ByokSttConfig, Vault } from '../byok'

// Pure capability resolution (P070-02 V1 #5, extracted from chat_pane for direct
// testing). For each of Chat and STT independently: a BYOK config overrides the
// demo (per-capability precedence); else a valid demo share; else nothing.
// Recording requires BOTH usable, and the route is resolved ONCE before
// recording with no cross-route fallback.

export type ChatResolution = { kind: 'byok'; config: ByokConfig } | { kind: 'demo' } | { kind: 'none' }

export type SttResolution =
  | { kind: 'byok'; key: string; config: ByokSttConfig }
  | { kind: 'demo' }
  | { kind: 'none' }

// What the disclosure names as the audio recipient, frozen before getUserMedia.
export type TranscriptionDestination =
  | { kind: 'demo' }
  | { kind: 'openai-byok' }
  | { kind: 'custom-byok'; host: string }

export const resolveChat = ({ vault, demoGate }: { vault: Vault; demoGate: DemoGate }): ChatResolution => {
  const active = vault.active !== null ? (vault.credentials[vault.active] ?? null) : null
  if (active !== null) {
    return { kind: 'byok', config: active }
  }
  if (demoGate.kind === 'demo') {
    return { kind: 'demo' }
  }
  return { kind: 'none' }
}

export const resolveStt = ({ vault, demoGate }: { vault: Vault; demoGate: DemoGate }): SttResolution => {
  const key = vault.sttActive
  const active = key !== null ? (vault.sttCredentials[key] ?? null) : null
  if (key !== null && active !== null) {
    return { kind: 'byok', key, config: active }
  }
  if (demoGate.kind === 'demo') {
    return { kind: 'demo' }
  }
  return { kind: 'none' }
}

export const isChatAvailable = (resolution: ChatResolution): boolean => resolution.kind !== 'none'
export const isSttAvailable = (resolution: SttResolution): boolean => resolution.kind !== 'none'

// What clicking the mic should do (P070-02 V1 #5). Recording needs BOTH Chat
// and STT — a transcript you can't send is useless — so the resolver is
// Chat-first, STT-second: open the picker on the missing capability's tab, else
// arm recording.
export type MicAction = { kind: 'record' } | { kind: 'configure'; tab: 'chat' | 'speech-to-text' }

export const resolveMicAction = ({ chat, stt }: { chat: ChatResolution; stt: SttResolution }): MicAction => {
  if (chat.kind === 'none') {
    return { kind: 'configure', tab: 'chat' }
  }
  if (stt.kind === 'none') {
    return { kind: 'configure', tab: 'speech-to-text' }
  }
  return { kind: 'record' }
}

const hostOf = (baseUrl: string): string => {
  try {
    return new URL(baseUrl).host
  } catch {
    return 'the configured endpoint'
  }
}

// The frozen audio destination for the disclosure. `none` cannot reach the
// armed state (the mic resolver opens the picker first), but it is handled so
// the mapping is total.
export const sttDestination = (resolution: SttResolution): TranscriptionDestination => {
  switch (resolution.kind) {
    case 'demo':
    case 'none':
      return { kind: 'demo' }
    case 'byok':
      return resolution.config.provider === 'openai'
        ? { kind: 'openai-byok' }
        : { kind: 'custom-byok', host: hostOf(resolution.config.baseUrl) }
    default:
      resolution satisfies never
      return { kind: 'demo' }
  }
}
