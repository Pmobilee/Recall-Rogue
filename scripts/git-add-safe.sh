#!/bin/sh
# git-add-safe — cross-session-bundling aware wrapper around `git add`.
#
# Problem: the commit-attribution detector (scripts/lint/check-commit-attribution.sh)
# fires at commit time, which is TOO LATE to unbundle cleanly. By the time
# you see the warning, your index already contains files from other agents
# and the fix requires `git restore --staged` surgery.
#
# Solution: check BEFORE the index mutation. This wrapper:
#   1. Takes the args you'd pass to `git add` (paths / globs).
#   2. Expands them to the actual file set.
#   3. Takes the UNION of (already-staged) + (about-to-be-added).
#   4. Runs check-commit-attribution.sh --preview on that union.
#   5. If the preview flags a cross-session bundle, asks before proceeding.
#   6. If confirmed (or no warning), runs the real `git add` unchanged.
#
# Usage:
#   ./scripts/git-add-safe.sh <paths...>   # replaces `git add`
#   npm run gsafe -- path/to/file
#
# Opt out entirely: `git add` still works as normal — this is a wrapper, not
# a hook. Use it only when you want the safety check.
#
# Force proceed without prompt: RR_GIT_ADD_SAFE_YES=1 ./scripts/git-add-safe.sh ...
# Skip the check (equivalent to raw git add): RR_GIT_ADD_SAFE_SKIP=1 ...

if [ $# -eq 0 ]; then
  echo "usage: git-add-safe <paths...>" >&2
  exit 2
fi

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$REPO_ROOT" || exit 1

# Honor the skip env var — pass through unchanged.
if [ "${RR_GIT_ADD_SAFE_SKIP:-0}" = "1" ]; then
  exec git add "$@"
fi

# Resolve the detector relative to THIS script's location (not cwd's git
# root) so the wrapper works even when symlinked or copied into another
# repo. Falls back to the cwd-git-root path if the relative lookup fails.
SCRIPT_DIR=$(cd "$(dirname "$0")" 2>/dev/null && pwd)
DETECTOR="$SCRIPT_DIR/lint/check-commit-attribution.sh"
if [ ! -x "$DETECTOR" ] && [ -x "$REPO_ROOT/scripts/lint/check-commit-attribution.sh" ]; then
  DETECTOR="$REPO_ROOT/scripts/lint/check-commit-attribution.sh"
fi
if [ ! -x "$DETECTOR" ]; then
  # Detector missing — degrade to raw git add.
  exec git add "$@"
fi

# --- Expand the add args into the actual file set that `git add` would touch.
# `git ls-files --others --modified --exclude-standard -- <paths>` gives us
# (untracked + modified) files matching the path arguments. This is the same
# set `git add` would act on.
ABOUT_TO_ADD=$(git ls-files --others --modified --exclude-standard -- "$@" 2>/dev/null)

# Already-staged set (may overlap with ABOUT_TO_ADD — harmless, the union
# dedup happens via sort -u).
ALREADY_STAGED=$(git diff --cached --name-only --diff-filter=ACMR 2>/dev/null)

# Union, deduped.
UNION=$(printf '%s\n%s\n' "$ALREADY_STAGED" "$ABOUT_TO_ADD" | sort -u | grep -v '^$')
if [ -z "$UNION" ]; then
  # Nothing to stage — fall through to git add which will no-op or error
  # cleanly with git's native message.
  exec git add "$@"
fi

# --- Run the detector in preview mode against the union.
# Capture stderr only — the detector writes its warning to stderr and exits 0.
WARN_OUTPUT=$("$DETECTOR" --preview $UNION 2>&1 >/dev/null || true)

if [ -z "$WARN_OUTPUT" ]; then
  # Cohesive — proceed silently.
  exec git add "$@"
fi

# --- Warning fired. Show it to the user and confirm.
echo "$WARN_OUTPUT" >&2
echo "" >&2
echo "⚠️  Cross-session bundling detected BEFORE staging." >&2
echo "   The files listed above include work from other agent sessions." >&2
echo "   If you proceed, those files will be added to your index." >&2
echo "" >&2

if [ "${RR_GIT_ADD_SAFE_YES:-0}" = "1" ]; then
  echo "   RR_GIT_ADD_SAFE_YES=1 — proceeding without prompt." >&2
  exec git add "$@"
fi

# Interactive confirm. Use /dev/tty so the prompt works even when the wrapper
# is invoked from a pipe or a script.
if [ -t 0 ] || [ -e /dev/tty ]; then
  printf "   Proceed with git add anyway? [y/N] " >&2
  read -r REPLY </dev/tty 2>/dev/null || REPLY="n"
  case "$REPLY" in
    y|Y|yes|YES)
      exec git add "$@"
      ;;
    *)
      echo "   Aborted. No files were staged." >&2
      echo "   To stage only your own work, run:" >&2
      echo "     git add <your-specific-files>" >&2
      echo "   To bypass this check:" >&2
      echo "     RR_GIT_ADD_SAFE_SKIP=1 ./scripts/git-add-safe.sh $*" >&2
      exit 1
      ;;
  esac
else
  # Non-interactive context with no tty — default to SAFE (abort).
  echo "   Non-interactive context, defaulting to ABORT." >&2
  echo "   Re-run with RR_GIT_ADD_SAFE_YES=1 to force-proceed." >&2
  exit 1
fi
