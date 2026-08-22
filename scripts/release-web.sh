#!/bin/bash
# Bumps apps/web's version, then commits + tags it directly. Does NOT use `npm version`'s
# own git integration — that was found to silently skip the commit+tag step in this
# environment (bumps the file, no error, no commit, no tag) — see scripts/release-all.sh.
set -euo pipefail

BUMP="${1:-patch}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ -n "$(git status --porcelain)" ]; then
  echo "Working tree isn't clean — commit or stash changes first." >&2
  exit 1
fi

npm version "$BUMP" --no-git-tag-version --workspace=@vladyslav005/tt-web

NEW_VERSION="$(node -p "require('./apps/web/package.json').version")"
TAG="web-v${NEW_VERSION}"

git add apps/web/package.json package-lock.json
git commit -m "chore(web): release $TAG"
git tag "$TAG"

echo "Tagged $TAG"

read -r -p "Push now? [y/N] " reply
if [[ "$reply" =~ ^[Yy]$ ]]; then
  git push origin main
  git push origin "$TAG"
  echo "Pushed."
else
  echo "Not pushed. When ready:"
  echo "  git push origin main"
  echo "  git push origin $TAG"
fi
