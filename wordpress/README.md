# Wordpress Plugin

Plugin page: https://wordpress.org/plugins/simplepdf-embed

The plugin is published to the Wordpress SVN registry https://plugins.svn.wordpress.org/simplepdf-embed using `SVN`


## How to publish

`svn/` is both the git folder and the WordPress.org SVN working copy (its `.svn` is gitignored). Git `main` is the source of truth: publish from `main`, and SVN only carries it to WordPress.org.

_Pre-requisites (once per clone)_
```bash
brew install svn
cd wordpress
# --force: svn/ already holds the git files; they stay as local changes. Older tags are not fetched.
svn checkout --force --depth immediates https://plugins.svn.wordpress.org/simplepdf-embed svn
cd svn && svn update --force --set-depth infinity trunk assets
git checkout -- .   # SVN may have written its own copies over the git files: git wins
```
Never run `svn revert`: it replaces the git files with the last published version. To discard a change, restore from git.

1. Set `SIMPLEPDF_WEB_EMBED_VERSION` in [simplepdf-embed.php](./svn/trunk/simplepdf-embed.php) to the `@simplepdf/web-embed-pdf` version pinned in [package.json](./package.json) (CI fails on a mismatch)
2. Update the TAG / version in [simplepdf-embed.php](./svn/trunk/simplepdf-embed.php)
3. Update the TAG / version in [README.txt](./svn/trunk/README.txt)
4. Update the TAG / version in [blueprint.json](./svn/assets/blueprints/blueprint.json)
5. Update changelog in [README.txt](./svn/trunk/README.txt)
   WordPress.org strips images from `README.txt`: show the plugin through `svn/assets/screenshot-N.png`, captioned under `== Screenshots ==`. It reads the description from the Stable tag's folder, so a readme fix after release goes in both `trunk/` and `tags/<TAG>/`.
6. Merge to `main`, check it out, then run the following

```bash
npm run package-plugin
cd svn
svn update
svn status                          # "?" = new file, "!" = removed file
svn add <each new file in trunk/ or assets/>
svn rm <each removed file>
svn cp trunk tags/<TAG>
svn commit -m 'Release <TAG>' --username bendersej   # the SVN password from WordPress.org > Profile > Account & Security
```
Leave the older `tags/*` folders git tracks out of `svn add`: they already exist on WordPress.org.

7. Once https://wordpress.org/plugins/simplepdf-embed/ shows the new version, run the **WordPress release** workflow (`gh workflow run wordpress-release.yaml --repo SimplePDF/simplepdf-embed`). It creates the `wordpress@<TAG>` GitHub release and posts the `README.txt` changelog for the Stable tag to Discord. It refuses to run until WordPress.org serves that version, and does nothing when the GitHub release already exists.
8. Commit the new `svn/tags/<TAG>/` to git.
