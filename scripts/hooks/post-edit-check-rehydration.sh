#!/bin/bash
# PostToolUse hook — runs check-set-map-rehydration.mjs when
# src/services/runSaveService.ts is written or edited, and injects the
# result into the next turn's context.
#
# Non-blocking. Context injection only. See
# docs/roadmap/active/autonomy-overhaul-followups.md Item 1b.
#
# This guards against the 2026-04-10 Set/Map-in-JSON footgun where bare
# spread on a RunState object containing Set/Map fields silently broke
# `.has()` / `.get()` calls after JSON round-trip. One of the most
# specific, most costly classes of bug we've seen.

set -u

DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=./lib/hook-common.sh
source "$DIR/lib/hook-common.sh"

hook_bail_if_script_missing "scripts/lint/check-set-map-rehydration.mjs"

hook_read_input

if ! hook_path_matches "src/services/runSaveService.ts"; then
  exit 0
fi

if [ "${HOOK_TOOL_SUCCESS:-true}" != "true" ]; then
  exit 0
fi

GUARD_KEY="rehydration:${HOOK_FILE_PATH}"
if [ -f "$HOOK_FILE_PATH" ]; then
  if command -v shasum >/dev/null 2>&1; then
    CONTENT_HASH="$(shasum -a 1 "$HOOK_FILE_PATH" 2>/dev/null | awk '{print $1}')"
    GUARD_KEY="rehydration:${HOOK_FILE_PATH}@${CONTENT_HASH}"
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
  LINT_OUTPUT="$(timeout 15s node scripts/lint/check-set-map-rehydration.mjs 2>&1)"
  LINT_EXIT=$?
else
  LINT_OUTPUT="$(node scripts/lint/check-set-map-rehydration.mjs 2>&1)"
  LINT_EXIT=$?
fi

LINT_OUTPUT="$(printf '%s' "$LINT_OUTPUT" | sed -E 's/\x1b\[[0-9;]*[A-Za-z]//g')"

if [ "$LINT_EXIT" -eq 0 ]; then
  hook_emit_context "rehydration lint: PASS after edit to src/services/runSaveService.ts (Set/Map re-wrap contract intact)"
else
  MSG="rehydration lint: FAIL after edit to src/services/runSaveService.ts. Per .claude/rules/save-load.md this is a crash-class bug. Fix in the SAME commit:"$'\n'"${LINT_OUTPUT}"
  if [ "${#MSG}" -gt 3000 ]; then
    MSG="${MSG:0:3000}"$'\n\n[... truncated ...]'
  fi
  hook_emit_context "$MSG"
fi

exit 0
