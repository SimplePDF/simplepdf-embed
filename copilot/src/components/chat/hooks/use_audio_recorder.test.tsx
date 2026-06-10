// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest'
import type { TranscribeFnResult } from '../../../lib/voice/error_codes'
import { useAudioRecorder } from './use_audio_recorder'

// --- Fakes for the imperative Web APIs the hook drives -----------------------

const track = { stop: vi.fn() }
const fakeStream = { getTracks: () => [track] }

const audioContexts: FakeAudioContext[] = []
class FakeAudioContext {
  state = 'running'
  close = vi.fn().mockResolvedValue(undefined)
  constructor() {
    audioContexts.push(this)
  }
  createAnalyser() {
    return { fftSize: 0, frequencyBinCount: 128, getByteTimeDomainData: (data: Uint8Array) => data.fill(128) }
  }
  createMediaStreamSource() {
    return { connect: vi.fn() }
  }
}

class FakeMediaRecorder {
  static isTypeSupported = (): boolean => true
  state: 'inactive' | 'recording' | 'paused' = 'inactive'
  mimeType: string
  ondataavailable: ((event: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor(_stream: MediaStream, options: { mimeType: string }) {
    this.mimeType = options.mimeType
  }
  start(): void {
    this.state = 'recording'
  }
  stop(): void {
    this.state = 'inactive'
    this.ondataavailable?.({ data: new Blob(['audio-bytes'], { type: this.mimeType }) })
    this.onstop?.()
  }
}

let getUserMedia: Mock
let transcribe: Mock
let onTranscript: Mock

const renderRecorder = (maxDurationMs = 120_000) =>
  renderHook(() => useAudioRecorder({ transcribe, onTranscript, onTranscriptDelta: () => {}, maxDurationMs }))

beforeEach(() => {
  track.stop.mockClear()
  audioContexts.length = 0
  getUserMedia = vi.fn().mockResolvedValue(fakeStream)
  transcribe = vi
    .fn()
    .mockResolvedValue({ success: true, data: { text: 'hello world' } } satisfies TranscribeFnResult)
  onTranscript = vi.fn()
  vi.stubGlobal('MediaRecorder', FakeMediaRecorder)
  vi.stubGlobal('AudioContext', FakeAudioContext)
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('useAudioRecorder', () => {
  it('arm() moves idle → armed and clears any prior error', () => {
    const { result } = renderRecorder()
    act(() => result.current.arm())
    expect(result.current.status).toBe('armed')
    expect(result.current.lastError).toBeNull()
  })

  it('record() → stop() transcribes and lands back on idle with the draft text', async () => {
    const { result } = renderRecorder()
    await act(async () => {
      await result.current.record()
    })
    expect(result.current.status).toBe('recording')
    await act(async () => {
      result.current.stop()
    })
    expect(transcribe).toHaveBeenCalledWith({
      blob: expect.any(Blob),
      signal: expect.any(AbortSignal),
      onDelta: expect.any(Function),
    })
    expect(onTranscript).toHaveBeenCalledWith('hello world')
    expect(result.current.status).toBe('idle')
    expect(result.current.lastError).toBeNull()
    // Teardown: mic track stopped + AudioContext closed.
    expect(track.stop).toHaveBeenCalled()
    expect(audioContexts[0]?.close).toHaveBeenCalled()
  })

  it('maps a denied permission to permission_denied and stays on idle', async () => {
    getUserMedia.mockRejectedValueOnce(Object.assign(new Error('denied'), { name: 'NotAllowedError' }))
    const { result } = renderRecorder()
    await act(async () => {
      await result.current.record()
    })
    expect(result.current.status).toBe('idle')
    expect(result.current.lastError).toBe('permission_denied')
  })

  it('maps a missing device to microphone_unavailable', async () => {
    getUserMedia.mockRejectedValueOnce(Object.assign(new Error('none'), { name: 'NotFoundError' }))
    const { result } = renderRecorder()
    await act(async () => {
      await result.current.record()
    })
    expect(result.current.lastError).toBe('microphone_unavailable')
  })

  it('a server transcription failure lands on idle with lastError set', async () => {
    transcribe.mockResolvedValue({
      success: false,
      error: { code: 'service_unavailable', message: 'down' },
    } satisfies TranscribeFnResult)
    const { result } = renderRecorder()
    await act(async () => {
      await result.current.record()
    })
    await act(async () => {
      result.current.stop()
    })
    expect(result.current.status).toBe('idle')
    expect(result.current.lastError).toBe('service_unavailable')
    expect(onTranscript).not.toHaveBeenCalled()
  })

  it('cancel() during recording discards without transcribing and tears down', async () => {
    const { result } = renderRecorder()
    await act(async () => {
      await result.current.record()
    })
    act(() => result.current.cancel())
    expect(transcribe).not.toHaveBeenCalled()
    expect(result.current.status).toBe('idle')
    expect(result.current.lastError).toBeNull()
    expect(track.stop).toHaveBeenCalled()
  })

  it('cancel() during transcribing drops a late-resolving result (never overwrites the draft)', async () => {
    let resolveTranscribe: (value: TranscribeFnResult) => void = () => {}
    transcribe.mockReturnValue(
      new Promise<TranscribeFnResult>((resolve) => {
        resolveTranscribe = resolve
      }),
    )
    const { result } = renderRecorder()
    await act(async () => {
      await result.current.record()
    })
    await act(async () => {
      result.current.stop()
    })
    expect(result.current.status).toBe('transcribing')
    act(() => result.current.cancel())
    expect(result.current.status).toBe('idle')
    await act(async () => {
      resolveTranscribe({ success: true, data: { text: 'late' } })
      await Promise.resolve()
    })
    expect(onTranscript).not.toHaveBeenCalled()
    expect(result.current.lastError).toBeNull()
  })

  it('auto-stops at maxDurationMs and transcribes as if Stop was pressed', async () => {
    vi.useFakeTimers()
    const { result } = renderRecorder(1_000)
    await act(async () => {
      await result.current.record()
    })
    expect(result.current.status).toBe('recording')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_100)
    })
    expect(transcribe).toHaveBeenCalledTimes(1)
  })

  it('dismissError() clears lastError', async () => {
    getUserMedia.mockRejectedValueOnce(Object.assign(new Error('denied'), { name: 'NotAllowedError' }))
    const { result } = renderRecorder()
    await act(async () => {
      await result.current.record()
    })
    expect(result.current.lastError).toBe('permission_denied')
    act(() => result.current.dismissError())
    expect(result.current.lastError).toBeNull()
  })
})
