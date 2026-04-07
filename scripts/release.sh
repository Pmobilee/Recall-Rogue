#!/bin/bash
# Release automation script for Recall Rogue
# Usage: ./scripts/release.sh [major|minor|patch]
set -e

BUMP_TYPE=${1:-patch}
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

echo "=== Recall Rogue Release Script ==="
echo "Bump type: $BUMP_TYPE"
echo ""

# 1. Validate working tree is clean
if [ -n "$(git status --porcelain)" ]; then
  echo "ERROR: Working tree is not clean. Commit or stash changes first."
  exit 1
fi

# 2. Run full verification
echo "Running typecheck..."
npm run typecheck || { echo "FAILED: Typecheck errors"; exit 1; }

echo "Running build..."
npm run build || { echo "FAILED: Build errors"; exit 1; }

echo "Running unit tests..."
npx vitest run || { echo "FAILED: Test failures"; exit 1; }

# 3. Run deck verification
echo "Running deck verification..."
if [ -f "scripts/verify-all-decks.mjs" ]; then
  node scripts/verify-all-decks.mjs || { echo "FAILED: Deck verification"; exit 1; }
fi

# 4. Bump version
OLD_VERSION=$(node -p "require('./package.json').version")
npm version "$BUMP_TYPE" --no-git-tag-version
NEW_VERSION=$(node -p "require('./package.json').version")

echo ""
echo "Version bumped: $OLD_VERSION → $NEW_VERSION"
echo ""

# 5. Remind to update CHANGELOG
echo "=== ACTION REQUIRED ==="
echo "Update CHANGELOG.md with release notes for v$NEW_VERSION"
echo "Then run:"
echo "  git add -A"
echo "  git commit -m 'release: v$NEW_VERSION'"
echo "  git tag v$NEW_VERSION"
echo "  git push origin main --tags"
echo ""
echo "To deploy to Steam:"
echo "  /steam-deploy"
echo ""
echo "=== Done ==="
