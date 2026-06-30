// Customer-facing API drift gate, shared by the workspace packages. For every public export
// subpath (those with a `types` entry), api-extractor rolls the chunked .d.ts up into a stable,
// reviewable etc/<entry>.api.md report; the committed report is diffed on every CI run. A change
// to any customer-facing type fails CI; an intentional change is re-blessed with
// UPDATE_API_SNAPSHOT=1.
//
// One run per entry (not a single namespaced barrel): api-extractor does not support wrapping a
// star-re-exporting module in a namespace, and a per-subpath report pinpoints what changed.
// Reused for every typed package, with no per-package config: a temporary api-extractor config
// is generated per entry from the package's own `exports`.
//
//   node ../scripts/check-api.mjs .                          (check, from a package dir)
//   UPDATE_API_SNAPSHOT=1 node ../scripts/check-api.mjs .    (re-bless an intentional change)

import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageDir = resolve(process.argv[2] ?? '.')
const pkg = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'))
const reBless = process.env.UPDATE_API_SNAPSHOT === '1'
const apiExtractor = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'node_modules/.bin/api-extractor')

// Only the public type surface matters; api-extractor's doc-tag policing is silenced.
const MESSAGES = {
  compilerMessageReporting: { default: { logLevel: 'warning' } },
  extractorMessageReporting: {
    default: { logLevel: 'warning' },
    'ae-missing-release-tag': { logLevel: 'none' },
    'ae-forgotten-export': { logLevel: 'none' },
    'ae-internal-missing-underscore': { logLevel: 'none' },
    'ae-unresolved-link': { logLevel: 'none' },
  },
  tsdocMessageReporting: { default: { logLevel: 'none' } },
}

const entries = Object.entries(pkg.exports)
  .filter(([, conditions]) => conditions.types !== undefined)
  .map(([subpath, conditions]) => ({
    subpath,
    name: basename(conditions.types).replace(/\.d\.ts$/, ''),
    types: conditions.types,
  }))
  .sort((a, b) => a.name.localeCompare(b.name))

mkdirSync(join(packageDir, 'etc'), { recursive: true })
mkdirSync(join(packageDir, 'tmp'), { recursive: true })

const checkEntry = (entry) => {
  const tempConfigPath = join(packageDir, 'tmp', `api-extractor.${entry.name}.json`)
  writeFileSync(
    tempConfigPath,
    JSON.stringify({
      projectFolder: packageDir,
      // api-extractor defaults to CRLF; force LF so the committed reports don't trip
      // git's whitespace gate or churn across platforms.
      newlineKind: 'lf',
      mainEntryPointFilePath: resolve(packageDir, entry.types),
      compiler: { tsconfigFilePath: resolve(packageDir, 'tsconfig.json') },
      apiReport: {
        enabled: true,
        reportFolder: resolve(packageDir, 'etc'),
        reportTempFolder: resolve(packageDir, 'tmp'),
        reportFileName: `${entry.name}.api.md`,
      },
      docModel: { enabled: false },
      dtsRollup: { enabled: false },
      tsdocMetadata: { enabled: false },
      messages: MESSAGES,
    }),
  )
  return (() => {
    try {
      execFileSync(apiExtractor, ['run', '-c', tempConfigPath, ...(reBless ? ['--local'] : [])], { stdio: 'inherit' })
      return true
    } catch {
      console.error(`✗ ${pkg.name} ${entry.subpath}: API drift or extraction error`)
      return false
    } finally {
      rmSync(tempConfigPath, { force: true })
    }
  })()
}

const drifted = entries.map((entry) => ({ entry, ok: checkEntry(entry) })).filter((result) => !result.ok)

if (drifted.length > 0) {
  console.error(
    `\n${drifted.length} entr${drifted.length === 1 ? 'y' : 'ies'} drifted or errored. Review the change; re-bless with UPDATE_API_SNAPSHOT=1 if intended.`,
  )
  process.exit(1)
}
console.log(`✓ ${pkg.name}: public API surface matches (${entries.length} entries)`)
