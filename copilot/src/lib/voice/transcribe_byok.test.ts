import { APICallError, type Experimental_TranscriptionResult, experimental_transcribe } from 'ai'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ByokSttConfig } from '../byok/providers'
import { transcribeByok } from './transcribe_byok'

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>()
  return { ...actual, experimental_transcribe: vi.fn() }
})

const transcribeMock = vi.mocked(experimental_transcribe)
const bytes = new Uint8Array([1, 2, 3])
const openai: ByokSttConfig = { provider: 'openai', model: 'gpt-4o-mini-transcribe', apiKey: 'sk-test' }
const fresh = (): AbortSignal => new AbortController().signal

const fakeTranscription = (text: string): Experimental_TranscriptionResult => ({
  text,
  segments: [],
  language: 'en',
  durationInSeconds: undefined,
  warnings: [],
  responses: [],
  providerMetadata: {},
})

const apiError = (statusCode: number): APICallError =>
  new APICallError({
    message: 'RAW_PROVIDER_LEAK',
    url: 'https://api.openai.com',
    requestBodyValues: {},
    statusCode,
  })

afterEach(() => {
  transcribeMock.mockReset()
})

describe('transcribeByok', () => {
  it('returns the transcript text on success', async () => {
    transcribeMock.mockResolvedValue(fakeTranscription('hello world'))
    expect(await transcribeByok({ audioBytes: bytes, signal: fresh(), config: openai })).toEqual({
      success: true,
      data: { text: 'hello world' },
    })
  })

  it('empty transcript → bad_request', async () => {
    transcribeMock.mockResolvedValue(fakeTranscription('   '))
    expect(await transcribeByok({ audioBytes: bytes, signal: fresh(), config: openai })).toMatchObject({
      success: false,
      error: { code: 'bad_request' },
    })
  })

  it('maps an aborted signal to cancelled', async () => {
    const controller = new AbortController()
    controller.abort()
    transcribeMock.mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }))
    expect(
      await transcribeByok({ audioBytes: bytes, signal: controller.signal, config: openai }),
    ).toMatchObject({
      error: { code: 'cancelled' },
    })
  })

  it.each([
    [401, 'unauthorized'],
    [403, 'unauthorized'],
    [429, 'rate_limited'],
    [400, 'bad_request'],
    [500, 'service_unavailable'],
    [503, 'service_unavailable'],
  ])('maps provider %i → %s (sanitized, no raw text)', async (status, code) => {
    transcribeMock.mockRejectedValue(apiError(status))
    const result = await transcribeByok({ audioBytes: bytes, signal: fresh(), config: openai })
    expect(result).toMatchObject({ success: false, error: { code } })
    expect(JSON.stringify(result)).not.toContain('RAW_PROVIDER_LEAK')
  })

  it('maps a network/CORS TypeError → service_unavailable (sanitized)', async () => {
    transcribeMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const result = await transcribeByok({ audioBytes: bytes, signal: fresh(), config: openai })
    expect(result).toMatchObject({ error: { code: 'service_unavailable' } })
    expect(JSON.stringify(result)).not.toContain('Failed to fetch')
  })
})
