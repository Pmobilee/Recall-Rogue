#!/bin/bash
# PostToolUse hook — runs verify-all-decks.mjs when a data/decks/*.json file
# is written or edited, and injects the result into the next turn's context.
#
# Non-blocking (always exit 0). Context injection only — per
# .claude/rules/autonomy-charter.md and docs/roadmap/active/autonomy-overhaul-followups.md
# Item 1a. Rationale: deck edits are iterative; blocking forces a hard stop
# mid-iteration. Context injection lets the orchestrator see failures in the
# next turn and fix them in the same commit (Never Defer rule).
#
# Hook contract: reads JSON from stdin with .tool_input.file_path, runs the
# full verifier (~1.3s), and emits the output as additionalContext.
#
# Exit codes: always 0. The hook NEVER blocks — if the verifier finds issues,
# the orchestrator sees them in the next turn and fixes them.

set -u

DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=./lib/hook-common.sh
source "$DIR/lib/hook-common.sh"

# Bail gracefully if the verifier script is missing (stale checkout).
hook_bail_if_script_missing "scripts/verify-all-decks.mjs"

hook_read_input

# Only act on writes/edits to data/decks/*.json files.
if ! hook_path_matches "data/decks/*.json"; then
  exit 0
fi

# Skip if the tool call itself failed — nothing to verify.
if [ "${HOOK_TOOL_SUCCESS:-true}" != "true" ]; then
  exit 0
fi

# Loop guard: dedupe identical (file@content-hash) within a session.
GUARD_KEY="verify-decks:${HOOK_FILE_PATH}"
if [ -f "$HOOK_FILE_PATH" ]; then
  if command -v shasum >/dev/null 2>&1; then
    CONTENT_HASH="$(shasum -a 1 "$HOOK_FILE_PATH" 2>/dev/null | awk '{print $1}')"
    GUARD_KEY="verify-decks:${HOOK_FILE_PATH}@${CONTENT_HASH}"
  fi
fi
if ! hook_loop_guard "$GUARD_KEY"; then
  exit 0
fi

# Run the verifier from the repo root. Capture combined output.
ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$ROOT" || exit 0

# Use a short timeout so a hung verifier can never wedge the session.
# macOS doesn't ship `timeout` by default; fall back to a background watcher.
VERIFY_OUTPUT=""
VERIFY_EXIT=0
if command -v timeout >/dev/null 2>&1; then
  VERIFY_OUTPUT="$(timeout 30s node scripts/verify-all-decks.mjs 2>&1)"
  VERIFY_EXIT=$?
else
  VERIFY_OUTPUT="$(node scripts/verify-all-decks.mjs 2>&1)"
  VERIFY_EXIT=$?
fi

# Trim ANSI color codes so the context is clean text.
VERIFY_OUTPUT="$(printf '%s' "$VERIFY_OUTPUT" | sed -E 's/\x1b\[[0-9;]*[A-Za-z]//g')"

REL_PATH="${HOOK_FILE_PATH#$ROOT/}"

if [ "$VERIFY_EXIT" -eq 0 ]; then
  # Pass path — positive confirmation the guardrail ran.
  MSG="verify-all-decks: PASS after edit to ${REL_PATH}"
  # Extract the fail/warn totals if present for a concise summary.
  SUMMARY="$(printf '%s' "$VERIFY_OUTPUT" | grep -E '^(PASS|FAIL|WARN|Total)' | head -5 || true)"
  if [ -n "$SUMMARY" ]; then
    MSG="${MSG}"$'\n'"${SUMMARY}"
  fi
  hook_emit_context "$MSG"
else
  # Fail path — inject the full output so the orchestrator sees specific findings.
  MSG="verify-all-decks: FAIL after edit to ${REL_PATH} (exit ${VERIFY_EXIT}). Fix these findings in the SAME commit per .claude/rules/autonomy-charter.md Never Defer rule:"$'\n'"${VERIFY_OUTPUT}"
  # Truncate to ~3000 chars so we don't drown the next-turn context.
  if [ "${#MSG}" -gt 3000 ]; then
    MSG="${MSG:0:3000}"$'\n\n[... output truncated; run `node scripts/verify-all-decks.mjs --verbose` for full details ...]'
  fi
  hook_emit_context "$MSG"
fi

exit 0
