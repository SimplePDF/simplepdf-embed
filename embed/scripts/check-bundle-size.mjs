// Bundle-size budget guard, run after `npm run build`. Gzips each public entry's local
// closure (the entry file plus the dist chunks it imports statically; peer deps are
// external and never counted) and fails if any entry exceeds its budget. A chunk an
// entry only `import()`s lazily is budgeted on its own row (it is downloaded only by
// the consumers that trigger it), so the two costs stay visible separately. Export loadability is guarded
// separately by ../../scripts/check-exports.mjs (the `check:exports` script).

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')

// Gzip budget (bytes) per entry's local closure. Each cap is the current size plus
// ~1 KB of headroom, so any non-trivial growth trips the gate and gets reviewed.
// The zero-dep root carries the bridge + createEmbed (create + attach paths) + its
// actionable config validation + the WebMCP opt-in hook.
const BUDGETS = {
  'index.js': 9 * 1024,
  'protocol.js': 3.5 * 1024,
  'schemas.js': 3 * 1024,
  'tools.js': 5 * 1024,
  'ai-sdk.js': 5.5 * 1024,
  'tanstack-ai.js': 5.5 * 1024,
}

// Lazily-imported chunks, matched by their un-hashed name prefix. The WebMCP chunk
// carries the tool registration + the generated input-schema table.
const LAZY_BUDGETS = {
  'webmcp-': 5 * 1024,
}

const importsOf = (file, pattern) => {
  const content = readFileSync(join(DIST, file), 'utf8')
  return [...content.matchAll(pattern)].map((match) => match[1].replace(/^\.\//, ''))
}
const localImports = (file) => importsOf(file, /from\s*['"](\.\/[^'"]+)['"]/g)
const lazyImports = (file) => importsOf(file, /import\(['"](\.\/[^'"]+)['"]\)/g)

const closureOf = (entry) => {
  const seen = new Set()
  const walk = (file) => {
    if (seen.has(file) || !existsSync(join(DIST, file))) {
      return
    }
    seen.add(file)
    for (const dependency of localImports(file)) {
      walk(dependency)
    }
  }
  walk(entry)
  return [...seen]
}

const gzipBytes = (files) =>
  files.reduce((total, file) => total + gzipSync(readFileSync(join(DIST, file))).length, 0)

const checkBudget = (entry, budget) => {
  const size = gzipBytes(closureOf(entry))
  const ok = size <= budget
  console.log(`${ok ? '✓' : '✗'} ${entry}: ${size} B gzip (budget ${budget} B)`)
  return ok
}

const entriesWithinBudget = Object.entries(BUDGETS).map(([entry, budget]) => {
  if (!existsSync(join(DIST, entry))) {
    console.error(`✗ ${entry}: missing from dist (run \`npm run build\` first)`)
    return false
  }
  return checkBudget(entry, budget)
})

// Every lazy chunk an entry references must be built and budgeted; a lazy import
// with no budget row is an unmeasured download.
const lazyChunks = [...new Set(Object.keys(BUDGETS).flatMap((entry) => closureOf(entry).flatMap(lazyImports)))]
const lazyWithinBudget = lazyChunks.map((chunk) => {
  const budgetEntry = Object.entries(LAZY_BUDGETS).find(([prefix]) => chunk.startsWith(prefix))
  if (budgetEntry === undefined || !existsSync(join(DIST, chunk))) {
    console.error(`✗ ${chunk}: lazily imported but not built or not budgeted (add a LAZY_BUDGETS row)`)
    return false
  }
  return checkBudget(chunk, budgetEntry[1])
})

process.exit([...entriesWithinBudget, ...lazyWithinBudget].every(Boolean) ? 0 : 1)
