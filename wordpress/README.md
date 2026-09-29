# Wordpress Plugin

Plugin page: https://wordpress.org/plugins/simplepdf-embed

The plugin is published to the Wordpress SVN registry https://plugins.svn.wordpress.org/simplepdf-embed using `SVN`


## How to publish

Merging to `main` publishes. The **WordPress release** workflow (`.github/workflows/wordpress-release.yaml`) runs on every merge that changes `wordpress/svn/`:

1. `scripts/publish-wordpress-svn.sh` checks that the plugin header `Version`, `SIMPLEPDF_PLUGIN_VERSION` and the readme `Stable tag` agree, then:
   - a new Stable tag: syncs `trunk/` and `assets/` to WordPress.org SVN and copies `trunk` to `tags/<version>`
   - a Stable tag already published: syncs `assets/` and the readme only (in `trunk/` and `tags/<version>/`); the code of a published tag never changes
2. Once WordPress.org serves the version (its import lags the commit by minutes), it creates the `wordpress@<version>` GitHub release and posts the `README.txt` changelog to Discord. A version already released on GitHub is never announced twice.

Every pull request touching `wordpress/` runs the same script as a dry run (the "publish preview" job) and lists what merging would send.

To release a new version:

1. Set `SIMPLEPDF_WEB_EMBED_VERSION` in [simplepdf-embed.php](./svn/trunk/simplepdf-embed.php) to the `@simplepdf/web-embed-pdf` version pinned in [package.json](./package.json) (CI fails on a mismatch), and run `npm run package-plugin`
2. Set the new version in the [simplepdf-embed.php](./svn/trunk/simplepdf-embed.php) header and `SIMPLEPDF_PLUGIN_VERSION`, the `Stable tag` of [README.txt](./svn/trunk/README.txt) and [blueprint.json](./svn/assets/blueprints/blueprint.json)
3. Add the changelog entry in [README.txt](./svn/trunk/README.txt): it is posted to Discord as written
4. Merge

Each published version is recorded as the `wordpress@<version>` GitHub release, on the commit it was published from; `svn/tags/` is not kept in git.

WordPress.org strips images from `README.txt`: show the plugin through `svn/assets/screenshot-N.png`, captioned under `== Screenshots ==`.

The SVN credentials (`SVN_USERNAME`, and the SVN password from WordPress.org > Profile > Account & Security as `SVN_PASSWORD`) live in the repository's `wordpress-org` environment, deployable from `main` only.

### Manual fallback

`svn/` is also the SVN working copy (its `.svn` is gitignored): git `main` stays the source of truth.

```bash
brew install svn
cd wordpress
# --force: svn/ already holds the git files; they stay as local changes. Older tags are not fetched.
svn checkout --force --depth immediates https://plugins.svn.wordpress.org/simplepdf-embed svn
cd svn && svn update --force --set-depth infinity trunk assets
git checkout -- .   # SVN may have written its own copies over the git files: git wins
svn status          # "?" = new file (svn add), "!" = removed file (svn rm)
svn cp trunk tags/<TAG>
svn commit -m 'Release <TAG>' --username bendersej
```

Never run `svn revert`: it replaces the git files with the last published version. Then run the **WordPress release** workflow by hand (`gh workflow run wordpress-release.yaml --repo SimplePDF/simplepdf-embed`) for the GitHub release and the Discord post.
