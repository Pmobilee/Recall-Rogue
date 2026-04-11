#!/bin/bash
# PostToolUse hook — records per-edit session attribution.
#
# Writes one JSONL line per Edit / Write / NotebookEdit call to
# .claude/staged-by.jsonl with a composite attribution key and timestamp.
# The commit-attribution detector reads this log at commit time to identify
# files that were last edited by OTHER agent sessions than the committing
# agent, catching bundled commits that the pure-mtime heuristic misses.
#
# Never blocks. Never injects context. Silent by design — this is a data
# collection hook only. Pure logging.
#
# Log location: .claude/staged-by.jsonl (append-only; rotated on append).
#
# Log format (one JSON object per line):
#   {
#     "session_id": "outer-session-uuid",
#     "transcript_hash": "sha1-prefix",   // sub-agent discriminator
#     "agent_key": "session_id:transcript_hash",  // detector-facing key
#     "tool_name": "Edit",
#     "file_path": "src/foo.ts",
#     "ts": 1234567890
#   }
#
# `agent_key` is what the attribution detector groups on. For the outer
# orchestrator session, transcript_hash is derived from the primary
# transcript path. For sub-agents (which typically get their own transcript
# file per .isSidechain=true), the hash differs — so parallel sub-agents
# inside the same outer session are correctly discriminated.
#
# This closes the "intra-session sub-agent parallelism" blind spot flagged
# in 2026-04-11 Creative Pass #2 for the prior commit b457ae3ce.
#
# Rotation: on every append, if the log exceeds MAX_LOG_LINES (default
# 10000), the oldest entries are dropped. If entries older than MAX_AGE
# seconds (default 30 days) exist, they are also dropped. Both rotations
# are best-effort and never block the edit path.

set -u

MAX_LOG_LINES="${RR_STAGED_LOG_MAX_LINES:-10000}"
MAX_LOG_AGE_SEC="${RR_STAGED_LOG_MAX_AGE_SEC:-2592000}" # 30 days

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

# Canonical log location: the MAIN repo root (shared across worktrees),
# NOT the current worktree root. `git rev-parse --git-common-dir` returns
# the path to the shared .git directory (the main .git from any linked
# worktree). Its parent is the main repo root. Without this, each worktree
# writes its own staged-by.jsonl and cross-worktree detection goes blind.
# Falls back to ROOT if the git call fails.
_common_dir=$(git -C "$ROOT" rev-parse --git-common-dir 2>/dev/null)
if [ -n "$_common_dir" ]; then
  # From a linked worktree, git-common-dir is ABSOLUTE (e.g.
  # /main/.git). From the main repo, it's relative (".git"). Resolve
  # both via a cd that uses ROOT as a fallback base only when the
  # path is relative.
  case "$_common_dir" in
    /*) SHARED_ROOT=$(cd "$_common_dir/.." 2>/dev/null && pwd) ;;
    *)  SHARED_ROOT=$(cd "$ROOT/$_common_dir/.." 2>/dev/null && pwd) ;;
  esac
  SHARED_ROOT="${SHARED_ROOT:-$ROOT}"
else
  SHARED_ROOT="$ROOT"
fi
unset _common_dir

LOG_FILE="$SHARED_ROOT/.claude/staged-by.jsonl"
mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true

# Strip the CURRENT worktree's root prefix so cross-worktree entries for the
# same tracked file collapse to the same relative path (a file edited in
# worktree-A and worktree-B is still the same path in the repo's POV).
REL_PATH="${HOOK_FILE_PATH#$ROOT/}"

SESSION_ID="${HOOK_SESSION_ID:-unknown}"
TS=$(date +%s)

# Sub-agent discriminator: hash the transcript path. Parallel sub-agents in
# the same outer session get distinct transcript files (.isSidechain=true
# produces a separate transcript), so their hashes differ and the
# attribution detector sees them as distinct agents.
TRANSCRIPT_HASH="orch"
if [ -n "${HOOK_TRANSCRIPT_PATH:-}" ]; then
  if command -v shasum >/dev/null 2>&1; then
    TRANSCRIPT_HASH=$(printf '%s' "$HOOK_TRANSCRIPT_PATH" | shasum -a 1 2>/dev/null | awk '{print substr($1,1,8)}')
  elif command -v sha1sum >/dev/null 2>&1; then
    TRANSCRIPT_HASH=$(printf '%s' "$HOOK_TRANSCRIPT_PATH" | sha1sum 2>/dev/null | awk '{print substr($1,1,8)}')
  fi
fi

AGENT_KEY="${SESSION_ID}:${TRANSCRIPT_HASH}"

if command -v jq >/dev/null 2>&1; then
  jq -c -n \
    --arg sid "$SESSION_ID" \
    --arg th "$TRANSCRIPT_HASH" \
    --arg ak "$AGENT_KEY" \
    --arg tool "$HOOK_TOOL_NAME" \
    --arg path "$REL_PATH" \
    --argjson ts "$TS" \
    '{session_id: $sid, transcript_hash: $th, agent_key: $ak, tool_name: $tool, file_path: $path, ts: $ts}' \
    >> "$LOG_FILE"
else
  # Fallback without jq: minimal manual encoding. Newlines and quotes in paths
  # would corrupt the log; in practice file paths don't contain them.
  printf '{"session_id":"%s","transcript_hash":"%s","agent_key":"%s","tool_name":"%s","file_path":"%s","ts":%d}\n' \
    "$SESSION_ID" "$TRANSCRIPT_HASH" "$AGENT_KEY" "$HOOK_TOOL_NAME" "$REL_PATH" "$TS" \
    >> "$LOG_FILE"
fi

# --- Rotation: cap line count and prune aged entries. Best-effort, silent.
# Runs on every append; the cost is trivial for a file under ~10k lines.
if [ -f "$LOG_FILE" ] && command -v jq >/dev/null 2>&1; then
  line_count=$(wc -l < "$LOG_FILE" 2>/dev/null | tr -d ' ')
  if [ "${line_count:-0}" -gt "$MAX_LOG_LINES" ]; then
    # Keep last MAX_LOG_LINES entries.
    tail -n "$MAX_LOG_LINES" "$LOG_FILE" > "$LOG_FILE.tmp" 2>/dev/null && \
      mv "$LOG_FILE.tmp" "$LOG_FILE" 2>/dev/null || \
      rm -f "$LOG_FILE.tmp" 2>/dev/null
  fi
  # Prune entries older than MAX_LOG_AGE_SEC.
  cutoff=$((TS - MAX_LOG_AGE_SEC))
  jq -c --argjson cutoff "$cutoff" 'select(.ts >= $cutoff)' "$LOG_FILE" > "$LOG_FILE.tmp" 2>/dev/null && \
    mv "$LOG_FILE.tmp" "$LOG_FILE" 2>/dev/null || \
    rm -f "$LOG_FILE.tmp" 2>/dev/null
fi

exit 0
