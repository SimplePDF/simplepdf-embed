"use client"

import { useEffect, useState, type ReactElement } from "react"

export type TimingPhase = "fill" | "classify" | null

const Chronometer = ({
  label,
  explanation,
  running,
  durationMs,
}: {
  label: string
  explanation: string
  running: boolean
  durationMs: number | null
}): ReactElement => {
  const [liveMs, setLiveMs] = useState<number>(0)

  // A live count-up needs a ticking clock; the rare justified useEffect. A 100ms interval
  // is plenty for an integer-ms display and avoids ~60 renders/sec over a multi-second run.
  useEffect(() => {
    if (!running) {
      return
    }
    const start = performance.now()
    const intervalId = setInterval(() => setLiveMs(performance.now() - start), 100)
    return () => clearInterval(intervalId)
  }, [running])

  const shown = running ? liveMs : durationMs

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
      <span className={`font-mono text-3xl font-semibold tabular-nums ${running ? "text-brand" : "text-foreground"}`}>
        {shown === null ? "—" : Math.round(shown)}
        <span className="ml-1 text-sm font-normal text-muted-foreground">ms</span>
      </span>
      <span className="text-[11px] leading-snug text-muted-foreground">{explanation}</span>
    </div>
  )
}

export const Timing = ({
  phase,
  fillMs,
  classifyMs,
}: {
  phase: TimingPhase
  fillMs: number | null
  classifyMs: number | null
}): ReactElement => (
  <section className="grid grid-cols-2 gap-4 rounded-md border border-border bg-card p-4">
    <Chronometer
      label="Fill"
      explanation="JEV maps each column to a field and fills the confident ones."
      running={phase === "fill"}
      durationMs={fillMs}
    />
    <Chronometer
      label="Classify"
      explanation="JEV judges each filled field for implausible or fictional values."
      running={phase === "classify"}
      durationMs={classifyMs}
    />
  </section>
)
