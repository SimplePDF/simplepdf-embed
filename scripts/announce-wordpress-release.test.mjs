import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { buildGitHubRelease, buildWordPressReleaseMessage, parseReadme } from './announce-wordpress-release.mjs'

const README = `=== SimplePDF Embed ===
Stable tag:        1.2.0

== Changelog ==

= 1.2.0 =
* New settings page
* Update web-embed-pdf to 1.9.0

= 1.1.3 =
* An older fix
`

test('reads the Stable tag and only its changelog entries', () => {
  assert.deepEqual(parseReadme(README), { version: '1.2.0', entries: ['New settings page', 'Update web-embed-pdf to 1.9.0'] })
  assert.equal(parseReadme('=== SimplePDF Embed ===\n'), null)
  assert.deepEqual(parseReadme(README.replace('= 1.2.0 =', '= 1.2.1 =')), { version: '1.2.0', entries: [] })
})

test('the committed readme has entries for its Stable tag', async () => {
  const readme = await readFile(new URL('../wordpress/svn/trunk/README.txt', import.meta.url), 'utf8')
  const release = parseReadme(readme)

  assert.notEqual(release, null)
  assert.ok(release.entries.length > 0)
})

test('the message links the plugin page, never pings, and lists every entry', () => {
  const message = buildWordPressReleaseMessage(parseReadme(README))
  const [embed] = message.embeds

  assert.deepEqual(message.allowed_mentions, { parse: [] })
  assert.equal(embed.title, 'SimplePDF Embed for WordPress 1.2.0')
  assert.equal(embed.url, 'https://wordpress.org/plugins/simplepdf-embed/')
  assert.equal(embed.description, "**What's new**\n- New settings page\n- Update web-embed-pdf to 1.9.0")
  assert.match(embed.fields[1].value, /\[Plugin page\]\(https:\/\/wordpress\.org\/plugins\/simplepdf-embed\/\)/)
})

test('the GitHub release is tagged wordpress@<version> on the workflow commit and never takes the Latest badge', () => {
  const githubRelease = buildGitHubRelease({ ...parseReadme(README), commitSha: 'abc1234' })

  assert.equal(githubRelease.tag_name, 'wordpress@1.2.0')
  assert.equal(githubRelease.target_commitish, 'abc1234')
  assert.equal(githubRelease.name, 'SimplePDF Embed for WordPress 1.2.0')
  assert.equal(githubRelease.make_latest, 'false')
  assert.match(githubRelease.body, /^## What's new\n\n- New settings page\n- Update web-embed-pdf to 1\.9\.0\n/)
})
