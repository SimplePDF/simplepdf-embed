// Contract-freshness guard + fixer. The committed embed-api.json is a PIN of the
// manifest served at /embed/json; everything in src/generated/ derives from it. The pin
// must strictly equal the live manifest (editor_version excluded — injected per deploy
// at the serve boundary): a drifted pin means the SDK is generated from a contract the
// editor no longer serves.
//
//   check (default): `npm run check:contract` — fails when the pin is out of date.
//   fix:             `npm run fix:contract`   — re-syncs the pin from the live manifest
//                    (prettier-formatted to keep diffs minimal) and regenerates
//                    src/generated/; review the diff and commit both.

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual } from 'node:util'

const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PIN_PATH = join(PKG_ROOT, 'embed-api.json')

// Overridable so the pin can be checked / synced against a staging / local editor.
const CONTRACT_URL = process.env.EMBED_CONTRACT_URL ?? 'https://simplepdf.com/embed/json'

const EXIT_CODES = {
  stale_pin: 1,
  manifest_fetch_failed: 2,
}

const isFixMode = process.argv.includes('--fix')

const withoutEditorVersion = ({ editor_version: _editorVersion, ...manifest }) => manifest

const fetchLiveManifest = async () => {
  try {
    const manifestResponse = await fetch(CONTRACT_URL)
    if (!manifestResponse.ok) {
      throw new Error(`unexpected response status ${manifestResponse.status}`)
    }
    return await manifestResponse.json()
  } catch (error) {
    console.error(`contract: failed to fetch the live manifest from ${CONTRACT_URL}: ${error.message}`)
    process.exit(EXIT_CODES.manifest_fetch_failed)
  }
}

const liveManifest = await fetchLiveManifest()

if (isFixMode) {
  writeFileSync(PIN_PATH, `${JSON.stringify(liveManifest, null, 2)}\n`)
  // The repo-pinned prettier, so the committed pin formatting stays byte-stable
  // across syncs and the next diff shows only real contract changes.
  execFileSync(join(PKG_ROOT, '..', 'node_modules', '.bin', 'prettier'), ['--write', PIN_PATH], { stdio: 'inherit' })
  execFileSync('node', [join(PKG_ROOT, 'scripts', 'generate.mjs')], { cwd: PKG_ROOT, stdio: 'inherit' })
  console.log(
    `fix:contract: pin re-synced to ${CONTRACT_URL} (editor_version: ${liveManifest.editor_version}) — review the diff and commit embed-api.json + src/generated/`,
  )
  process.exit(0)
}

const pinnedManifest = withoutEditorVersion(JSON.parse(readFileSync(PIN_PATH, 'utf8')))
const comparableLiveManifest = withoutEditorVersion(liveManifest)

if (isDeepStrictEqual(pinnedManifest, comparableLiveManifest)) {
  console.log(`check:contract: pin matches the live manifest at ${CONTRACT_URL}`)
  process.exit(0)
}

// Section-level hints so the failure is actionable without eyeballing two full JSONs.
const driftedSections = Object.keys({ ...pinnedManifest, ...comparableLiveManifest }).filter(
  (section) => !isDeepStrictEqual(pinnedManifest[section], comparableLiveManifest[section]),
)

const operationHints = (() => {
  const pinnedOperations = new Map(
    (pinnedManifest.operations ?? []).map((operation) => [operation.request_type, operation]),
  )
  const liveOperations = new Map(
    (comparableLiveManifest.operations ?? []).map((operation) => [operation.request_type, operation]),
  )
  const requestTypes = new Set([...pinnedOperations.keys(), ...liveOperations.keys()])
  return [...requestTypes].flatMap((requestType) => {
    const pinnedOperation = pinnedOperations.get(requestType)
    const liveOperation = liveOperations.get(requestType)
    if (pinnedOperation === undefined) return [`operation ${requestType}: live only (missing from the pin)`]
    if (liveOperation === undefined) return [`operation ${requestType}: pin only (no longer served)`]
    if (isDeepStrictEqual(pinnedOperation, liveOperation)) return []
    return [`operation ${requestType}: differs`]
  })
})()

console.error(`check:contract: the committed embed-api.json pin is out of date with ${CONTRACT_URL}`)
console.error(`  drifted sections: ${driftedSections.join(', ')}`)
for (const hint of operationHints) {
  console.error(`  - ${hint}`)
}
console.error('Run `npm run fix:contract` to re-sync, then commit embed-api.json + src/generated/.')
process.exit(EXIT_CODES.stale_pin)
