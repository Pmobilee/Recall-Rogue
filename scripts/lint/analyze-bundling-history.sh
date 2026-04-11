#!/bin/sh
# Retrospective bundling analyzer — scores historical commits for
# cross-session-bundling likelihood using heuristics that DO survive git
# history (unlike mtime, which cannot time-travel).
#
# This is a separate tool from the live commit-attribution detector. The
# live detector uses file mtime + session-marker log (both of which start
# empty and require forward-running data). This script looks at commits
# that have ALREADY landed and scores them using commit metadata only:
#
#   1. Domain-diversity score — how many distinct top-level directories
#      are touched. A commit that touches data/decks/ + src/ui/ + .claude/
#      is almost certainly bundled; a single-directory commit is probably
#      cohesive.
#
#   2. File-extension diversity — how many distinct extensions. A commit
#      with .svelte + .ts + .json + .mjs + .sh is bundled; one with only
#      .json is cohesive.
#
#   3. Commit title / file-set mismatch — if the title mentions "deck" but
#      touches zero data/decks/*.json files, or mentions "hook" but touches
#      zero hooks/*, that's suspicious.
#
# Output is a ranked table of the N most-likely-bundled commits, plus a
# distribution summary. Use this to (a) baseline the false-positive rate of
# the live detector's thresholds before waiting a week of live data, and
# (b) retrospectively identify which commits in repo history are lying
# about their attribution.
#
# Usage:
#   ./scripts/lint/analyze-bundling-history.sh [count]
# Default: last 50 commits.

set -e

COUNT="${1:-50}"

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$REPO_ROOT" || exit 1

# Get the last N commits with their hashes and subjects.
COMMITS=$(git log --format='%H %s' -"$COUNT")

if [ -z "$COMMITS" ]; then
  echo "analyze-bundling-history: no commits found" >&2
  exit 0
fi

TMPOUT=$(mktemp -t rr-bundling-analysis.XXXXXX)
trap 'rm -f "$TMPOUT"' EXIT INT TERM

# For each commit, compute:
#   - total files touched
#   - distinct top-level directories (depth 1)
#   - distinct file extensions
#   - mismatch signals between subject and file set
#
# Total score = 2 * dirs + 1 * exts + 3 * subject_mismatch
# Higher = more likely bundled.
printf '%s\n' "$COMMITS" | while IFS=' ' read -r hash subject; do
  # Get file list for this commit.
  files=$(git show --name-only --format='' "$hash" 2>/dev/null | grep -v '^$')
  count=$(printf '%s\n' "$files" | grep -c . || echo 0)

  if [ "$count" = "0" ] || [ "$count" = "" ]; then
    continue
  fi

  # Distinct top-level directories.
  dirs=$(printf '%s\n' "$files" | awk -F/ '{print $1}' | sort -u | wc -l | tr -d ' ')

  # Distinct file extensions.
  exts=$(printf '%s\n' "$files" | awk -F. '{print $NF}' | sort -u | wc -l | tr -d ' ')

  # Subject-mismatch heuristics.
  mismatch=0
  subject_lower=$(printf '%s' "$subject" | tr '[:upper:]' '[:lower:]')
  case "$subject_lower" in
    *deck*)
      if ! printf '%s\n' "$files" | grep -q '^data/decks/'; then
        mismatch=$((mismatch + 1))
      fi
      ;;
  esac
  case "$subject_lower" in
    *hook*)
      if ! printf '%s\n' "$files" | grep -Eq '^(\.claude/)?hooks/|scripts/hooks/'; then
        mismatch=$((mismatch + 1))
      fi
      ;;
  esac
  case "$subject_lower" in
    *docs*|*doc\(*)
      # "docs" in title — if >50% of files are NOT under docs/, that's suspicious.
      non_docs=$(printf '%s\n' "$files" | grep -vc '^docs/' || echo 0)
      if [ "$count" -gt 0 ] && [ "$non_docs" -gt $((count / 2)) ]; then
        mismatch=$((mismatch + 1))
      fi
      ;;
  esac
  case "$subject_lower" in
    *fix\(ui*|*feat\(ui*)
      # UI change — if >50% of files are not in src/ui/, suspicious.
      non_ui=$(printf '%s\n' "$files" | grep -vc '^src/ui/' || echo 0)
      if [ "$count" -gt 2 ] && [ "$non_ui" -gt $((count / 2)) ]; then
        mismatch=$((mismatch + 1))
      fi
      ;;
  esac

  # Score.
  score=$((2 * dirs + exts + 3 * mismatch))
  printf '%d\t%s\t%d\t%d\t%d\t%d\t%s\n' \
    "$score" "$hash" "$count" "$dirs" "$exts" "$mismatch" "$subject" >> "$TMPOUT"
done

if [ ! -s "$TMPOUT" ]; then
  echo "analyze-bundling-history: no data gathered" >&2
  exit 0
fi

# Distribution summary.
TOTAL=$(wc -l < "$TMPOUT" | tr -d ' ')
MAX=$(awk -F'\t' '{print $1}' "$TMPOUT" | sort -n | tail -1)
MEDIAN=$(awk -F'\t' '{print $1}' "$TMPOUT" | sort -n | awk "NR == int($TOTAL/2)+1")
HIGH_COUNT=$(awk -F'\t' '$1 >= 8 {n++} END {print n+0}' "$TMPOUT")

echo ""
echo "=== Retrospective bundling analysis — last $COUNT commits ==="
echo ""
echo "Scoring heuristic: 2 × distinct_dirs + 1 × distinct_exts + 3 × subject_mismatch"
echo "Higher score = more likely cross-session bundled."
echo ""
echo "Distribution:"
echo "  Total commits scored: $TOTAL"
echo "  Max score:    $MAX"
echo "  Median score: $MEDIAN"
echo "  Score >= 8 (high-suspicion): $HIGH_COUNT"
echo ""
echo "Top-ranked suspicious commits (score / hash / files / dirs / exts / mismatch / subject):"
echo ""
sort -rn "$TMPOUT" | head -15 | awk -F'\t' '
  { printf "  %2d  %s  f:%-3d d:%d e:%d m:%d  %s\n", $1, substr($2,1,10), $3, $4, $5, $6, $7 }
'

echo ""
echo "Known-bundled commits from gotchas.md 2026-04-11 (for cross-check):"
for known in 06097f1c7 2adf8585d de1379f61 0b51b46e5; do
  line=$(grep "^[0-9]*	$known" "$TMPOUT" 2>/dev/null | head -1)
  if [ -n "$line" ]; then
    printf '%s\n' "$line" | awk -F'\t' '
      { printf "  %2d  %s  f:%-3d d:%d e:%d m:%d  %s\n", $1, substr($2,1,10), $3, $4, $5, $6, $7 }
    '
  else
    echo "  (not in the last $COUNT commits: $known)"
  fi
done

echo ""
echo "Calibration tip: if the known-bundled commits above score HIGHER than"
echo "the median, the heuristic is working. If they score near the median,"
echo "the heuristic is too loose and the live detector's threshold needs"
echo "tightening (or different signals added)."
echo ""
