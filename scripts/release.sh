#!/bin/bash
set -e

# Release nuxt-spyglass: bump version, commit, tag, push.
# The GitHub Action (release.yml) then builds and publishes to npm.
#
# Usage:   ./scripts/release.sh <version>
# Example: ./scripts/release.sh 1.0.0-alpha.1

VERSION="$1"

usage() {
  echo "Usage: ./scripts/release.sh <version>"
  echo "Example: ./scripts/release.sh 1.0.0-alpha.1"
  exit 1
}

[ -z "$VERSION" ] && usage

# validate semver (allows pre-release suffixes like -alpha.1)
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-.+)?$ ]]; then
  echo "Error: version must be semver (e.g. 1.0.0 or 1.0.0-alpha.1)"
  exit 1
fi

# tracked changes block a release; untracked files (e.g. local playground bits) are fine
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "Error: working directory has uncommitted changes. Commit or stash them first."
  exit 1
fi

NPM_NAME=$(node -p "require('./package.json').name")
TAG="v$VERSION"

echo "Releasing $NPM_NAME v$VERSION (tag $TAG)"

# bump version in package.json
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.version = '$VERSION';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"

git add package.json
git commit -m "release: v$VERSION"
git tag "$TAG"

echo "Created commit and tag: $TAG"

# load a GH_TOKEN from .env if present (otherwise rely on the configured origin)
if [ -z "$GH_TOKEN" ] && [ -f .env ]; then
  source .env
fi

if [ -n "$GH_TOKEN" ]; then
  REMOTE="https://Flo0806:${GH_TOKEN}@github.com/Flo0806/nuxt-spyglass.git"
  git push "$REMOTE" HEAD:main
  git push "$REMOTE" "$TAG"
else
  git push origin HEAD:main
  git push origin "$TAG"
fi

echo ""
echo "Done! The GitHub Action will publish $NPM_NAME v$VERSION to npm."
