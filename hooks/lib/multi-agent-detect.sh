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
# Detection signals (any one trips the flag):
#   1. RR_MULTI_AGENT=1 env var — explicit opt-in
#   2. .claude/multi-agent.lock marker file — marker-file opt-in
#   3. git worktree list reports > 1 — automatic detection
#
# Rationale: when multiple Claude sub-agents edit, typecheck, build, and
# commit the same tree simultaneously, deterministic checks (skill drift,
# Docker visual verify) remain safe but probabilistic/timing-sensitive ones
# (typecheck, build, vitest, deck verify, quiz audit) flake spuriously from
# shared-state collisions. Hooks honor this signal by downgrading the
# flaky checks from BLOCK to WARN — the signal is not lost, just softened.

_rr_multi_agent_repo_root=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

MULTI_AGENT=0
MULTI_AGENT_REASON=""

if [ "${RR_MULTI_AGENT:-0}" = "1" ]; then
  MULTI_AGENT=1
  MULTI_AGENT_REASON="RR_MULTI_AGENT=1 env var"
elif [ -f "$_rr_multi_agent_repo_root/.claude/multi-agent.lock" ]; then
  MULTI_AGENT=1
  MULTI_AGENT_REASON=".claude/multi-agent.lock present"
else
  _rr_wt_count=$(git worktree list 2>/dev/null | wc -l | tr -d ' ')
  if [ "${_rr_wt_count:-0}" -gt 1 ]; then
    MULTI_AGENT=1
    MULTI_AGENT_REASON="$_rr_wt_count git worktrees active"
  fi
  unset _rr_wt_count
fi

unset _rr_multi_agent_repo_root

# Export for subshells (e.g. when a hook spawns `node` which checks the flag).
export MULTI_AGENT MULTI_AGENT_REASON
