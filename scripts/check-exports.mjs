// Export-load guard, shared by the workspace packages. Loads every public subpath of a
// built package per its export conditions (require + import), so an entry that resolves
// but throws at load (e.g. a CJS bundle requiring an ESM-only peer) fails CI, not the
// consumer. Run after that package's build.
//
//   node ../scripts/check-exports.mjs <packageDir>   (defaults to the cwd)

import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const packageDir = resolve(process.argv[2] ?? '.')
const pkg = JSON.parse(readFileSync(resolve(packageDir, 'package.json'), 'utf8'))
const require = createRequire(import.meta.url)
const load = { require: (spec) => require(spec), import: (spec) => import(spec) }

const results = []
for (const [subpath, conditions] of Object.entries(pkg.exports)) {
  const spec = subpath === '.' ? pkg.name : `${pkg.name}/${subpath.slice(2)}`
  for (const condition of ['require', 'import']) {
    if (conditions[condition] === undefined) {
      continue
    }
    try {
      await load[condition](spec)
      console.log(`✓ ${spec} [${condition}]`)
      results.push(true)
    } catch (error) {
      console.error(`✗ ${spec} [${condition}]: ${error.code ?? error.message}`)
      results.push(false)
    }
  }
}

process.exit(results.every(Boolean) ? 0 : 1)
