// Posts a WordPress plugin release to the Discord releases channel, from the changelog in README.txt.
// The plugin ships through WordPress.org SVN, which GitHub never sees: the "WordPress release" workflow is run by
// hand after the SVN commit, and this script refuses to post until WordPress.org serves the Stable tag.
// Usage: DISCORD_RELEASES_WEBHOOK_URL=… node scripts/announce-wordpress-release.mjs (DRY_RUN=1 prints the message)
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { BRAND_BLUE, LOGO_URL, postToDiscord } from './announce-release.mjs'

export const EXIT_CODES = {
  success: 0,
  stable_tag_not_found: 2,
  changelog_section_not_found: 3,
  discord_rejected_message: 4,
  wordpress_org_unreachable: 5,
  not_live_on_wordpress_org: 6,
}

const PLUGIN_URL = 'https://wordpress.org/plugins/simplepdf-embed/'
const PLUGIN_INFO_URL = 'https://api.wordpress.org/plugins/info/1.2/?action=plugin_information&slug=simplepdf-embed'
const SOURCE_URL = 'https://github.com/SimplePDF/simplepdf-embed/tree/main/wordpress'

// The Stable tag and its `= <version> =` changelog bullets, or null without a Stable tag.
export const parseReadme = (readme) => {
  const version = /^Stable tag:\s*(\S+)\s*$/m.exec(readme)?.[1] ?? null
  if (version === null) {
    return null
  }

  const lines = readme.split('\n')
  const changelogStart = lines.findIndex((line) => line.trim() === '== Changelog ==')
  const versionStart = lines.findIndex((line, index) => index > changelogStart && line.trim() === `= ${version} =`)
  if (changelogStart === -1 || versionStart === -1) {
    return { version, entries: [] }
  }

  const sectionLines = lines.slice(versionStart + 1)
  const end = sectionLines.findIndex((line) => line.trim().startsWith('='))
  const entries = (end === -1 ? sectionLines : sectionLines.slice(0, end))
    .filter((line) => line.startsWith('* '))
    .map((line) => line.slice(2).trim())

  return { version, entries }
}

export const buildWordPressReleaseMessage = ({ version, entries }) => ({
  username: 'SimplePDF Releases',
  avatar_url: LOGO_URL,
  allowed_mentions: { parse: [] },
  embeds: [
    {
      title: `SimplePDF Embed for WordPress ${version}`,
      url: PLUGIN_URL,
      color: BRAND_BLUE,
      description: ["**What's new**", ...entries.map((entry) => `- ${entry}`)].join('\n'),
      fields: [
        {
          name: 'Get started',
          value: 'New site: Plugins > Add New, search for "SimplePDF Embed".\nAlready installed: update from Dashboard > Updates.',
        },
        { name: 'Links', value: `[Plugin page](${PLUGIN_URL}) · [Changelog](${PLUGIN_URL}#developers) · [Source](${SOURCE_URL})` },
      ],
      footer: { text: 'SimplePDF · GPLv2 or later', icon_url: LOGO_URL },
      timestamp: new Date().toISOString(),
    },
  ],
})

const fetchLiveVersion = async () => {
  try {
    const response = await fetch(PLUGIN_INFO_URL)
    const pluginInfo = response.ok ? await response.json() : null
    return typeof pluginInfo?.version === 'string' ? pluginInfo.version : null
  } catch {
    return null
  }
}

const main = async () => {
  const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
  const readme = await readFile(path.join(rootDir, 'wordpress/svn/trunk/README.txt'), 'utf8')
  const release = parseReadme(readme)
  if (release === null) {
    console.error('wordpress/svn/trunk/README.txt has no Stable tag')
    return EXIT_CODES.stable_tag_not_found
  }
  if (release.entries.length === 0) {
    console.error(`README.txt has no "= ${release.version} =" changelog entries`)
    return EXIT_CODES.changelog_section_not_found
  }

  const message = buildWordPressReleaseMessage(release)
  const webhookUrl = process.env.DISCORD_RELEASES_WEBHOOK_URL
  if (webhookUrl === undefined || webhookUrl === '' || process.env.DRY_RUN === '1') {
    console.log(JSON.stringify(message, null, 2))
    return EXIT_CODES.success
  }

  const liveVersion = await fetchLiveVersion()
  if (liveVersion === null) {
    console.error(`Could not read the live version from ${PLUGIN_INFO_URL}`)
    return EXIT_CODES.wordpress_org_unreachable
  }
  if (liveVersion !== release.version) {
    console.error(`WordPress.org serves ${liveVersion}, not ${release.version}: commit the SVN tag first, then run this again`)
    return EXIT_CODES.not_live_on_wordpress_org
  }

  const failure = await postToDiscord({ webhookUrl, message })
  if (failure !== null) {
    console.error(`Discord rejected the announcement for ${release.version}: ${failure}`)
    return EXIT_CODES.discord_rejected_message
  }
  console.log(`Announced SimplePDF Embed for WordPress ${release.version}`)
  return EXIT_CODES.success
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(await main())
}
