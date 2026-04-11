#!/bin/bash
# Pre-commit verification hook for Recall Rogue
# Blocks git commit if typecheck, build, or tests fail — UNLESS multi-agent
# mode is active, in which case failures soft-warn to avoid concurrent-run
# collisions (shared dist/, flaky timing, mid-edit source reads).
set -e
cd "$CLAUDE_PROJECT_DIR" || exit 1

echo "=== Pre-Commit Verification ===" >&2

# --- Multi-agent detection (shared helper, single source of truth) ---
# Sources hooks/lib/multi-agent-detect.sh which exports MULTI_AGENT and
# MULTI_AGENT_REASON. Same script is sourced by the git-side pre-commit hook,
# so the detection logic lives in exactly one place.
. "$CLAUDE_PROJECT_DIR/hooks/lib/multi-agent-detect.sh"

if [ "$MULTI_AGENT" = "1" ]; then
  echo "" >&2
  echo "⚠️  MULTI-AGENT MODE DETECTED ($MULTI_AGENT_REASON)" >&2
  echo "   typecheck / build / test failures will soft-warn instead of block." >&2
  echo "   Concurrent agent edits can cause spurious failures in these checks." >&2
  echo "" >&2
fi

# Run a command; block on failure in single-agent mode, warn in multi-agent mode.
# Usage: run_or_warn "Label" -- <command...>
run_or_warn() {
  local label="$1"
  shift
  [ "$1" = "--" ] && shift
  echo "Running $label..." >&2
  if "$@" 2>&1 >&2; then
    return 0
  fi
  if [ "$MULTI_AGENT" = "1" ]; then
    echo "" >&2
    echo "⚠️  WARN: $label failed — NOT blocking because multi-agent mode is active." >&2
    echo "   Reason: $MULTI_AGENT_REASON" >&2
    echo "   If this is a real regression, re-run the commit in single-agent mode." >&2
    echo "" >&2
    return 0
  fi
  echo "BLOCKED: $label failed. Fix before committing." >&2
  exit 2
}

run_or_warn "typecheck"   -- npm run typecheck
run_or_warn "build"       -- npm run build
run_or_warn "unit tests"  -- npx vitest run

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

# Skill drift check: block if SKILL.md has drifted from SKILL.md.template.
# Per .claude/rules/agent-mindset.md → Two-sided enforcement and
# docs/roadmap/active/autonomy-overhaul-followups.md Item 4.
STAGED_SKILLS=$(git diff --cached --name-only --diff-filter=AM | grep -E '^\.claude/skills/.*/SKILL\.md(\.template)?$' || true)
if [ -n "$STAGED_SKILLS" ]; then
  if [ -f "scripts/lint/check-skill-drift.mjs" ]; then
    echo "Checking skill template drift..." >&2
    if ! node scripts/lint/check-skill-drift.mjs 2>&1 >&2; then
      echo "BLOCKED: SKILL.md drift detected. Edit the .template and run 'npm run build:skills'." >&2
      exit 2
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

# Docker visual verify: block if observable source files are staged.
# Per .claude/rules/testing.md → "Docker Visual Verification — MANDATORY".
# This is the enforcement that used to live only in prose.
# Escape hatch: RR_SKIP_DOCKER_VERIFY=1 to bypass (loud warning).
STAGED_OBSERVABLE=$(git diff --cached --name-only --diff-filter=AM \
  | grep -E '^(src/game/|src/services/|src/ui/|src/CardApp\.svelte|data/decks/.*\.json)' || true)
if [ -n "$STAGED_OBSERVABLE" ]; then
  if [ "${RR_SKIP_DOCKER_VERIFY:-0}" = "1" ]; then
    echo "" >&2
    echo "⚠️  WARNING: RR_SKIP_DOCKER_VERIFY=1 is set — skipping Docker visual verify." >&2
    echo "   This bypass should only be used in genuine emergencies." >&2
    echo "   The staged change touches observable files:" >&2
    echo "$STAGED_OBSERVABLE" | sed 's/^/     /' >&2
    echo "" >&2
  elif [ -f "scripts/docker-visual-test.sh" ]; then
    # Check Docker is actually available before blocking on it.
    if ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
      echo "" >&2
      echo "⚠️  WARNING: Docker is not running — cannot run visual verification." >&2
      echo "   Per .claude/rules/testing.md this is MANDATORY for observable changes." >&2
      echo "   Start Docker Desktop and retry, or set RR_SKIP_DOCKER_VERIFY=1 to bypass." >&2
      echo "   Staged observable files:" >&2
      echo "$STAGED_OBSERVABLE" | sed 's/^/     /' >&2
      echo "" >&2
      echo "BLOCKED: Docker unavailable — cannot verify observable change." >&2
      exit 2
    fi

    echo "Running Docker visual verification..." >&2
    AGENT_ID="precommit-$$"
    SCENARIO="${RR_PRECOMMIT_SCENARIO:-combat-basic}"
    if ! scripts/docker-visual-test.sh --scenario "$SCENARIO" --agent-id "$AGENT_ID" 2>&1 >&2; then
      echo "" >&2
      echo "BLOCKED: Docker visual verification failed." >&2
      echo "   Review the artifacts under /tmp/rr-docker-visual/${AGENT_ID}_*" >&2
      echo "   Fix the visual regression or set RR_SKIP_DOCKER_VERIFY=1 to bypass." >&2
      exit 2
    fi
    echo "Docker visual verification passed." >&2
  fi
fi

echo "All checks passed." >&2
exit 0
