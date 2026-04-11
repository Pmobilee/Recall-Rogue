#!/bin/bash
# WorktreeCreate hook — fires when Claude Code creates a worktree with isolation: "worktree".
#
# Env vars provided by the Claude Code harness:
#   WORKTREE_NAME  — the name of the new worktree (e.g. "agent-abc123")
#   BASE_PATH      — the base directory for worktrees (e.g. ".claude/worktrees")
#
# Responsibilities:
#   1. Symlink node_modules from the main checkout into the worktree so agents
#      do not need to re-install (saves 30-60s per spawn).
#   2. Print the worktree path to stdout (required by the hook contract).
#   3. Exit 0 on success, non-zero to abort worktree creation.
#
# Why symlink instead of copy: node_modules is ~300MB; copying is prohibitively
# slow and wastes disk. Agents only read node_modules — they never install new
# deps (Red-zone action requiring user confirmation). A symlink is safe.

set -euo pipefail

# Validate required env vars.
if [ -z "${WORKTREE_NAME:-}" ]; then
  echo "setup-worktree.sh: WORKTREE_NAME is not set" >&2
  exit 1
fi
if [ -z "${BASE_PATH:-}" ]; then
  echo "setup-worktree.sh: BASE_PATH is not set" >&2
  exit 1
fi

# Determine the main checkout root (the repo root of the process that triggered
# the hook — always the main checkout, never a nested worktree).
MAIN_CHECKOUT=$(git rev-parse --show-toplevel 2>/dev/null)
if [ -z "$MAIN_CHECKOUT" ]; then
  echo "setup-worktree.sh: could not determine git toplevel" >&2
  exit 1
fi

WORKTREE_PATH="$BASE_PATH/$WORKTREE_NAME"

# Symlink node_modules from main checkout.
# The worktree directory is created by the harness before this hook fires, so
# we only need to create the symlink inside it.
if [ -d "$MAIN_CHECKOUT/node_modules" ]; then
  if [ ! -e "$WORKTREE_PATH/node_modules" ]; then
    ln -sf "$MAIN_CHECKOUT/node_modules" "$WORKTREE_PATH/node_modules"
    echo "setup-worktree.sh: symlinked node_modules from $MAIN_CHECKOUT" >&2
  else
    echo "setup-worktree.sh: node_modules already exists in worktree (skipping symlink)" >&2
  fi
else
  echo "setup-worktree.sh: no node_modules in main checkout — skipping symlink (agent will need to install)" >&2
fi

# Print the worktree path to stdout — required by the hook contract so the
# harness knows where to find the tree.
echo "$WORKTREE_PATH"

exit 0
