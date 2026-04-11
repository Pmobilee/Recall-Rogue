#!/bin/bash
# PostToolUse hook — records per-edit session attribution.
#
# Writes one JSONL line per Edit / Write / NotebookEdit call to
# .claude/staged-by.jsonl with {session_id, tool_name, file_path, timestamp}.
# The commit-attribution detector reads this log at commit time to identify
# files that were last edited by OTHER agent sessions than the committing
# agent, catching bundled commits that the pure-mtime heuristic misses.
#
# Never blocks. Never injects context. Silent by design — this is a data
# collection hook only. Pure logging.
#
# Log location: .claude/staged-by.jsonl (append-only, truncated by commit-time
# cleanup or a periodic rotation script).
#
# Log format (one JSON object per line):
#   {"session_id":"...","tool_name":"Edit","file_path":"src/foo.ts","ts":1234567890}

set -u

DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=./lib/hook-common.sh
source "$DIR/lib/hook-common.sh"

hook_read_input

# Only act on file-editing tools.
case "${HOOK_TOOL_NAME:-}" in
  Edit|Write|NotebookEdit) : ;;
  *) exit 0 ;;
esac

# Need a file path to log against.
if [ -z "${HOOK_FILE_PATH:-}" ]; then
  exit 0
fi

# Skip failed tool calls — they didn't actually edit anything.
if [ "${HOOK_TOOL_SUCCESS:-true}" != "true" ]; then
  exit 0
fi

ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
LOG_FILE="$ROOT/.claude/staged-by.jsonl"
mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true

# Strip repo root prefix for consistent relative-path logging.
REL_PATH="${HOOK_FILE_PATH#$ROOT/}"

SESSION_ID="${HOOK_SESSION_ID:-unknown}"
TS=$(date +%s)

if command -v jq >/dev/null 2>&1; then
  jq -c -n \
    --arg sid "$SESSION_ID" \
    --arg tool "$HOOK_TOOL_NAME" \
    --arg path "$REL_PATH" \
    --argjson ts "$TS" \
    '{session_id: $sid, tool_name: $tool, file_path: $path, ts: $ts}' \
    >> "$LOG_FILE"
else
  # Fallback without jq: minimal manual encoding. Newlines and quotes in paths
  # would corrupt the log; in practice file paths don't contain them.
  printf '{"session_id":"%s","tool_name":"%s","file_path":"%s","ts":%d}\n' \
    "$SESSION_ID" "$HOOK_TOOL_NAME" "$REL_PATH" "$TS" \
    >> "$LOG_FILE"
fi

exit 0
