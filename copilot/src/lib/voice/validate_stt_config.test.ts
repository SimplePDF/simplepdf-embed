import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ByokSttConfig } from '../byok/providers'
import type { TranscribeFnResult } from './error_codes'
import { validateSttConfig } from './validate_stt_config'

const transcribeMock = vi.fn<(args: unknown) => Promise<TranscribeFnResult>>()
vi.mock('./transcribe_byok_streaming', () => ({
  transcribeByokStreaming: (args: unknown) => transcribeMock(args),
}))

const config: ByokSttConfig = { provider: 'openai', model: 'gpt-4o-mini-transcribe', apiKey: 'sk' }
const fixtureBytes = new Uint8Array([1, 2, 3])
const fresh = (): AbortSignal => new AbortController().signal

afterEach(() => {
  transcribeMock.mockReset()
})

describe('validateSttConfig', () => {
  it('valid on a non-empty transcript', async () => {
    transcribeMock.mockResolvedValue({ success: true, data: { text: 'hello' } })
    expect(await validateSttConfig({ config, fixtureBytes, signal: fresh() })).toEqual({ kind: 'valid' })
  })

  it.each([
    ['unauthorized', 'auth'],
    ['bad_request', 'no_transcript'],
    ['unsupported_media_type', 'unsupported'],
    ['too_large', 'unsupported'],
    ['rate_limited', 'reach'],
    ['service_unavailable', 'reach'],
  ] as const)('maps transcribe error %s → validation %s', async (code, expected) => {
    transcribeMock.mockResolvedValue({ success: false, error: { code, message: code } })
    expect(await validateSttConfig({ config, fixtureBytes, signal: fresh() })).toEqual({
      kind: 'invalid',
      code: expected,
    })
  })
})
