import { useCallback, useEffect, useRef, useState } from 'react'
import type { TranscribeFnResult, VoiceInputErrorCode } from '../../../lib/voice/error_codes'
import { selectRecordingMimeType } from '../../../lib/voice/select_recording_mime_type'

// Rolling window of mic levels fed to the waveform, and how often we sample.
const LEVEL_SAMPLE_COUNT = 48
const SAMPLE_INTERVAL_MS = 80
// Raw speech RMS is small (~0.05-0.2), so the bars read flat without a visual
// gain. This scales the displayed level only — it does NOT touch the recorded
// audio. Tune up for livelier bars.
const LEVEL_DISPLAY_GAIN = 6
// Opus defaults in MediaRecorder are conservative (~32-64 kbps) and drop the
// high-frequency detail the transcription model relies on; 128 kbps keeps
// speech crisp without bloating the upload (well under TRANSCRIBE_MAX_BYTES).
const RECORDER_AUDIO_BITS_PER_SECOND = 128_000

export type VoiceStatus = 'idle' | 'armed' | 'recording' | 'transcribing'

type TranscribeFn = (args: {
  blob: Blob
  signal: AbortSignal
  // Called with the full transcript-so-far as streaming deltas arrive (the
  // non-streaming demo path simply never calls it).
  onDelta: (textSoFar: string) => void
}) => Promise<TranscribeFnResult>

export type UseAudioRecorder = {
  status: VoiceStatus
  lastError: VoiceInputErrorCode | null
  level: readonly number[]
  elapsedMs: number
  arm: () => void
  record: () => Promise<void>
  stop: () => void
  cancel: () => void
  dismissError: () => void
}

const mapGetUserMediaError = (error: unknown): VoiceInputErrorCode => {
  if (error instanceof Error) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
      return 'permission_denied'
    }
    if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      return 'microphone_unavailable'
    }
  }
  return 'recording_failed'
}

// RMS of an 8-bit time-domain frame, normalised to ~0..1 (silence ≈ 0).
const computeRms = (data: Uint8Array): number => {
  const sumSquares = data.reduce((acc, value) => {
    const centered = (value - 128) / 128
    return acc + centered * centered
  }, 0)
  return Math.sqrt(sumSquares / data.length)
}

// Sole owner of the voice state machine (D8). The network call is injected so
// the hook stays the single state owner while the transport concern lives in
// the composer. status never has an `error` variant (D18): every failure
// lands on `idle` + a separate `lastError`, so the textarea is always
// reachable. Props are mirrored into refs so every callback is referentially
// stable (no stale closures, no dependency web) without re-subscribing.
export const useAudioRecorder = ({
  transcribe,
  onTranscript,
  onTranscriptDelta,
  maxDurationMs,
}: {
  transcribe: TranscribeFn
  onTranscript: (text: string) => void
  onTranscriptDelta: (textSoFar: string) => void
  maxDurationMs: number
}): UseAudioRecorder => {
  const [status, setStatus] = useState<VoiceStatus>('idle')
  const [lastError, setLastError] = useState<VoiceInputErrorCode | null>(null)
  const [level, setLevel] = useState<readonly number[]>([])
  const [elapsedMs, setElapsedMs] = useState(0)

  const transcribeRef = useRef(transcribe)
  transcribeRef.current = transcribe
  const onTranscriptRef = useRef(onTranscript)
  onTranscriptRef.current = onTranscript
  const onTranscriptDeltaRef = useRef(onTranscriptDelta)
  onTranscriptDeltaRef.current = onTranscriptDelta
  const maxDurationMsRef = useRef(maxDurationMs)
  maxDurationMsRef.current = maxDurationMs

  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const samplerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startedAtRef = useRef<number>(0)
  const abortRef = useRef<AbortController | null>(null)
  const levelBufferRef = useRef<number[]>([])

  const stopSampler = useCallback((): void => {
    if (samplerRef.current !== null) {
      clearInterval(samplerRef.current)
      samplerRef.current = null
    }
  }, [])

  // Deterministic external-resource teardown: stop mic tracks, close the
  // AudioContext, clear the sampler. Reused by stop / cancel / unmount / error
  // so a track or context can never leak.
  const teardownMedia = useCallback((): void => {
    stopSampler()
    recorderRef.current = null
    chunksRef.current = []
    const stream = streamRef.current
    if (stream !== null) {
      for (const track of stream.getTracks()) {
        track.stop()
      }
      streamRef.current = null
    }
    const audioContext = audioContextRef.current
    if (audioContext !== null && audioContext.state !== 'closed') {
      void audioContext.close()
    }
    audioContextRef.current = null
    analyserRef.current = null
    levelBufferRef.current = []
  }, [stopSampler])

  const applyResult = useCallback((result: TranscribeFnResult): void => {
    if (result.success) {
      onTranscriptRef.current(result.data.text)
      setLastError(null)
      return
    }
    switch (result.error.code) {
      case 'cancelled':
        // The user discarded the audio — silent, no inline error.
        return
      case 'bad_request':
      case 'rate_limited':
      case 'service_unavailable':
      case 'too_large':
      case 'unauthorized':
      case 'unsupported_media_type':
        setLastError(result.error.code)
        return
      default:
        result.error.code satisfies never
    }
  }, [])

  const finishRecording = useCallback(async (): Promise<void> => {
    stopSampler()
    const mimeType = recorderRef.current?.mimeType ?? ''
    const blob = new Blob(chunksRef.current, mimeType !== '' ? { type: mimeType } : undefined)
    teardownMedia()
    if (blob.size === 0) {
      setStatus('idle')
      setLastError('encoding_failed')
      return
    }
    setStatus('transcribing')
    const controller = new AbortController()
    abortRef.current = controller
    const result = await transcribeRef.current({
      blob,
      signal: controller.signal,
      // Drop late deltas after cancel/unmount/new-record so a superseded
      // recording can't keep writing to the draft.
      onDelta: (textSoFar) => {
        if (!controller.signal.aborted) {
          onTranscriptDeltaRef.current(textSoFar)
        }
      },
    })
    // A late result after cancel / unmount / a new recording must never touch
    // the draft or error state.
    if (controller.signal.aborted) {
      return
    }
    abortRef.current = null
    setStatus('idle')
    applyResult(result)
  }, [applyResult, stopSampler, teardownMedia])

  const sample = useCallback((): void => {
    const analyser = analyserRef.current
    if (analyser !== null) {
      const data = new Uint8Array(analyser.frequencyBinCount)
      analyser.getByteTimeDomainData(data)
      const buffer = levelBufferRef.current
      buffer.push(Math.min(1, computeRms(data) * LEVEL_DISPLAY_GAIN))
      if (buffer.length > LEVEL_SAMPLE_COUNT) {
        buffer.shift()
      }
      setLevel([...buffer])
    }
    const elapsed = Date.now() - startedAtRef.current
    setElapsedMs(elapsed)
    if (elapsed >= maxDurationMsRef.current) {
      // UX auto-stop: behave exactly as if Stop was pressed.
      recorderRef.current?.stop()
    }
  }, [])

  const arm = useCallback((): void => {
    setLastError(null)
    setStatus('armed')
  }, [])

  const record = useCallback(async (): Promise<void> => {
    setLastError(null)
    const mimeType = selectRecordingMimeType()
    if (mimeType === null) {
      setStatus('idle')
      setLastError('recording_failed')
      return
    }
    const acquired = await (async (): Promise<
      { ok: true; stream: MediaStream } | { ok: false; code: VoiceInputErrorCode }
    > => {
      try {
        // autoGainControl boosts quiet mics (the usual cause of weak levels +
        // under-transcribed audio); noiseSuppression/echoCancellation keep
        // background out. These are browser defaults, requested explicitly so
        // capture quality is consistent across Chrome/Firefox/Safari.
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { autoGainControl: true, echoCancellation: true, noiseSuppression: true },
        })
        return { ok: true, stream }
      } catch (error) {
        return { ok: false, code: mapGetUserMediaError(error) }
      }
    })()
    if (!acquired.ok) {
      setStatus('idle')
      setLastError(acquired.code)
      return
    }
    const setup = ((): { ok: true } | { ok: false; code: VoiceInputErrorCode } => {
      try {
        const recorder = new MediaRecorder(acquired.stream, {
          mimeType,
          audioBitsPerSecond: RECORDER_AUDIO_BITS_PER_SECOND,
        })
        chunksRef.current = []
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunksRef.current.push(event.data)
          }
        }
        recorder.onstop = () => {
          void finishRecording()
        }
        recorder.onerror = () => {
          recorderRef.current = null
          teardownMedia()
          setStatus('idle')
          setLastError('recording_failed')
        }
        const audioContext = new AudioContext()
        const analyser = audioContext.createAnalyser()
        analyser.fftSize = 256
        audioContext.createMediaStreamSource(acquired.stream).connect(analyser)
        recorder.start()
        streamRef.current = acquired.stream
        recorderRef.current = recorder
        audioContextRef.current = audioContext
        analyserRef.current = analyser
        return { ok: true }
      } catch {
        return { ok: false, code: 'recording_failed' }
      }
    })()
    if (!setup.ok) {
      for (const track of acquired.stream.getTracks()) {
        track.stop()
      }
      setStatus('idle')
      setLastError(setup.code)
      return
    }
    startedAtRef.current = Date.now()
    levelBufferRef.current = []
    setElapsedMs(0)
    setLevel([])
    samplerRef.current = setInterval(sample, SAMPLE_INTERVAL_MS)
    setStatus('recording')
  }, [finishRecording, sample, teardownMedia])

  const stop = useCallback((): void => {
    const recorder = recorderRef.current
    if (recorder !== null && recorder.state !== 'inactive') {
      recorder.stop()
    }
  }, [])

  const cancel = useCallback((): void => {
    abortRef.current?.abort()
    abortRef.current = null
    const recorder = recorderRef.current
    if (recorder !== null) {
      // Detach onstop so stopping does NOT transcribe the discarded audio.
      recorder.onstop = null
      if (recorder.state !== 'inactive') {
        recorder.stop()
      }
    }
    teardownMedia()
    setStatus('idle')
    setLastError(null)
    setElapsedMs(0)
    setLevel([])
  }, [teardownMedia])

  const dismissError = useCallback((): void => {
    setLastError(null)
  }, [])

  // Sole effect (justified): tear down external imperative resources on
  // unmount. No effect derives render state.
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      const recorder = recorderRef.current
      if (recorder !== null) {
        recorder.onstop = null
        if (recorder.state !== 'inactive') {
          recorder.stop()
        }
      }
      teardownMedia()
    }
  }, [teardownMedia])

  return { status, lastError, level, elapsedMs, arm, record, stop, cancel, dismissError }
}
