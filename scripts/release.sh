#!/bin/bash

# Check if version argument is provided
if [ -z "$1" ]; then
  echo "Error: Version number is required"
  echo "Usage: $0 <version>"
  exit 1
fi

VERSION=$1

git pull

# require no unstaged changes
if [ -n "$(git status --porcelain)" ]; then
  echo "Error: Unstaged changes detected. Commit or stash them before running this script."
  exit 1
fi

# require on master branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "master" ]; then
  echo "Error: Must be on master branch to release."
  exit 1
fi

# Find package.json files under packages directory and update version
find ./packages -name package.json -not -path "*/node_modules/*" | while read -r file; do
  sed -i.bak -E "s/\"version\": \"[^\"]+\"/\"version\": \"$VERSION\"/" "$file" && rm "$file.bak"
  echo "Updated $file to version $VERSION"
done

echo "Version bumped to $VERSION in all package.json files under packages directory"

git add .
git commit -m "chore: release $VERSION"

bun run clean
bun run build
bun publish --cwd packages/core --access public || exit 1
bun publish --cwd packages/github --access public || exit 1
bun publish --cwd packages/cli-shared --access public || exit 1
bun publish --cwd packages/cli --access public || exit 1
bun publish --cwd packages/runner --access public || exit 1
git tag v$VERSION
git push origin v$VERSION
git push
gh release create v$VERSION --generate-notes

