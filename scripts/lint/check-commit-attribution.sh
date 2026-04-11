#!/bin/sh
# Commit-attribution detector (prototype, non-enforcing).
#
# Problem: when multiple agents stage files concurrently, the FIRST agent
# to `git commit` captures the entire index under its commit message —
# bundling in-flight work from OTHER agents under an attribution that
# doesn't match. Observed multiple times on 2026-04-11:
#   - 06097f1c7 "docs(index)" bundled 434 lines of Zod schema + tests
#   - 2adf8585d "card description audit" bundled HSK sense-mismatch edits
#   - de1379f61 "fix(registry)" bundled DeckDetailModal skipped-facts badge
#
# This script uses file mtime spread as a cheap proxy: if staged files
# have mtimes spanning more than N seconds, they were probably touched
# by different agent sessions. Emits a warning listing the outliers.
# Exit 0 always — this is a PROTOTYPE and never blocks.
#
# Promote to blocking (exit 1) after the false-positive rate is measured.
#
# Usage: ./scripts/lint/check-commit-attribution.sh [--threshold SECONDS]
# Default threshold: 600 (10 minutes)
#
# The threshold can be tuned. Short threshold = more false positives from
# slow single-agent work. Long threshold = more false negatives from
# fast concurrent commits. 10 minutes is a reasonable starting point —
# most single-agent tasks stage their files in the last few minutes of
# work, while bundled concurrent commits span 20+ minute windows.

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

# Collect mtimes. Use a temp file to handle newline-sensitive filenames.
TMPFILE=$(mktemp -t rr-commit-attr.XXXXXX)
trap 'rm -f "$TMPFILE"' EXIT INT TERM

echo "$STAGED" | while IFS= read -r f; do
  [ -f "$f" ] || continue
  mt=$($STAT_CMD "$f" 2>/dev/null || echo 0)
  printf '%s\t%s\n' "$mt" "$f" >> "$TMPFILE"
done

# If we couldn't gather any, skip silently.
if [ ! -s "$TMPFILE" ]; then
  exit 0
fi

# Compute min/max mtime.
MIN=$(awk -F'\t' 'NR==1||$1<min{min=$1} END{print min+0}' "$TMPFILE")
MAX=$(awk -F'\t' 'NR==1||$1>max{max=$1} END{print max+0}' "$TMPFILE")
DELTA=$((MAX - MIN))

# Count staged files.
COUNT=$(wc -l < "$TMPFILE" | tr -d ' ')

if [ "$DELTA" -le "$THRESHOLD" ]; then
  # Cohesive: one session, likely. Stay silent in the non-warning path
  # so the hook output isn't noisy on normal commits.
  exit 0
fi

# Span exceeds threshold — probable cross-session bundling.
MINUTES=$((DELTA / 60))
echo "" >&2
echo "⚠️  COMMIT ATTRIBUTION WARNING" >&2
echo "   $COUNT staged files span $DELTA seconds (~$MINUTES min) of mtime." >&2
echo "   Threshold: $THRESHOLD seconds. This may indicate cross-session bundling." >&2
echo "   If another agent staged files in parallel, consider:" >&2
echo "     git restore --staged <their-files>    # leave their work for them" >&2
echo "     git commit -m <your-message>           # commit only your own scope" >&2
echo "" >&2
echo "   Staged files sorted by mtime (oldest first):" >&2
sort -n "$TMPFILE" | awk -v min="$MIN" -F'\t' '
  { age = $1 - min; printf "     +%4ds  %s\n", age, $2 }
' >&2
echo "" >&2
echo "   (This is a PROTOTYPE warning — the commit will proceed.)" >&2
echo "" >&2

# Always exit 0 — prototype never blocks.
exit 0
