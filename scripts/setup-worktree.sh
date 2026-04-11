#!/bin/bash
# WorktreeCreate hook — fires when Claude Code spawns an Agent with
# `isolation: "worktree"`. Canonical contract is JSON on stdin:
#
#   {
#     "branch_name":   "agent-abc123",
#     "worktree_path": "/abs/path/to/.claude/worktrees/agent-abc123",
#     "session_id":    "...",
#     "hook_event_name":"WorktreeCreate",
#     ...
#   }
#
# Responsibilities:
#   1. Parse stdin JSON (primary). Fall back to env vars (legacy harness) and
#      then to CWD derivation (last resort). All three paths must produce a
#      usable $WORKTREE_PATH + optional $BRANCH_NAME.
#   2. Ensure the worktree actually exists at $WORKTREE_PATH. If the harness
#      has not already created it, `git worktree add -B "$BRANCH_NAME"
#      "$WORKTREE_PATH" HEAD` creates it from current main HEAD on a fresh
#      one-time branch.
#   3. Symlink node_modules from the main checkout into the worktree (avoids
#      a 30-60s npm install per spawn). The main checkout is resolved via
#      `git rev-parse --git-common-dir` so this works from any worktree.
#   4. Print the resolved worktree path to stdout (required by the hook
#      contract so the harness knows where to dispatch the agent).
#   5. Exit 0 on success, non-zero to abort the dispatch cleanly.
#
# Why `-B` not `-b`: a previous aborted dispatch may have left the branch name
# in the local ref space. `-B` force-recreates it from HEAD, guaranteeing a
# clean starting point. The branch is one-time and gets deleted by
# `scripts/merge-worktree.sh` after the agent returns, so there is no risk of
# clobbering meaningful history.

set -uo pipefail
# NOTE: -e is intentionally omitted so fallback paths still run if a step
# (e.g. a jq parse) returns non-zero. We check each step's output explicitly.

# ---------------------------------------------------------------------------
# 1. Parse input — stdin JSON (primary) → env vars (legacy) → CWD (last resort)
# ---------------------------------------------------------------------------

PAYLOAD=""
if [ ! -t 0 ]; then
  PAYLOAD="$(cat 2>/dev/null || true)"
fi

BRANCH_NAME=""
WORKTREE_PATH=""

if [ -n "$PAYLOAD" ] && command -v jq >/dev/null 2>&1; then
  BRANCH_NAME="$(printf '%s' "$PAYLOAD" | jq -r '.branch_name   // empty' 2>/dev/null || true)"
  WORKTREE_PATH="$(printf '%s' "$PAYLOAD" | jq -r '.worktree_path // empty' 2>/dev/null || true)"
fi

# Legacy env-var contract (kept so old harness versions still work).
if [ -z "$WORKTREE_PATH" ] && [ -n "${WORKTREE_NAME:-}" ] && [ -n "${BASE_PATH:-}" ]; then
  WORKTREE_PATH="${BASE_PATH}/${WORKTREE_NAME}"
  BRANCH_NAME="${BRANCH_NAME:-$WORKTREE_NAME}"
  echo "setup-worktree.sh: using legacy env-var contract (WORKTREE_NAME=$WORKTREE_NAME)" >&2
fi

# Last-resort: assume CWD is already inside a harness-created worktree.
if [ -z "$WORKTREE_PATH" ]; then
  WORKTREE_PATH="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
  echo "setup-worktree.sh: no payload and no env vars — falling back to CWD $WORKTREE_PATH" >&2
fi

# Derive a sensible branch name if we still don't have one.
if [ -z "$BRANCH_NAME" ]; then
  BRANCH_NAME="agent-$(basename "$WORKTREE_PATH")"
fi

# ---------------------------------------------------------------------------
# 2. Resolve main checkout root — uses --git-common-dir so it works from
#    inside a worktree OR from the main checkout.
# ---------------------------------------------------------------------------

COMMON_DIR="$(git rev-parse --git-common-dir 2>/dev/null || true)"
if [ -n "$COMMON_DIR" ] && [ -d "$COMMON_DIR" ]; then
  # Resolve to absolute path in case --git-common-dir returns ".git"
  COMMON_DIR_ABS="$(cd "$COMMON_DIR" && pwd)"
  MAIN_CHECKOUT="$(dirname "$COMMON_DIR_ABS")"
else
  MAIN_CHECKOUT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
fi

# ---------------------------------------------------------------------------
# 3. Ensure the worktree exists. If the harness pre-created it, this is a
#    no-op. Otherwise we create it on a one-time branch at current HEAD.
# ---------------------------------------------------------------------------

# A worktree directory always contains a `.git` file (not a directory) that
# points back at `main/.git/worktrees/<name>`. If that marker is absent, we
# need to create the worktree ourselves.
if [ ! -e "$WORKTREE_PATH/.git" ]; then
  # Make sure parent directory exists.
  mkdir -p "$(dirname "$WORKTREE_PATH")"

  # `-B` force-creates or resets the branch from HEAD. This is what makes the
  # hook idempotent across retries and across stale branch refs from aborted
  # sessions.
  if ! git -C "$MAIN_CHECKOUT" worktree add -B "$BRANCH_NAME" "$WORKTREE_PATH" HEAD >&2; then
    echo "setup-worktree.sh: git worktree add failed for $WORKTREE_PATH on branch $BRANCH_NAME" >&2
    exit 1
  fi
  echo "setup-worktree.sh: created worktree at $WORKTREE_PATH on branch $BRANCH_NAME" >&2
else
  echo "setup-worktree.sh: worktree already exists at $WORKTREE_PATH (harness pre-created)" >&2
fi

# ---------------------------------------------------------------------------
# 4. Symlink node_modules from main checkout (fast boot).
# ---------------------------------------------------------------------------

if [ -d "$MAIN_CHECKOUT/node_modules" ]; then
  if [ ! -e "$WORKTREE_PATH/node_modules" ]; then
    ln -sf "$MAIN_CHECKOUT/node_modules" "$WORKTREE_PATH/node_modules"
    echo "setup-worktree.sh: symlinked node_modules from $MAIN_CHECKOUT" >&2
  else
    echo "setup-worktree.sh: node_modules already present (skipping symlink)" >&2
  fi
else
  echo "setup-worktree.sh: no node_modules in main checkout — skipping symlink (agent will need to install)" >&2
fi

# ---------------------------------------------------------------------------
# 5. Print resolved path to stdout (hook contract requirement).
# ---------------------------------------------------------------------------

echo "$WORKTREE_PATH"
exit 0
