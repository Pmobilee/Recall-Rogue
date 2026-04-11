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
#
# Default threshold: 600 seconds (10 minutes).

THRESHOLD="${1:-600}"
if [ "$1" = "--threshold" ] && [ -n "$2" ]; then
  THRESHOLD="$2"
fi

# Detect BSD vs GNU stat.
if stat -f %m /dev/null >/dev/null 2>&1; then
  STAT_CMD="stat -f %m"
elif stat -c %Y /dev/null >/dev/null 2>&1; then
  STAT_CMD="stat -c %Y"
else
  echo "check-commit-attribution: cannot determine stat flavor, skipping" >&2
  exit 0
fi

# Get staged files (added, modified, copied, renamed).
STAGED=$(git diff --cached --name-only --diff-filter=ACMR 2>/dev/null)
if [ -z "$STAGED" ]; then
  exit 0
fi

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
SESSION_LOG="$REPO_ROOT/.claude/staged-by.jsonl"
CALIBRATION_LOG="$REPO_ROOT/.claude/commit-attribution-log.jsonl"

# --- Pass 1: collect mtimes + (optionally) last-touching session_id per file.
TMPFILE=$(mktemp -t rr-commit-attr.XXXXXX)
SESSIONFILE=$(mktemp -t rr-commit-attr-sess.XXXXXX)
trap 'rm -f "$TMPFILE" "$SESSIONFILE"' EXIT INT TERM

echo "$STAGED" | while IFS= read -r f; do
  [ -f "$f" ] || continue
  mt=$($STAT_CMD "$f" 2>/dev/null || echo 0)
  printf '%s\t%s\n' "$mt" "$f" >> "$TMPFILE"

  # Look up the last session_id that edited this file, if the log exists.
  # Use grep + tail to find the most recent row matching the file path.
  if [ -f "$SESSION_LOG" ] && command -v jq >/dev/null 2>&1; then
    sid=$(jq -r --arg p "$f" \
      'select(.file_path == $p) | .session_id' \
      "$SESSION_LOG" 2>/dev/null | tail -1)
    if [ -n "$sid" ]; then
      printf '%s\t%s\n' "$sid" "$f" >> "$SESSIONFILE"
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
