#!/usr/bin/env bash
# Publishes wordpress/svn (git main is the source) to the WordPress.org SVN repository.
# - A new Stable tag: trunk/ and assets/ are synced, trunk is copied to tags/<version>, one commit.
# - A Stable tag already published: only assets/ and the readme (trunk/ and tags/<version>/) are synced, since
#   WordPress.org reads the description from the tag; the code of a published tag never changes.
# Usage (the WordPress release workflow): SVN_USERNAME=… SVN_PASSWORD=… scripts/publish-wordpress-svn.sh
# DRY_RUN=1 stops before the commit and prints what would be sent; it needs no credentials.
# Writes `version=<version>` to $GITHUB_OUTPUT when set.
set -euo pipefail

readonly EXIT_SUCCESS=0
readonly EXIT_VERSION_MISMATCH=2
readonly EXIT_MISSING_CREDENTIALS=3

readonly SVN_URL="https://plugins.svn.wordpress.org/simplepdf-embed"
readonly SOURCE_DIR="$(cd "$(dirname "$0")/../wordpress/svn" && pwd)"
readonly WORKING_COPY="$(mktemp -d)"
trap 'rm -rf "$WORKING_COPY"' EXIT

stable_tag="$(sed -n 's/^Stable tag:[[:space:]]*//p' "$SOURCE_DIR/trunk/README.txt" | tr -d '[:space:]')"
header_version="$(sed -n 's/^Version:[[:space:]]*//p' "$SOURCE_DIR/trunk/simplepdf-embed.php" | tr -d '[:space:]')"
constant_version="$(sed -n "s/^define('SIMPLEPDF_PLUGIN_VERSION', '\(.*\)');/\1/p" "$SOURCE_DIR/trunk/simplepdf-embed.php")"
if [ -z "$stable_tag" ] || [ "$stable_tag" != "$header_version" ] || [ "$stable_tag" != "$constant_version" ]; then
  echo "Version mismatch: Stable tag '$stable_tag', plugin header '$header_version', SIMPLEPDF_PLUGIN_VERSION '$constant_version'" >&2
  exit "$EXIT_VERSION_MISMATCH"
fi
if [ -n "${GITHUB_OUTPUT:-}" ]; then
  echo "version=$stable_tag" >> "$GITHUB_OUTPUT"
fi

svn checkout --quiet --non-interactive --depth immediates "$SVN_URL" "$WORKING_COPY"
svn update --quiet --non-interactive --set-depth infinity "$WORKING_COPY/trunk" "$WORKING_COPY/assets"

if svn ls --non-interactive "$SVN_URL/tags/$stable_tag" > /dev/null 2>&1; then
  echo "$stable_tag is already on WordPress.org: syncing the readme and the listing assets only"
  svn update --quiet --non-interactive --set-depth infinity "$WORKING_COPY/tags/$stable_tag"
  rsync --archive --delete --exclude .svn "$SOURCE_DIR/assets/" "$WORKING_COPY/assets/"
  cp "$SOURCE_DIR/trunk/README.txt" "$WORKING_COPY/trunk/README.txt"
  cp "$SOURCE_DIR/trunk/README.txt" "$WORKING_COPY/tags/$stable_tag/README.txt"
  if ! diff -rq --exclude .svn --exclude README.txt "$SOURCE_DIR/trunk" "$WORKING_COPY/tags/$stable_tag" > /dev/null; then
    echo "::warning::The plugin code on main differs from the published $stable_tag: bump the version to publish it"
  fi
  commit_message="Listing: readme and assets for $stable_tag"
else
  echo "Publishing $stable_tag"
  rsync --archive --delete --exclude .svn "$SOURCE_DIR/trunk/" "$WORKING_COPY/trunk/"
  rsync --archive --delete --exclude .svn "$SOURCE_DIR/assets/" "$WORKING_COPY/assets/"
  commit_message="Release $stable_tag"
fi

cd "$WORKING_COPY"
svn status | awk '$1 == "?" { print $2 }' | while read -r added_path; do svn add --quiet --parents "$added_path"; done
svn status | awk '$1 == "!" { print $2 }' | while read -r removed_path; do svn rm --quiet "$removed_path"; done
if ! svn ls --non-interactive "$SVN_URL/tags/$stable_tag" > /dev/null 2>&1; then
  svn cp --quiet trunk "tags/$stable_tag"
fi

pending_changes="$(svn status)"
if [ -z "$pending_changes" ]; then
  echo "Nothing to publish: WordPress.org already matches main"
  exit "$EXIT_SUCCESS"
fi
echo "$pending_changes" | grep -v "^A  *+\{0,1\} *tags/$stable_tag/" || true

if [ "${DRY_RUN:-}" = "1" ]; then
  echo "DRY_RUN: stopping before the commit ('$commit_message')"
  exit "$EXIT_SUCCESS"
fi
if [ -z "${SVN_USERNAME:-}" ] || [ -z "${SVN_PASSWORD:-}" ]; then
  echo "SVN_USERNAME and SVN_PASSWORD are required to publish" >&2
  exit "$EXIT_MISSING_CREDENTIALS"
fi

svn commit --quiet --non-interactive --no-auth-cache --username "$SVN_USERNAME" --password "$SVN_PASSWORD" \
  -m "$commit_message (${GITHUB_SHA:-local})"
echo "Committed '$commit_message' to WordPress.org"
