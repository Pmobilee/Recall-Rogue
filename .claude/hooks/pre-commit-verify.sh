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

# === Non-blocking warnings (informational, do not block commit) ===

# Docs sync warning: warn if src/ files staged but no docs/ files
STAGED_SRC=$(git diff --cached --name-only --diff-filter=AM | grep '^src/' || true)
STAGED_DOCS=$(git diff --cached --name-only --diff-filter=AM | grep '^docs/' || true)
if [ -n "$STAGED_SRC" ] && [ -z "$STAGED_DOCS" ]; then
  echo "" >&2
  echo "WARNING: src/ files staged but no docs/ updates detected." >&2
  echo "  Per docs-first rule, docs must be updated in every commit." >&2
  echo "  If this change has no doc impact, ignore this warning." >&2
  echo "" >&2
fi

# Hardcoded px warning: check staged .svelte/.css files for new violations
STAGED_UI=$(git diff --cached --name-only --diff-filter=AM | grep -E '\.(svelte|css)$' || true)
if [ -n "$STAGED_UI" ]; then
  if [ -f "scripts/lint-hardcoded-px.mjs" ]; then
    PX_HITS=$(node scripts/lint-hardcoded-px.mjs 2>/dev/null | grep -F -f <(echo "$STAGED_UI") || true)
    if [ -n "$PX_HITS" ]; then
      echo "" >&2
      echo "WARNING: Possible hardcoded px values in staged UI files:" >&2
      echo "$PX_HITS" | head -5 >&2
      echo "  Use calc(Npx * var(--layout-scale, 1)) instead." >&2
      echo "" >&2
    fi
  fi
fi

# Deck verification: block if deck JSON files are staged and fail verification
STAGED_DECKS=$(git diff --cached --name-only --diff-filter=AM | grep '^data/decks/.*\.json$' || true)
if [ -n "$STAGED_DECKS" ]; then
  if [ -f "scripts/verify-all-decks.mjs" ]; then
    echo "Verifying deck files..." >&2
    if ! node scripts/verify-all-decks.mjs 2>&1 >&2; then
      echo "BLOCKED: Deck verification failed. Fix before committing." >&2
      exit 2
    fi
  fi
fi

echo "All checks passed." >&2
exit 0
