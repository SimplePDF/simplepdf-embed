// Benchmark-only (delete benchmark/ before the PR). Times JEV vs an OpenAI-compatible model on the
// SAME W-9 payload: a mapping pass (map every field) + a plausibility pass (judge every filled
// value), each a single batched call, run repeatedly. It measures pure model latency — the editor
// round-trips are model-independent and excluded on purpose. Run: `npm run bench`.
//
// Env (in .env.local or the shell):
//   NEXT_PUBLIC_TYPESAFE_API_KEY   the Typesafe/JEV key (TYPESAFE_API_KEY also accepted)
//   BENCHMARK_MODEL_BASE_URL       OpenAI-compatible base that serves the model, e.g. https://api.deepseek.com
//   BENCHMARK_MODEL_ID             model id, e.g. deepseek_v4_flash
//   BENCHMARK_MODEL_API_KEY        that provider's key
//   BENCHMARK_MODEL_EXTRA_BODY     optional JSON merged into each request, e.g. {"reasoning_effort":"low"}
//   BENCH_RUNS                     timed runs per model (default 5)
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { W9_INPUT, type BenchInput } from "./fixtures"
import { runJev, runOpenAICompatible, type ModelOutput } from "./backends"

// A field is flagged implausible below this score (matches the app's PLAUSIBILITY_MIN).
const PLAUSIBILITY_MIN = 0.3

// Populate process.env from .env.local for any key not already set (vitest, unlike Next, does not).
const loadEnvLocal = (): void => {
  const path = join(process.cwd(), ".env.local")
  if (!existsSync(path)) {
    return
  }
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim()
    if (trimmed === "" || trimmed.startsWith("#")) {
      continue
    }
    const separator = trimmed.indexOf("=")
    if (separator === -1) {
      continue
    }
    const key = trimmed.slice(0, separator).trim()
    const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "")
    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

const nonEmpty = (value: string | undefined): string | null => (value !== undefined && value.trim() !== "" ? value : null)

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const parseExtraBody = (raw: string | null): Record<string, unknown> => {
  if (raw === null) {
    return {}
  }
  try {
    const parsed: unknown = JSON.parse(raw)
    return isRecord(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

type Stats = { runs: number; avg: number; min: number; max: number; p50: number }
const stats = (values: number[]): Stats => {
  const sorted = [...values].sort((a, b) => a - b)
  const sum = sorted.reduce((total, value) => total + value, 0)
  const count = sorted.length
  return {
    runs: count,
    avg: count === 0 ? 0 : sum / count,
    min: sorted[0] ?? 0,
    max: sorted[count - 1] ?? 0,
    p50: sorted[Math.floor(count / 2)] ?? 0,
  }
}

type ModelResult = { name: string; map: Stats; classify: Stats; total: Stats; sample: ModelOutput | undefined }

const benchmarkModel = async (
  name: string,
  run: (input: BenchInput) => Promise<ModelOutput>,
  input: BenchInput,
  runs: number,
): Promise<ModelResult> => {
  await run(input) // warm-up, discarded (excludes cold-start / connection setup)
  const outputs: ModelOutput[] = []
  for (const _ of Array.from({ length: runs })) {
    outputs.push(await run(input))
  }
  const timings = outputs.map((output) => output.timing)
  return {
    name,
    map: stats(timings.map((timing) => timing.mapMs)),
    classify: stats(timings.map((timing) => timing.classifyMs)),
    total: stats(timings.map((timing) => timing.mapMs + timing.classifyMs)),
    sample: outputs[outputs.length - 1],
  }
}

// Are the two models producing the SAME decisions? Latency only means something once they do.
// "none", "unchecked" and "" all mean "leave the field blank", so they compare as equal.
const BLANK_DECISIONS = new Set(["none", "unchecked", ""])
const canonical = (value: string | undefined): string => {
  const normalized = (value ?? "").trim().toLowerCase()
  return BLANK_DECISIONS.has(normalized) ? "" : normalized
}
const flagged = (score: number | undefined): boolean => score !== undefined && score < PLAUSIBILITY_MIN

const compareOutputs = (a: ModelResult, b: ModelResult): void => {
  const sampleA = a.sample
  const sampleB = b.sample
  if (sampleA === undefined || sampleB === undefined) {
    return
  }
  console.log(`output agreement — ${a.name} vs ${b.name}:\n`)

  const fieldIds = Object.keys(sampleA.mapping)
  const mapDisagreements = fieldIds.filter((id) => canonical(sampleA.mapping[id]) !== canonical(sampleB.mapping[id]))
  console.log(`  mapping: ${fieldIds.length - mapDisagreements.length}/${fieldIds.length} fields chose the same column/option (blank-equivalents collapsed)`)
  for (const id of mapDisagreements) {
    console.log(`    - ${id}: ${a.name}="${sampleA.mapping[id] ?? "?"}"  ${b.name}="${sampleB.mapping[id] ?? "?"}"`)
  }

  const labels = Object.keys(sampleA.plausibility)
  const plausDisagreements = labels.filter((label) => flagged(sampleA.plausibility[label]) !== flagged(sampleB.plausibility[label]))
  console.log(`\n  plausibility: ${labels.length - plausDisagreements.length}/${labels.length} filled fields agree on flagged-implausible (< ${PLAUSIBILITY_MIN})`)
  for (const label of plausDisagreements) {
    console.log(`    - "${label}": ${a.name}=${(sampleA.plausibility[label] ?? 0).toFixed(2)}  ${b.name}=${(sampleB.plausibility[label] ?? 0).toFixed(2)}`)
  }
  console.log("")
}

const ms = (value: number): string => `${Math.round(value)}ms`

const printComparison = (results: ModelResult[]): void => {
  const rows = results.map((result) => ({
    name: result.name,
    map: `${ms(result.map.avg)} (min ${ms(result.map.min)}, max ${ms(result.map.max)})`,
    classify: `${ms(result.classify.avg)} (min ${ms(result.classify.min)}, max ${ms(result.classify.max)})`,
    total: ms(result.total.avg),
  }))
  const width = (pick: (row: (typeof rows)[number]) => string, header: string): number =>
    Math.max(header.length, ...rows.map((row) => pick(row).length))
  const nameW = width((row) => row.name, "Model")
  const mapW = width((row) => row.map, "map avg")
  const classifyW = width((row) => row.classify, "classify avg")
  const line = (name: string, map: string, classify: string, total: string): string =>
    `${name.padEnd(nameW)}  ${map.padEnd(mapW)}  ${classify.padEnd(classifyW)}  ${total}`

  console.log(`\nfill + classify latency, ${results[0]?.total.runs ?? 0} timed runs each (warm-up discarded):\n`)
  console.log(line("Model", "map avg", "classify avg", "total avg"))
  for (const row of rows) {
    console.log(line(row.name, row.map, row.classify, row.total))
  }
  if (results.length === 2) {
    const [first, second] = results
    if (first !== undefined && second !== undefined) {
      const faster = first.total.avg <= second.total.avg ? first : second
      const slower = faster === first ? second : first
      const ratio = slower.total.avg / Math.max(faster.total.avg, 1)
      console.log(`\n→ ${faster.name} is ${ratio.toFixed(2)}× faster end-to-end (${ms(faster.total.avg)} vs ${ms(slower.total.avg)}).`)
    }
  }
  console.log("")
}

describe("JEV vs OpenAI-compatible fill + classify latency", () => {
  it("times both models on the W-9 payload", async () => {
    loadEnvLocal()
    const runs = Number(nonEmpty(process.env.BENCH_RUNS) ?? "5")
    const results: ModelResult[] = []

    const typesafeKey = nonEmpty(process.env.NEXT_PUBLIC_TYPESAFE_API_KEY) ?? nonEmpty(process.env.TYPESAFE_API_KEY)
    if (typesafeKey !== null) {
      results.push(await benchmarkModel("JEV (System One)", (input) => runJev(typesafeKey, input), W9_INPUT, runs))
    } else {
      console.log("skipping JEV: set NEXT_PUBLIC_TYPESAFE_API_KEY (or TYPESAFE_API_KEY)")
    }

    const baseUrl = nonEmpty(process.env.BENCHMARK_MODEL_BASE_URL)
    const modelId = nonEmpty(process.env.BENCHMARK_MODEL_ID)
    const modelKey = nonEmpty(process.env.BENCHMARK_MODEL_API_KEY)
    if (baseUrl !== null && modelId !== null && modelKey !== null) {
      const config = { baseUrl, model: modelId, apiKey: modelKey, extraBody: parseExtraBody(nonEmpty(process.env.BENCHMARK_MODEL_EXTRA_BODY)) }
      results.push(await benchmarkModel(modelId, (input) => runOpenAICompatible(config, input), W9_INPUT, runs))
    } else {
      console.log("skipping second model: set BENCHMARK_MODEL_BASE_URL, BENCHMARK_MODEL_ID, BENCHMARK_MODEL_API_KEY")
    }

    printComparison(results)
    if (results.length === 2 && results[0] !== undefined && results[1] !== undefined) {
      compareOutputs(results[0], results[1])
    }
    expect(results.length).toBeGreaterThan(0)
  }, 600_000)
})
