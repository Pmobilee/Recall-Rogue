#!/bin/bash
# Pre-commit verification hook for Recall Rogue
# Blocks git commit if typecheck, build, or tests fail
set -e
cd "$CLAUDE_PROJECT_DIR" || exit 1

echo "=== Pre-Commit Verification ===" >&2

echo "Running typecheck..." >&2
if ! npm run typecheck 2>&1 >&2; then
  echo "BLOCKED: TypeScript errors found. Fix before committing." >&2
  exit 2
fi

echo "Running build..." >&2
if ! npm run build 2>&1 >&2; then
  echo "BLOCKED: Build failed. Fix before committing." >&2
  exit 2
fi

echo "Running unit tests..." >&2
if ! npx vitest run 2>&1 >&2; then
  echo "BLOCKED: Tests failed. Fix before committing." >&2
  exit 2
fi

# Note: px lint (scripts/lint-hardcoded-px.mjs) runs across ALL files.
# Many pre-existing violations exist. Run manually to check new code:
#   node scripts/lint-hardcoded-px.mjs | grep -f <(git diff --cached --name-only)

echo "All checks passed." >&2
exit 0
