// Posts the packages a release just published to the Discord releases channel: one message per
// package with changes, built from the section changesets wrote into its CHANGELOG.md.
// Usage (the release workflow): PUBLISHED_PACKAGES='[{"name":"…","version":"…"}]' DISCORD_RELEASES_WEBHOOK_URL=… node scripts/announce-release.mjs
// Without DISCORD_RELEASES_WEBHOOK_URL, or with DRY_RUN=1, it prints the messages instead of posting them.
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const EXIT_CODES = {
  success: 0,
  invalid_published_packages: 2,
  changelog_section_not_found: 3,
  discord_rejected_message: 4,
}

const BRAND_BLUE = 0x3665e1
const BREAKING_RED = 0xcc2222
const LOGO_URL = 'https://simplepdf.com/android-chrome-512x512.png'
// Discord caps an embed description at 4096 characters; the headroom keeps the closing link line.
const DESCRIPTION_LIMIT = 3800

const SECTION_TITLES = {
  'Major Changes': 'Breaking changes',
  'Minor Changes': "What's new",
  'Patch Changes': 'Fixes and improvements',
}

// The `## <version>` section of a changesets CHANGELOG, as { sectionTitle: entries[] }.
export const parseChangelogSection = ({ changelog, version }) => {
  const heading = `## ${version}`
  const start = changelog.split('\n').findIndex((line) => line.trim() === heading)
  if (start === -1) {
    return null
  }

  const lines = changelog.split('\n').slice(start + 1)
  const end = lines.findIndex((line) => line.startsWith('## '))
  const sectionLines = end === -1 ? lines : lines.slice(0, end)

  const sections = {}
  const state = { title: null, entry: null }
  const closeEntry = () => {
    if (state.title !== null && state.entry !== null) {
      sections[state.title].push(state.entry.join('\n').trim())
    }
    state.entry = null
  }

  for (const line of sectionLines) {
    const sectionMatch = /^### (.+)$/.exec(line)
    if (sectionMatch !== null) {
      closeEntry()
      state.title = sectionMatch[1].trim()
      sections[state.title] = sections[state.title] ?? []
      continue
    }
    const entryMatch = /^- (?:[0-9a-f]{7,40}: )?(.*)$/.exec(line)
    if (entryMatch !== null) {
      closeEntry()
      state.entry = [entryMatch[1]]
      continue
    }
    if (state.entry !== null) {
      state.entry.push(line.startsWith('  ') ? line.slice(2) : line)
    }
  }
  closeEntry()

  return sections
}

const isDependencyUpdate = (entry) => entry.startsWith('Updated dependencies')

export const hasNotableChanges = (sections) =>
  Object.values(sections).some((entries) => entries.some((entry) => !isDependencyUpdate(entry)))

const toBulletedEntry = (entry) => {
  const [firstLine, ...rest] = entry.split('\n')
  const indentedRest = rest.map((line) => (line === '' ? '' : `  ${line}`))
  return [`- ${firstLine}`, ...indentedRest].join('\n')
}

const buildDescription = ({ sections, releaseUrl }) => {
  const blocks = Object.entries(SECTION_TITLES).flatMap(([changesetTitle, title]) => {
    const entries = (sections[changesetTitle] ?? []).filter((entry) => !isDependencyUpdate(entry))
    return entries.length === 0 ? [] : [{ title, entries }]
  })

  // A section with one entry reads as a paragraph (its own bullets become the list); several
  // entries read as a list.
  const additions = blocks.flatMap((block) =>
    block.entries.map((entry, index) =>
      [...(index === 0 ? [`**${block.title}**`] : []), block.entries.length === 1 ? entry : toBulletedEntry(entry)].join('\n'),
    ),
  )
  // Entries are cut at an entry boundary, in order: once one does not fit, the rest go to the link.
  const firstOverflow = additions.findIndex(
    (_addition, index) => additions.slice(0, index + 1).join('\n\n').length > DESCRIPTION_LIMIT,
  )
  const lines = firstOverflow === -1 ? additions : additions.slice(0, firstOverflow)
  const counts = { shown: lines.length, total: additions.length }

  const hidden = counts.total - counts.shown
  return hidden > 0
    ? [...lines, `…and ${hidden} more in the [full release notes](${releaseUrl}).`].join('\n\n')
    : lines.join('\n\n')
}

const buildGetStarted = (packageJson) => {
  const install = `\`\`\`sh\nnpm install ${packageJson.name}@${packageJson.version}\n\`\`\``
  if (packageJson.unpkg === undefined) {
    return install
  }
  const scriptTag = `\`\`\`html\n<script src="https://unpkg.com/${packageJson.name}" defer></script>\n\`\`\``
  return `${scriptTag}\n${install}`
}

export const buildReleaseMessage = ({ packageJson, sections, repositoryUrl, alsoReleased }) => {
  const tag = `${packageJson.name}@${packageJson.version}`
  const releaseUrl = `${repositoryUrl}/releases/tag/${encodeURIComponent(tag)}`
  const docsUrl = `${repositoryUrl}/tree/main/${packageJson.repository.directory}#readme`
  const npmUrl = `https://www.npmjs.com/package/${packageJson.name}/v/${packageJson.version}`
  const isBreaking = (sections['Major Changes'] ?? []).length > 0

  const fields = [
    { name: 'Get started', value: buildGetStarted(packageJson) },
    { name: 'Links', value: `[Release notes](${releaseUrl}) · [npm](${npmUrl}) · [Docs](${docsUrl})` },
    ...(alsoReleased.length === 0 ? [] : [{ name: 'Also released', value: alsoReleased.join('\n') }]),
  ]

  return {
    username: 'SimplePDF Releases',
    avatar_url: LOGO_URL,
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: `${packageJson.name} ${packageJson.version}`,
        url: releaseUrl,
        color: isBreaking ? BREAKING_RED : BRAND_BLUE,
        description: buildDescription({ sections, releaseUrl }),
        fields,
        footer: { text: `SimplePDF · ${packageJson.license} license`, icon_url: LOGO_URL },
        timestamp: new Date().toISOString(),
      },
    ],
  }
}

const readWorkspacePackages = async (rootDir) => {
  const rootPackage = JSON.parse(await readFile(path.join(rootDir, 'package.json'), 'utf8'))
  const workspaces = await Promise.all(
    rootPackage.workspaces.map(async (workspace) => {
      const directory = path.join(rootDir, workspace)
      const packageJson = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'))
      return { directory, packageJson }
    }),
  )
  return new Map(workspaces.map((workspace) => [workspace.packageJson.name, workspace]))
}

const parsePublishedPackages = (value) => {
  try {
    const parsed = JSON.parse(value ?? '')
    const isValid =
      Array.isArray(parsed) &&
      parsed.every((item) => typeof item?.name === 'string' && typeof item?.version === 'string')
    return isValid ? parsed : null
  } catch {
    return null
  }
}

const postToDiscord = async ({ webhookUrl, message }) => {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(message),
  })
  return response.ok ? null : `${response.status} ${await response.text()}`
}

const main = async () => {
  const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
  const publishedPackages = parsePublishedPackages(process.env.PUBLISHED_PACKAGES)
  if (publishedPackages === null) {
    console.error(`PUBLISHED_PACKAGES is not a JSON list of { name, version }: ${process.env.PUBLISHED_PACKAGES}`)
    return EXIT_CODES.invalid_published_packages
  }

  const workspaces = await readWorkspacePackages(rootDir)
  const releases = []
  for (const { name, version } of publishedPackages) {
    const workspace = workspaces.get(name)
    const changelog = workspace === undefined ? '' : await readFile(path.join(workspace.directory, 'CHANGELOG.md'), 'utf8').catch(() => '')
    const sections = parseChangelogSection({ changelog, version })
    if (workspace === undefined || sections === null) {
      console.error(`No CHANGELOG section ## ${version} for ${name}`)
      return EXIT_CODES.changelog_section_not_found
    }
    releases.push({ packageJson: { ...workspace.packageJson, version }, sections })
  }

  const notable = releases.filter(({ sections }) => hasNotableChanges(sections))
  const dependencyOnly = releases
    .filter(({ sections }) => !hasNotableChanges(sections))
    .map(({ packageJson }) => `${packageJson.name} ${packageJson.version} (dependency updates)`)
  if (notable.length === 0) {
    console.log('Only dependency updates were published: nothing to announce.')
    return EXIT_CODES.success
  }

  const repositoryUrl = `https://github.com/${process.env.GITHUB_REPOSITORY ?? 'SimplePDF/simplepdf-embed'}`
  const messages = notable.map(({ packageJson, sections }, index) =>
    buildReleaseMessage({ packageJson, sections, repositoryUrl, alsoReleased: index === 0 ? dependencyOnly : [] }),
  )

  const webhookUrl = process.env.DISCORD_RELEASES_WEBHOOK_URL
  if (webhookUrl === undefined || webhookUrl === '' || process.env.DRY_RUN === '1') {
    console.log(JSON.stringify(messages, null, 2))
    return EXIT_CODES.success
  }

  for (const message of messages) {
    const failure = await postToDiscord({ webhookUrl, message })
    if (failure !== null) {
      console.error(`Discord rejected the announcement for ${message.embeds[0].title}: ${failure}`)
      return EXIT_CODES.discord_rejected_message
    }
    console.log(`Announced ${message.embeds[0].title}`)
  }
  return EXIT_CODES.success
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(await main())
}
