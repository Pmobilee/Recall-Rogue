#!/bin/bash
# merge-worktree.sh — merge a worktree branch back into main after a parallel
# agent finishes its work.
#
# Usage:
#   scripts/merge-worktree.sh <worktree-path> <branch-name> "<merge-message>"
#
# Arguments:
#   worktree-path   — absolute path to the worktree directory
#   branch-name     — the short branch name used in the worktree
#   merge-message   — commit message for the merge commit (use --no-ff)
#
# Exit codes:
#   0  — merged successfully (or branch had no commits to merge; worktree cleaned up)
#   1  — merge conflict; worktree NOT cleaned up (manual resolution required)
#   2  — bad usage or prerequisite failure
#
# Design notes:
# - --no-ff is mandatory: it preserves per-worktree provenance in the graph.
#   A fast-forward merge would lose the fact that commits came from an isolated
#   agent branch.
# - On conflict: do NOT auto-cleanup. The orchestrator must inspect the state,
#   resolve the conflict, and manually remove the worktree afterward.
# - The script is idempotent for the "no commits" case: safe to call even if
#   the agent made no changes.

set -euo pipefail

# --- Argument validation ---
if [ $# -ne 3 ]; then
  echo "usage: merge-worktree.sh <worktree-path> <branch-name> \"<merge-message>\"" >&2
  exit 2
fi

WORKTREE_PATH="$1"
BRANCH="$2"
MESSAGE="$3"

if [ -z "$WORKTREE_PATH" ] || [ -z "$BRANCH" ] || [ -z "$MESSAGE" ]; then
  echo "merge-worktree.sh: all three arguments are required and must be non-empty" >&2
  exit 2
fi

if [ ! -d "$WORKTREE_PATH" ]; then
  echo "merge-worktree.sh: worktree path does not exist: $WORKTREE_PATH" >&2
  exit 2
fi

# --- Check if branch has commits beyond main ---
COMMITS_AHEAD=$(git log "main..$BRANCH" --oneline 2>/dev/null || true)

if [ -z "$COMMITS_AHEAD" ]; then
  echo "merge-worktree.sh: no commits on '$BRANCH' beyond main — nothing to merge."

  # Cleanup: remove worktree and branch even if empty (clean slate).
  echo "merge-worktree.sh: cleaning up empty branch and worktree..."
  git worktree remove "$WORKTREE_PATH" --force 2>/dev/null || true
  git branch -d "$BRANCH" 2>/dev/null || git branch -D "$BRANCH" 2>/dev/null || true
  echo "merge-worktree.sh: cleanup complete."
  exit 0
fi

echo "merge-worktree.sh: merging '$BRANCH' into main ($( echo "$COMMITS_AHEAD" | wc -l | tr -d ' ') commits)..."
echo "$COMMITS_AHEAD" | sed 's/^/  /'

# --- Switch to main and merge ---
git checkout main

# Attempt the merge. Capture the exit code explicitly (set -e is active, so
# we use `|| MERGE_EXIT=$?` to prevent premature exit on conflict).
MERGE_EXIT=0
git merge --no-ff "$BRANCH" -m "$MESSAGE" || MERGE_EXIT=$?

if [ "$MERGE_EXIT" -eq 0 ]; then
  # --- Success path ---
  echo "merge-worktree.sh: merge succeeded."

  # Cleanup: remove the worktree and its branch.
  echo "merge-worktree.sh: removing worktree '$WORKTREE_PATH'..."
  git worktree remove "$WORKTREE_PATH" --force 2>/dev/null || {
    echo "merge-worktree.sh: WARNING — could not remove worktree (may already be gone)" >&2
  }

  echo "merge-worktree.sh: deleting branch '$BRANCH'..."
  git branch -d "$BRANCH" 2>/dev/null || {
    echo "merge-worktree.sh: WARNING — could not delete branch (may already be gone)" >&2
  }

  echo "merge-worktree.sh: done. Branch '$BRANCH' merged and cleaned up."
  exit 0
else
  # --- Conflict path ---
  echo "" >&2
  echo "CONFLICT: manual resolution needed." >&2
  echo "" >&2
  echo "  Branch '$BRANCH' could not be automatically merged into main." >&2
  echo "  Conflicting files:" >&2
  git diff --name-only --diff-filter=U 2>/dev/null | sed 's/^/    /' >&2
  echo "" >&2
  echo "  To resolve:" >&2
  echo "    1. Edit the conflicting files and fix the markers." >&2
  echo "    2. git add <resolved-files>" >&2
  echo "    3. git commit" >&2
  echo "    4. git worktree remove \"$WORKTREE_PATH\" --force" >&2
  echo "    5. git branch -d \"$BRANCH\"" >&2
  echo "" >&2
  echo "  Worktree and branch have NOT been deleted — they are left for inspection." >&2
  exit 1
fi
