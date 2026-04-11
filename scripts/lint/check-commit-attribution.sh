#!/bin/sh
# Commit-attribution detector (prototype, non-enforcing).
#
# Problem: when multiple agents stage files concurrently, the FIRST agent
# to `git commit` captures the entire index under its commit message —
# bundling in-flight work from OTHER agents under an attribution that
# doesn't match. Observed multiple times on 2026-04-11.
#
# TWO SIGNALS, in priority order:
#
# 1. Session-marker log (PREFERRED, when available).
#    The post-edit-session-marker.sh PostToolUse hook writes one JSONL line
#    per Edit/Write/NotebookEdit to .claude/staged-by.jsonl. This script
#    reads the log and, for each staged file, looks up the LAST session_id
#    that touched it. If staged files span more than one session_id, that's
#    definitive cross-session bundling — catches even same-file bundling
#    (the blind spot of the mtime heuristic).
#
# 2. File mtime spread (FALLBACK).
#    If the session log is absent or empty, fall back to comparing staged
#    file mtimes. Spread > threshold triggers a warning.
#
# Always exits 0 — this is a PROTOTYPE and never blocks. Calibration data
# is appended to .claude/commit-attribution-log.jsonl on every run (hook
# or manual invocation) so the false-positive rate can be measured over
# time before promoting to blocking.
#
# Usage:
#   ./scripts/lint/check-commit-attribution.sh [--threshold SECONDS]
#   ./scripts/lint/check-commit-attribution.sh --preview FILE [FILE ...]
#
# Default threshold: 600 seconds (10 minutes).
#
# --preview mode: check a given SET of files (not the current index).
# Used by scripts/git-add-safe.sh to predict what the index WOULD look like
# after a `git add` — catches cross-session bundling BEFORE it hits staging,
# when unbundling is still trivial. The files are expected as the union of
# (already-staged) ∪ (about-to-be-added).

THRESHOLD=600
PREVIEW_FILES=""
MODE="staged"
while [ $# -gt 0 ]; do
  case "$1" in
    --threshold)
      shift
      THRESHOLD="${1:-600}"
      shift
      ;;
    --preview)
      MODE="preview"
      shift
      PREVIEW_FILES="$*"
      break
      ;;
    -*)
      echo "check-commit-attribution: unknown flag $1" >&2
      exit 0
      ;;
    *)
      # Legacy positional: bare number is a threshold override.
      if [ "$1" -eq "$1" ] 2>/dev/null; then
        THRESHOLD="$1"
      fi
      shift
      ;;
  esac
done

# Detect BSD vs GNU stat.
if stat -f %m /dev/null >/dev/null 2>&1; then
  STAT_CMD="stat -f %m"
elif stat -c %Y /dev/null >/dev/null 2>&1; then
  STAT_CMD="stat -c %Y"
else
  echo "check-commit-attribution: cannot determine stat flavor, skipping" >&2
  exit 0
fi

# Get the file list — either the current index (default) or the explicit
# preview set.
if [ "$MODE" = "preview" ]; then
  STAGED=$(printf '%s\n' $PREVIEW_FILES)
else
  STAGED=$(git diff --cached --name-only --diff-filter=ACMR 2>/dev/null)
fi
if [ -z "$STAGED" ]; then
  exit 0
fi

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

# Canonical log location: the MAIN repo root (shared across worktrees),
# NOT the current worktree root. `git rev-parse --git-common-dir` gives us
# the path to the shared .git dir; its parent is the main repo root.
# Without this, each worktree would read its own staged-by.jsonl and
# cross-worktree attribution detection would be blind. Falls back to
# REPO_ROOT if the git call fails.
_common_dir=$(git rev-parse --git-common-dir 2>/dev/null)
if [ -n "$_common_dir" ]; then
  # From a linked worktree, git-common-dir is ABSOLUTE (/main/.git).
  # From the main repo, it's relative (.git). Handle both.
  case "$_common_dir" in
    /*) SHARED_ROOT=$(cd "$_common_dir/.." 2>/dev/null && pwd) ;;
    *)  SHARED_ROOT=$(cd "$REPO_ROOT/$_common_dir/.." 2>/dev/null && pwd) ;;
  esac
  SHARED_ROOT="${SHARED_ROOT:-$REPO_ROOT}"
else
  SHARED_ROOT="$REPO_ROOT"
fi
unset _common_dir

SESSION_LOG="$SHARED_ROOT/.claude/staged-by.jsonl"
CALIBRATION_LOG="$SHARED_ROOT/.claude/commit-attribution-log.jsonl"

# --- Pass 1: collect mtimes + (optionally) last-touching session_id per file.
TMPFILE=$(mktemp -t rr-commit-attr.XXXXXX)
SESSIONFILE=$(mktemp -t rr-commit-attr-sess.XXXXXX)
trap 'rm -f "$TMPFILE" "$SESSIONFILE"' EXIT INT TERM

echo "$STAGED" | while IFS= read -r f; do
  [ -f "$f" ] || continue
  mt=$($STAT_CMD "$f" 2>/dev/null || echo 0)
  printf '%s\t%s\n' "$mt" "$f" >> "$TMPFILE"

  # Look up the last agent_key that edited this file, if the log exists.
  # agent_key = "session_id:transcript_hash" — discriminates sub-agents
  # within the same outer Claude Code session (each sub-agent gets its
  # own transcript file, so their hashes differ). Falls back to
  # session_id for old log rows that predate the extension.
  if [ -f "$SESSION_LOG" ] && command -v jq >/dev/null 2>&1; then
    aid=$(jq -r --arg p "$f" \
      'select(.file_path == $p) | (.agent_key // .session_id)' \
      "$SESSION_LOG" 2>/dev/null | tail -1)
    if [ -n "$aid" ]; then
      printf '%s\t%s\n' "$aid" "$f" >> "$SESSIONFILE"
    fi
  fi
done

if [ ! -s "$TMPFILE" ]; then
  exit 0
fi

# --- Compute metrics.
MIN=$(awk -F'\t' 'NR==1||$1<min{min=$1} END{print min+0}' "$TMPFILE")
MAX=$(awk -F'\t' 'NR==1||$1>max{max=$1} END{print max+0}' "$TMPFILE")
DELTA=$((MAX - MIN))
COUNT=$(wc -l < "$TMPFILE" | tr -d ' ')

# Count distinct session_ids among files with known attribution.
SESSION_COUNT=0
SESSION_LIST=""
if [ -s "$SESSIONFILE" ]; then
  SESSION_COUNT=$(awk -F'\t' '{print $1}' "$SESSIONFILE" | sort -u | wc -l | tr -d ' ')
  SESSION_LIST=$(awk -F'\t' '{print $1}' "$SESSIONFILE" | sort -u | paste -sd, -)
fi

# --- Decide whether to warn.
# Session-marker signal wins if available — multiple sessions is definitive.
# Mtime fallback kicks in otherwise.
WARN=0
REASON=""

if [ "$SESSION_COUNT" -gt 1 ]; then
  WARN=1
  REASON="session-log: $SESSION_COUNT distinct sessions touched staged files"
elif [ "$DELTA" -gt "$THRESHOLD" ]; then
  WARN=1
  REASON="mtime-spread: $DELTA seconds > $THRESHOLD threshold"
fi

# --- Calibration log (always appended).
# Records every invocation so the false-positive rate can be measured later.
# Format: {"ts":N,"count":N,"delta":N,"threshold":N,"sessions":N,"warned":N,"reason":"..."}
if command -v jq >/dev/null 2>&1; then
  jq -c -n \
    --argjson ts "$(date +%s)" \
    --argjson count "$COUNT" \
    --argjson delta "$DELTA" \
    --argjson threshold "$THRESHOLD" \
    --argjson sessions "$SESSION_COUNT" \
    --argjson warned "$WARN" \
    --arg reason "$REASON" \
    --arg session_list "$SESSION_LIST" \
    '{ts: $ts, staged: $count, mtime_delta: $delta, threshold: $threshold, session_count: $sessions, warned: ($warned == 1), reason: $reason, sessions: $session_list}' \
    >> "$CALIBRATION_LOG" 2>/dev/null || true
fi

# --- Print the warning (if any).
if [ "$WARN" = "0" ]; then
  exit 0
fi

MINUTES=$((DELTA / 60))
echo "" >&2
echo "⚠️  COMMIT ATTRIBUTION WARNING" >&2
echo "   $COUNT staged files — $REASON" >&2
if [ "$SESSION_COUNT" -gt 1 ]; then
  echo "   Distinct sessions touching staged files: $SESSION_COUNT" >&2
  echo "   Session IDs: $SESSION_LIST" >&2
fi
if [ "$DELTA" -gt 0 ]; then
  echo "   Mtime spread: $DELTA seconds (~$MINUTES min)" >&2
fi
echo "   If another agent staged files in parallel, consider:" >&2
echo "     git restore --staged <their-files>    # leave their work for them" >&2
echo "     git commit -m <your-message>           # commit only your own scope" >&2
echo "" >&2
echo "   Staged files sorted by mtime (oldest first):" >&2
sort -n "$TMPFILE" | awk -v min="$MIN" -F'\t' '
  { age = $1 - min; printf "     +%4ds  %s\n", age, $2 }
' >&2

# Show session attribution if we have it.
if [ -s "$SESSIONFILE" ]; then
  echo "" >&2
  echo "   Per-file session attribution (last editor):" >&2
  sort "$SESSIONFILE" | awk -F'\t' '{ printf "     %s  %s\n", substr($1,1,12), $2 }' >&2
fi

echo "" >&2
echo "   (Prototype warning — the commit will proceed. Calibration log: .claude/commit-attribution-log.jsonl)" >&2
echo "" >&2

# Always exit 0 — prototype never blocks.
exit 0
