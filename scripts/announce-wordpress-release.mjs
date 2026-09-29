// Records a WordPress plugin release on GitHub and posts it to the Discord releases channel, from the changelog in
// README.txt. The plugin ships through WordPress.org SVN, which GitHub never sees: the "WordPress release" workflow is
// run by hand after the SVN commit. It refuses to run until WordPress.org serves the Stable tag, and the GitHub release
// (`wordpress@<version>`) is the record that the version was announced, so a second run posts nothing.
// Usage: DISCORD_RELEASES_WEBHOOK_URL=… GITHUB_TOKEN=… GITHUB_REPOSITORY=… GITHUB_SHA=… node scripts/announce-wordpress-release.mjs
// WAIT_FOR_LIVE_MINUTES=… polls WordPress.org once a minute until it serves the Stable tag (its import lags the SVN commit).
// Without DISCORD_RELEASES_WEBHOOK_URL, or with DRY_RUN=1, it prints the Discord message and the GitHub release instead.
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
  github_unreachable: 7,
  github_rejected_release: 8,
}

const PLUGIN_URL = 'https://wordpress.org/plugins/simplepdf-embed/'
const PLUGIN_INFO_URL = 'https://api.wordpress.org/plugins/info/1.2/?action=plugin_information&slug=simplepdf-embed'
const SOURCE_URL = 'https://github.com/SimplePDF/simplepdf-embed/tree/main/wordpress'
const GITHUB_API_URL = 'https://api.github.com'

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

// make_latest is off: the "Latest" badge stays on the SDK packages' releases.
export const buildGitHubRelease = ({ version, entries, commitSha }) => ({
  tag_name: `wordpress@${version}`,
  target_commitish: commitSha,
  name: `SimplePDF Embed for WordPress ${version}`,
  body: ["## What's new", '', ...entries.map((entry) => `- ${entry}`), '', `[WordPress.org plugin page](${PLUGIN_URL})`].join('\n'),
  make_latest: 'false',
})

const githubRequest = ({ token, repository, method, pathname, body }) =>
  fetch(`${GITHUB_API_URL}/repos/${repository}${pathname}`, {
    method,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'x-github-api-version': '2022-11-28',
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })

// 'exists' | 'missing', or null when GitHub cannot say.
const findGitHubRelease = async ({ token, repository, tagName }) => {
  try {
    const response = await githubRequest({ token, repository, method: 'GET', pathname: `/releases/tags/${encodeURIComponent(tagName)}` })
    if (response.status === 404) {
      return 'missing'
    }
    return response.ok ? 'exists' : null
  } catch {
    return null
  }
}

const createGitHubRelease = async ({ token, repository, release }) => {
  const response = await githubRequest({ token, repository, method: 'POST', pathname: '/releases', body: release })
  return response.ok ? null : `${response.status} ${await response.text()}`
}

const LIVE_VERSION_POLL_MS = 60_000

const waitForLiveVersion = async ({ version, minutes }) => {
  const deadline = Date.now() + minutes * 60_000
  const liveVersion = await fetchLiveVersion()
  if (liveVersion === version || Date.now() >= deadline) {
    return liveVersion
  }
  console.log(`WordPress.org serves ${liveVersion ?? 'nothing yet'}, waiting for ${version}…`)
  await new Promise((resolve) => setTimeout(resolve, LIVE_VERSION_POLL_MS))
  return waitForLiveVersion({ version, minutes: (deadline - Date.now()) / 60_000 })
}

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
  const githubRelease = buildGitHubRelease({ ...release, commitSha: process.env.GITHUB_SHA ?? 'main' })
  const webhookUrl = process.env.DISCORD_RELEASES_WEBHOOK_URL
  if (webhookUrl === undefined || webhookUrl === '' || process.env.DRY_RUN === '1') {
    console.log(JSON.stringify({ discord: message, github: githubRelease }, null, 2))
    return EXIT_CODES.success
  }

  const liveVersion = await waitForLiveVersion({ version: release.version, minutes: Number(process.env.WAIT_FOR_LIVE_MINUTES ?? 0) })
  if (liveVersion === null) {
    console.error(`Could not read the live version from ${PLUGIN_INFO_URL}`)
    return EXIT_CODES.wordpress_org_unreachable
  }
  if (liveVersion !== release.version) {
    console.error(`WordPress.org serves ${liveVersion}, not ${release.version}: commit the SVN tag first, then run this again`)
    return EXIT_CODES.not_live_on_wordpress_org
  }

  const github = { token: process.env.GITHUB_TOKEN ?? '', repository: process.env.GITHUB_REPOSITORY ?? 'SimplePDF/simplepdf-embed' }
  const existingRelease = await findGitHubRelease({ ...github, tagName: githubRelease.tag_name })
  if (existingRelease === null) {
    console.error(`Could not check GitHub for the ${githubRelease.tag_name} release`)
    return EXIT_CODES.github_unreachable
  }
  if (existingRelease === 'exists') {
    console.log(`${githubRelease.tag_name} is already released and announced: nothing to do`)
    return EXIT_CODES.success
  }

  const failure = await postToDiscord({ webhookUrl, message })
  if (failure !== null) {
    console.error(`Discord rejected the announcement for ${release.version}: ${failure}`)
    return EXIT_CODES.discord_rejected_message
  }
  console.log(`Announced SimplePDF Embed for WordPress ${release.version}`)

  const releaseFailure = await createGitHubRelease({ ...github, release: githubRelease })
  if (releaseFailure !== null) {
    console.error(`Announced on Discord, but GitHub rejected the ${githubRelease.tag_name} release (create it by hand so a rerun does not post again): ${releaseFailure}`)
    return EXIT_CODES.github_rejected_release
  }
  console.log(`Released ${githubRelease.tag_name} on GitHub`)
  return EXIT_CODES.success
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(await main())
}
