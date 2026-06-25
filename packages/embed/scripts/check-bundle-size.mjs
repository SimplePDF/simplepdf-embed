// Bundle-size budget guard. Gzips each public entry's full LOCAL closure (the
// entry file plus the dist chunks it imports — peer deps are external and never
// counted) and fails if any entry exceeds its budget. Run after `npm run build`.

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')

// Gzip budget (bytes) per entry's local closure. The zero-dep root is the tight
// one (≤ 6 KB); the rest get generous caps that still catch accidental bloat.
const BUDGETS = {
  'index.js': 6 * 1024,
  'protocol.js': 4 * 1024,
  'schemas.js': 6 * 1024,
  'tools.js': 8 * 1024,
  'ai-sdk.js': 8 * 1024,
  'react.js': 10 * 1024,
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

let failed = false
for (const [entry, budget] of Object.entries(BUDGETS)) {
  if (!existsSync(join(DIST, entry))) {
    console.error(`✗ ${entry}: missing from dist (run \`npm run build\` first)`)
    failed = true
    continue
  }
  const size = gzipBytes(closureOf(entry))
  const ok = size <= budget
  console.log(`${ok ? '✓' : '✗'} ${entry}: ${size} B gzip (budget ${budget} B)`)
  if (!ok) {
    failed = true
  }
}
process.exit(failed ? 1 : 0)
