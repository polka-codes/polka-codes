#!/bin/bash

# Check if version argument is provided
if [ -z "$1" ]; then
  echo "Error: Version number is required"
  echo "Usage: $0 <version>"
  exit 1
fi

VERSION=$1

# require no unstaged changes
if [ -n "$(git status --porcelain)" ]; then
  echo "Error: Unstaged changes detected. Commit or stash them before running this script."
  exit 1
fi

# Find package.json files under packages directory and update version
find ./packages -name package.json -not -path "*/node_modules/*" | while read -r file; do
  sed -i.bak -E "s/\"version\": \"[^\"]+\"/\"version\": \"$VERSION\"/" "$file" && rm "$file.bak"
  echo "Updated $file to version $VERSION"
done

echo "Version bumped to $VERSION in all package.json files under packages directory"

git add .
git commit -m 'chore: release $VERSION'

git tag v$VERSION
bun run publish
git push origin v$VERSION
gh release create v$VERSION --generate-notes

