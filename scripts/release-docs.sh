#!/bin/bash
set -e

# Release the docs site: bump docs/package.json, commit, tag docs-v<version>, push.
# The GitHub Action (release-docs.yml) then builds and pushes the Docker image to
# ghcr.io/flo0806/nuxt-spyglass-docs. The npm module release (scripts/release.sh,
# tag v*) is independent - different tag namespace, different pipeline.
#
# Usage:   ./scripts/release-docs.sh <version>
# Example: ./scripts/release-docs.sh 0.1.0

VERSION="$1"

usage() {
  echo "Usage: ./scripts/release-docs.sh <version>"
  echo "Example: ./scripts/release-docs.sh 0.1.0"
  exit 1
}

[ -z "$VERSION" ] && usage

# validate semver (allows pre-release suffixes like -alpha.1)
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-.+)?$ ]]; then
  echo "Error: version must be semver (e.g. 0.1.0 or 0.1.0-alpha.1)"
  exit 1
fi

# tracked changes block a release; untracked files (e.g. local playground bits) are fine
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "Error: working directory has uncommitted changes. Commit or stash them first."
  exit 1
fi

TAG="docs-v$VERSION"

echo "Releasing spyglass docs v$VERSION (tag $TAG)"

# bump version in docs/package.json
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('docs/package.json', 'utf8'));
pkg.version = '$VERSION';
fs.writeFileSync('docs/package.json', JSON.stringify(pkg, null, 2) + '\n');
"

git add docs/package.json
git commit -m "release: docs v$VERSION"
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
echo "Done! The GitHub Action will build and push ghcr.io/flo0806/nuxt-spyglass-docs:$VERSION."
