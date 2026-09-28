# Wordpress Plugin

Plugin page: https://wordpress.org/plugins/simplepdf-embed

The plugin is published to the Wordpress SVN registry https://plugins.svn.wordpress.org/simplepdf-embed using `SVN`


## How to publish
_Pre-requisites_
```
brew install svn
svn checkout https://plugins.svn.wordpress.org/simplepdf-embed svn
```

1. Set `SIMPLEPDF_WEB_EMBED_VERSION` in [simplepdf-embed.php](./svn/trunk/simplepdf-embed.php) to the `@simplepdf/web-embed-pdf` version pinned in [package.json](./package.json) (CI fails on a mismatch)

2. Update the TAG / version in [simplepdf-embed.php](./svn/trunk/simplepdf-embed.php)
3. Update the TAG / version in [README.txt](./svn/trunk/README.txt)
4. Update the TAG / version in [blueprint.json](./svn/assets/blueprints/blueprint.json)
5. Update changelog in [README.txt](./svn/trunk/README.txt)
6. Run the following

```bash
npm run package-plugin
cd svn
svn up
svn cp trunk tags/<TAG>
svn commit -m 'Tagging version <TAG>'
```

7. Once https://wordpress.org/plugins/simplepdf-embed/ shows the new version, announce it on Discord: run the **WordPress release** workflow (`gh workflow run wordpress-release.yaml --repo SimplePDF/simplepdf-embed`). It posts the `README.txt` changelog for the Stable tag, and refuses to post until WordPress.org serves that version.
