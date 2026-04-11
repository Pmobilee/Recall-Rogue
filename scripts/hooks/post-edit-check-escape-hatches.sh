#!/bin/bash
# PostToolUse hook — runs check-escape-hatches.mjs when a Svelte UI file
# is written or edited, and injects the result into the next turn's context.
#
# Non-blocking. Context injection only. See
# docs/roadmap/active/autonomy-overhaul-followups.md Item 1c.
#
# This guards against the softlock-prevention rule from
# .claude/rules/ui-layout.md — every screen must render a dismiss / back
# control in all states, including empty/error/loading.

set -u

DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=./lib/hook-common.sh
source "$DIR/lib/hook-common.sh"

hook_bail_if_script_missing "scripts/lint/check-escape-hatches.mjs"

hook_read_input

if ! hook_path_matches "src/ui/**/*.svelte"; then
  # shell glob doesn't natively support **, fall back to prefix check
  case "${HOOK_FILE_PATH:-}" in
    */src/ui/*.svelte|*/src/ui/**/*.svelte) : ;;
    *)
      # Accept any .svelte under src/ui/ via substring match as backstop.
      if ! printf '%s' "${HOOK_FILE_PATH:-}" | grep -q '/src/ui/.*\.svelte$'; then
        exit 0
      fi
      ;;
  esac
fi

if [ "${HOOK_TOOL_SUCCESS:-true}" != "true" ]; then
  exit 0
fi

GUARD_KEY="escape-hatches:${HOOK_FILE_PATH}"
if [ -f "$HOOK_FILE_PATH" ]; then
  if command -v shasum >/dev/null 2>&1; then
    CONTENT_HASH="$(shasum -a 1 "$HOOK_FILE_PATH" 2>/dev/null | awk '{print $1}')"
    GUARD_KEY="escape-hatches:${HOOK_FILE_PATH}@${CONTENT_HASH}"
  fi
fi
if ! hook_loop_guard "$GUARD_KEY"; then
  exit 0
fi

ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$ROOT" || exit 0

LINT_OUTPUT=""
LINT_EXIT=0
if command -v timeout >/dev/null 2>&1; then
  LINT_OUTPUT="$(timeout 15s node scripts/lint/check-escape-hatches.mjs 2>&1)"
  LINT_EXIT=$?
else
  LINT_OUTPUT="$(node scripts/lint/check-escape-hatches.mjs 2>&1)"
  LINT_EXIT=$?
fi

LINT_OUTPUT="$(printf '%s' "$LINT_OUTPUT" | sed -E 's/\x1b\[[0-9;]*[A-Za-z]//g')"

REL_PATH="${HOOK_FILE_PATH#$ROOT/}"

if [ "$LINT_EXIT" -eq 0 ]; then
  hook_emit_context "escape-hatches lint: PASS after edit to ${REL_PATH}"
else
  MSG="escape-hatches lint: FAIL after edit to ${REL_PATH}. Per .claude/rules/ui-layout.md softlock prevention, every screen must render a dismiss / back control in all states. Fix in the SAME commit:"$'\n'"${LINT_OUTPUT}"
  if [ "${#MSG}" -gt 3000 ]; then
    MSG="${MSG:0:3000}"$'\n\n[... truncated ...]'
  fi
  hook_emit_context "$MSG"
fi

exit 0
