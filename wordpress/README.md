# Wordpress Plugin

Plugin page: https://wordpress.org/plugins/simplepdf-embed

The plugin is published to the Wordpress SVN registry https://plugins.svn.wordpress.org/simplepdf-embed using `SVN`


## How to publish
_Pre-requisites_
```
brew install svn
svn checkout https://plugins.svn.wordpress.org/simplepdf-embed svn
```

1. Update the version of `@simplepdf/web-embed-pdf` in [simplepdf-embed.php](./svn/trunk/simplepdf-embed.php) to the one specified in [package.json](./package.json):
```
wp_enqueue_script('simplepdf-web-embed-pdf', $script_src, array(), '<VERSION>', true);
```

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
svn commit -m 'Tagging version TAG>'
```
