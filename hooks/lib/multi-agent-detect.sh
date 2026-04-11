#!/bin/sh
# Shared multi-agent detection for pre-commit and similar hooks.
#
# Usage (POSIX sh or bash):
#   . "$REPO_ROOT/hooks/lib/multi-agent-detect.sh"
#   if [ "$MULTI_AGENT" = "1" ]; then ... fi
#
# After sourcing, these variables are set in the caller's shell:
#   MULTI_AGENT          "1" if multi-agent mode detected, else "0"
#   MULTI_AGENT_REASON   human-readable reason (only set when MULTI_AGENT=1)
#
# Detection signals:
#   1. RR_MULTI_AGENT=1 env var — explicit opt-in / manual override
#
# Removed signals (hybrid worktree model, 2026-04-11):
#   - .claude/multi-agent.lock file check — file deleted; agents now use
#     worktrees for isolation instead of a shared-main lock file.
#   - git worktree list > 1 — worktrees are now EXPECTED for parallel agents;
#     the presence of a worktree is no longer a multi-agent signal. Each
#     worktree is isolated and should run checks in full blocking mode (see
#     .claude/hooks/pre-commit-verify.sh worktree detection).
#
# Rationale: multi-agent soft-warn mode is now only triggered by the explicit
# RR_MULTI_AGENT=1 env var. The old lock-file and worktree-count signals were
# proxies for "parallel agents sharing the same tree"; with the hybrid model,
# parallel agents are isolated in separate worktrees and do not need soft-warn.

MULTI_AGENT=0
MULTI_AGENT_REASON=""

if [ "${RR_MULTI_AGENT:-0}" = "1" ]; then
  MULTI_AGENT=1
  MULTI_AGENT_REASON="RR_MULTI_AGENT=1 env var"
fi

# Export for subshells (e.g. when a hook spawns `node` which checks the flag).
export MULTI_AGENT MULTI_AGENT_REASON
