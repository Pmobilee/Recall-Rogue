#!/bin/sh
# Point this clone's git at the checked-in hooks/ directory.
#
# This eliminates the drift problem where .git/hooks/pre-commit silently
# diverges from the checked-in hooks/pre-commit source of truth. After
# running this once, git will invoke hooks/pre-commit directly on every
# commit — no copying, no sync, one file.
#
# Run this once after cloning:   ./scripts/install-git-hooks.sh
# Or via npm:                     npm run hooks:install

set -e

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$REPO_ROOT"

if [ ! -d "hooks" ]; then
  echo "ERROR: hooks/ directory not found in repo root." >&2
  exit 1
fi

# Ensure the checked-in hook is executable (chmod bits don't always survive).
chmod +x hooks/pre-commit

# Capture the old value BEFORE overwriting.
OLD_PATH=$(git config --get core.hooksPath 2>/dev/null || echo "default .git/hooks")

# Point git at the checked-in hooks directory.
git config core.hooksPath hooks

echo "✓ core.hooksPath = hooks (was: $OLD_PATH)"
echo "✓ hooks/pre-commit is executable"
echo ""
echo "Git will now invoke hooks/pre-commit directly. The .git/hooks/ copy is"
echo "obsolete and can be deleted if desired — it won't be used."
