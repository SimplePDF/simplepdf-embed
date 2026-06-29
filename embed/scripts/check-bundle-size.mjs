// Bundle-size budget guard, run after `npm run build`. Gzips each public entry's local
// closure (the entry file plus the dist chunks it imports; peer deps are external and
// never counted) and fails if any entry exceeds its budget. Export loadability is guarded
// separately by ../../scripts/check-exports.mjs (the `check:exports` script).

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')

// Gzip budget (bytes) per entry's local closure. Each cap is the current size plus
// ~1 KB of headroom, so any non-trivial growth trips the gate and gets reviewed.
// The zero-dep root carries the bridge + createEmbed (create + attach paths) + its
// actionable config validation.
const BUDGETS = {
  'index.js': 8 * 1024,
  'protocol.js': 3.5 * 1024,
  'schemas.js': 3 * 1024,
  'tools.js': 5 * 1024,
  'ai-sdk.js': 5.5 * 1024,
  'tanstack-ai.js': 5.5 * 1024,
}

const localImports = (file) => {
  const content = readFileSync(join(DIST, file), 'utf8')
  return [...content.matchAll(/from\s*['"](\.\/[^'"]+)['"]/g)].map((match) => match[1].replace(/^\.\//, ''))
}

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

const allWithinBudget = Object.entries(BUDGETS).map(([entry, budget]) => {
  if (!existsSync(join(DIST, entry))) {
    console.error(`✗ ${entry}: missing from dist (run \`npm run build\` first)`)
    return false
  }
  const size = gzipBytes(closureOf(entry))
  const ok = size <= budget
  console.log(`${ok ? '✓' : '✗'} ${entry}: ${size} B gzip (budget ${budget} B)`)
  return ok
})
process.exit(allWithinBudget.every(Boolean) ? 0 : 1)
