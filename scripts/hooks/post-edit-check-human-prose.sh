#!/bin/bash
# PostToolUse hook — runs check-human-prose.mjs when a user-facing text file
# is written or edited, and injects anti-AI tell findings into the next
# turn's context as a warning.
#
# Non-blocking (always exit 0). Context injection only — the pre-commit lint
# is the hard wall. This hook is the reactive half of the human-prose
# two-sided enforcement. See .claude/rules/human-prose.md.

set -u

DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=./lib/hook-common.sh
source "$DIR/lib/hook-common.sh"

hook_bail_if_script_missing "scripts/lint/check-human-prose.mjs"

hook_read_input

# Match all user-facing text paths. Keep in sync with the lint's
# USER_FACING_GLOBS list.
if ! (
  hook_path_matches "data/decks/*.json" ||
  hook_path_matches "public/data/narratives/*" ||
  hook_path_matches "src/data/mechanics.ts" ||
  hook_path_matches "src/data/relics/*" ||
  hook_path_matches "src/data/enemies.ts" ||
  hook_path_matches "src/data/enemyDialogue.ts" ||
  hook_path_matches "src/data/specialEvents.ts" ||
  hook_path_matches "src/data/steamAchievements.ts" ||
  hook_path_matches "src/data/statusEffects.ts" ||
  hook_path_matches "src/i18n/locales/*" ||
  hook_path_matches "src/ui/*.svelte"
); then
  exit 0
fi

# Skip _wip files — not shipped.
case "$HOOK_FILE_PATH" in
  */data/decks/_wip/*) exit 0 ;;
esac

if [ "${HOOK_TOOL_SUCCESS:-true}" != "true" ]; then
  exit 0
fi

# Loop guard: dedupe by (file@content-hash) within a session.
GUARD_KEY="human-prose:${HOOK_FILE_PATH}"
if [ -f "$HOOK_FILE_PATH" ]; then
  if command -v shasum >/dev/null 2>&1; then
    CONTENT_HASH="$(shasum -a 1 "$HOOK_FILE_PATH" 2>/dev/null | awk '{print $1}')"
    GUARD_KEY="human-prose:${HOOK_FILE_PATH}@${CONTENT_HASH}"
  fi
fi
if ! hook_loop_guard "$GUARD_KEY"; then
  exit 0
fi

ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$ROOT" || exit 0

# Run the lint scoped to this single file.
LINT_OUTPUT=""
LINT_EXIT=0
if command -v timeout >/dev/null 2>&1; then
  LINT_OUTPUT="$(timeout 10s node scripts/lint/check-human-prose.mjs --file "$HOOK_FILE_PATH" 2>&1)"
  LINT_EXIT=$?
else
  LINT_OUTPUT="$(node scripts/lint/check-human-prose.mjs --file "$HOOK_FILE_PATH" 2>&1)"
  LINT_EXIT=$?
fi

# Strip ANSI color.
LINT_OUTPUT="$(printf '%s' "$LINT_OUTPUT" | sed -E 's/\x1b\[[0-9;]*[A-Za-z]//g')"

REL_PATH="${HOOK_FILE_PATH#$ROOT/}"

if [ "$LINT_EXIT" -eq 0 ]; then
  # Clean — no noise.
  exit 0
fi

MSG="🚨 Human-prose rule (.claude/rules/human-prose.md): potential AI-tells detected in ${REL_PATH}."$'\n'"Run /humanizer with .claude/skills/humanizer/voice-sample.md BEFORE committing, or add [humanizer-verified] to the commit message if you consciously ran the skill and the flags are false positives."$'\n\n'"${LINT_OUTPUT}"

if [ "${#MSG}" -gt 3000 ]; then
  MSG="${MSG:0:3000}"$'\n\n[... truncated ...]'
fi

hook_emit_context "$MSG"

exit 0
