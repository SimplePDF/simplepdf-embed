const BAR_COUNT = 48
// Stable keys for the fixed-length, positional bar set (bars never reorder or
// gain identity, so an index-derived key is correct — precomputed to keep it
// out of the render path).
const BAR_KEYS: readonly string[] = Array.from({ length: BAR_COUNT }, (_, index) => `bar-${index}`)

const formatElapsed = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

// Right-align the rolling samples and left-pad with silence so the wave grows
// from the right like a typical recorder.
const padBars = (level: readonly number[], count: number): number[] => {
  if (level.length >= count) {
    return level.slice(level.length - count)
  }
  return [...new Array<number>(count - level.length).fill(0), ...level]
}

// Presentational bar visualizer driven entirely by props (no own state, no
// canvas, no rAF): the hook samples mic levels into `level[]`, React re-renders
// the bars. `motion-reduce:transition-none` drops the easing under
// prefers-reduced-motion. The whole thing is a single labelled image to a
// screen reader; the live "recording" status is announced by chat_pane.
export const VoiceWaveform = ({
  level,
  elapsedMs,
  ariaLabel,
}: {
  level: readonly number[]
  elapsedMs: number
  ariaLabel: string
}) => {
  const bars = padBars(level, BAR_COUNT)
  return (
    <div role="img" aria-label={ariaLabel} className="flex flex-1 items-center gap-2">
      <div className="flex h-6 flex-1 items-center gap-[2px]" aria-hidden="true">
        {bars.map((value, index) => (
          <div
            key={BAR_KEYS[index]}
            className="w-[2px] shrink-0 rounded-full bg-current opacity-70 transition-[height] duration-75 motion-reduce:transition-none"
            style={{ height: `${Math.max(8, Math.round(value * 100))}%` }}
          />
        ))}
      </div>
      <span className="shrink-0 text-xs tabular-nums opacity-70">{formatElapsed(elapsedMs)}</span>
    </div>
  )
}
