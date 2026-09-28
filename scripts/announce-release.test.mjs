import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildReleaseMessage, hasNotableChanges, parseChangelogSection } from './announce-release.mjs'

const CHANGELOG = `# @simplepdf/web-embed-pdf

## 1.9.0

### Minor Changes

- 6662d44: **Your pages are ready for AI agents.** An agent can fill the form.

  - More PDF links open in SimplePDF.
  - Japanese and Dutch pages open the editor in their language.

### Patch Changes

- Updated dependencies [06a5946]
  - @simplepdf/embed@0.7.0

## 1.8.4

### Patch Changes

- 1234567: An older fix.
`

const WEB_PACKAGE = {
  name: '@simplepdf/web-embed-pdf',
  version: '1.9.0',
  license: 'MIT',
  unpkg: 'dist/index.min.js',
  repository: { directory: 'web' },
}
const REPOSITORY_URL = 'https://github.com/SimplePDF/simplepdf-embed'

test('reads one version section, without commit hashes, keeping nested lines', () => {
  const sections = parseChangelogSection({ changelog: CHANGELOG, version: '1.9.0' })

  assert.deepEqual(sections['Minor Changes'], [
    '**Your pages are ready for AI agents.** An agent can fill the form.\n\n- More PDF links open in SimplePDF.\n- Japanese and Dutch pages open the editor in their language.',
  ])
  assert.equal(sections['Patch Changes'].length, 1)
  assert.equal(JSON.stringify(sections).includes('An older fix'), false)
  assert.equal(parseChangelogSection({ changelog: CHANGELOG, version: '9.9.9' }), null)
})

test('a release that only updated dependencies has nothing to announce', () => {
  const dependencyOnly = parseChangelogSection({
    changelog: '## 1.13.1\n\n### Patch Changes\n\n- Updated dependencies [abc1234]\n  - @simplepdf/embed@0.7.1\n',
    version: '1.13.1',
  })

  assert.equal(hasNotableChanges(dependencyOnly), false)
  assert.equal(hasNotableChanges(parseChangelogSection({ changelog: CHANGELOG, version: '1.9.0' })), true)
})

test('the message links the release, installs the script tag, never pings, and drops dependency noise', () => {
  const sections = parseChangelogSection({ changelog: CHANGELOG, version: '1.9.0' })
  const message = buildReleaseMessage({ packageJson: WEB_PACKAGE, sections, repositoryUrl: REPOSITORY_URL, alsoReleased: [] })
  const [embed] = message.embeds

  assert.deepEqual(message.allowed_mentions, { parse: [] })
  assert.equal(embed.title, '@simplepdf/web-embed-pdf 1.9.0')
  assert.equal(embed.url, `${REPOSITORY_URL}/releases/tag/%40simplepdf%2Fweb-embed-pdf%401.9.0`)
  assert.equal(embed.color, 0x3665e1)
  assert.match(embed.description, /^\*\*What's new\*\*\n- \*\*Your pages are ready for AI agents\.\*\*/)
  assert.match(embed.description, /\n  - More PDF links open in SimplePDF\./)
  assert.equal(embed.description.includes('Updated dependencies'), false)
  assert.match(embed.fields[0].value, /<script src="https:\/\/unpkg\.com\/@simplepdf\/web-embed-pdf" defer><\/script>/)
  assert.match(embed.fields[0].value, /npm install @simplepdf\/web-embed-pdf@1\.9\.0/)
  assert.match(embed.fields[1].value, /\[Docs\]\(https:\/\/github\.com\/SimplePDF\/simplepdf-embed\/tree\/main\/web#readme\)/)
})

test('a package without a script tag build only shows the npm install, and breaking releases turn red', () => {
  const reactPackage = { ...WEB_PACKAGE, name: '@simplepdf/react-embed-pdf', version: '2.0.0', unpkg: undefined, repository: { directory: 'react' } }
  const sections = { 'Major Changes': ['`companyIdentifier` is renamed.'] }
  const message = buildReleaseMessage({ packageJson: reactPackage, sections, repositoryUrl: REPOSITORY_URL, alsoReleased: ['@simplepdf/embed 0.8.1 (dependency updates)'] })
  const [embed] = message.embeds

  assert.equal(embed.color, 0xcc2222)
  assert.match(embed.description, /^\*\*Breaking changes\*\*/)
  assert.equal(embed.fields[0].value.includes('<script'), false)
  assert.deepEqual(embed.fields[2], { name: 'Also released', value: '@simplepdf/embed 0.8.1 (dependency updates)' })
})

test('long notes are cut at an entry boundary, in order, and point to the full release notes', () => {
  const longEntry = (label) => `${label} ${'detail '.repeat(150)}`.trim()
  const sections = {
    'Minor Changes': [longEntry('first'), longEntry('second'), longEntry('third'), longEntry('fourth')],
    'Patch Changes': ['short fix'],
  }
  const { description } = buildReleaseMessage({ packageJson: WEB_PACKAGE, sections, repositoryUrl: REPOSITORY_URL, alsoReleased: [] }).embeds[0]

  assert.ok(description.length <= 4096)
  assert.match(description, /- first /)
  assert.equal(description.includes('short fix'), false)
  assert.match(description, /…and \d+ more in the \[full release notes\]\(/)
})
