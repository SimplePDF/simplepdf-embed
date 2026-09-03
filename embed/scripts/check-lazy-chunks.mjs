// Load guard for the chunks the built entries only import lazily, run after
// `npm run build`. ../../scripts/check-exports.mjs loads every public subpath, but a
// lazily-imported chunk is reached by no subpath, so a chunk that resolves but throws
// at load (in either module format) would fail in the consumer's browser, not in CI.

import { readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LAZY_CHUNKS } from './lazy-chunks.mjs'

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const require = createRequire(import.meta.url)

const results = []
for (const [prefix, { exportName }] of Object.entries(LAZY_CHUNKS)) {
  const chunks = readdirSync(DIST).filter((file) => file.startsWith(prefix) && /\.(js|cjs)$/.test(file))
  if (chunks.length === 0) {
    console.error(`✗ no ${prefix}* chunk in dist (run \`npm run build\` first)`)
    results.push(false)
    continue
  }
  for (const chunk of chunks) {
    const path = join(DIST, chunk)
    try {
      const loaded = chunk.endsWith('.cjs') ? require(path) : await import(path)
      if (typeof loaded[exportName] !== 'function') {
        throw new Error(`${exportName} is not exported`)
      }
      console.log(`✓ ${chunk}`)
      results.push(true)
    } catch (error) {
      console.error(`✗ ${chunk}: ${error.code ? `${error.code}: ` : ''}${error.message}`)
      results.push(false)
    }
  }
}
process.exit(results.every(Boolean) ? 0 : 1)
