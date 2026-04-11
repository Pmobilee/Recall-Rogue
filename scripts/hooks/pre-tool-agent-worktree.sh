#!/bin/bash
# PreToolUse hook — BLOCKS Agent dispatches of file-editing sub-agents that
# don't pass `isolation: "worktree"`. This is the hard enforcement of the
# worktree-mandatory policy documented in `.claude/rules/git-workflow.md`.
#
# Why this exists: on 2026-04-11, three cross-session bundling races landed
# (`713ea981c`, `4a1ba6f5c`, `63995b4ce`) because sub-agents edited shared
# `main` while a parallel session's `git add` swept their files into wrong-
# titled commits. The worktree-mandatory policy is the fix, but it only
# works if future sessions actually follow it. The user explicitly asked:
# "I don't write anything myself, so future sessions must know exactly
# what to do and do it automatically." This hook makes it automatic by
# refusing to let a file-editing dispatch happen outside a worktree.
#
# Payload: JSON on stdin (standard Claude Code hook contract).
#
#   {
#     "tool_name": "Agent",
#     "tool_input": {
#       "subagent_type": "ui-agent",
#       "description": "...",
#       "prompt": "...",
#       "isolation": "worktree"   // MUST be present for file-editing agents
#     },
#     "session_id": ...,
#     "hook_event_name": "PreToolUse"
#   }
#
# Behavior:
#   - If subagent_type is a read-only type (Explore, Plan, claude-code-guide,
#     general-purpose), pass through with exit 0.
#   - If subagent_type is a file-editing domain agent (game-logic, ui-agent,
#     content-agent, qa-agent, docs-agent) AND isolation != "worktree",
#     exit 2 with a clear error message. Claude Code exit code 2 blocks the
#     tool call and surfaces the message to the orchestrator.
#   - If subagent_type is unknown, pass through with exit 0 but log a warning
#     on stderr so the matcher table can be kept current.
#
# Exit codes:
#   0  — allow the dispatch
#   2  — BLOCK the dispatch (shows the message to the orchestrator)
#   Anything else is treated as allow by Claude Code, but we never exit
#   non-zero except 2 so this hook can't accidentally break the harness.

set -u

# --- Parse stdin JSON ---
payload="$(cat 2>/dev/null || true)"
if [ -z "$payload" ]; then
  # No payload — harness quirk, allow.
  exit 0
fi

if ! command -v jq >/dev/null 2>&1; then
  # No jq — can't parse, allow (hook can't enforce without jq, but don't
  # block the session either).
  echo "pre-tool-agent-worktree.sh: jq not found — allowing without check" >&2
  exit 0
fi

tool_name="$(printf '%s' "$payload" | jq -r '.tool_name // empty' 2>/dev/null || true)"
subagent_type="$(printf '%s' "$payload" | jq -r '.tool_input.subagent_type // empty' 2>/dev/null || true)"
isolation="$(printf '%s' "$payload" | jq -r '.tool_input.isolation // empty' 2>/dev/null || true)"
prompt_body="$(printf '%s' "$payload" | jq -r '.tool_input.prompt // empty' 2>/dev/null || true)"

# --- Guard: only check Agent tool calls ---
if [ "$tool_name" != "Agent" ]; then
  # Matcher should prevent this, but belt-and-suspenders.
  exit 0
fi

# --- Manual-fallback bypass marker ---
# The orchestrator-side manual fallback (see .claude/rules/git-workflow.md →
# "Silent Harness Fallback — Manual Worktree Procedure") pre-creates the
# worktree via scripts/setup-worktree.sh and embeds its path in the sub-agent
# prompt. In that mode the harness's `isolation` parameter is intentionally
# omitted (because using it would either create a second worktree or trigger
# the same silent fallback that forced the manual path in the first place).
# Allow dispatches that carry a literal `[WORKTREE: <abs path>]` marker in the
# prompt body, where <abs path> is an existing directory inside a real git
# worktree registered with `git worktree list`.
if [ -n "$prompt_body" ]; then
  marker_path="$(printf '%s' "$prompt_body" | grep -oE '\[WORKTREE: [^]]+\]' | head -n 1 | sed -E 's/^\[WORKTREE: (.+)\]$/\1/' || true)"
  if [ -n "$marker_path" ] && [ -d "$marker_path" ]; then
    # Verify the path is actually a registered git worktree. A bare directory
    # that looks like a worktree but isn't one would still allow the dispatch
    # here — item 11 of the sub-agent prompt template's self-check will catch
    # the downstream damage — but we do the cheap check here as a courtesy.
    if git worktree list --porcelain 2>/dev/null | grep -qE "^worktree ${marker_path}$"; then
      echo "pre-tool-agent-worktree.sh: manual-fallback marker present — dispatching into $marker_path" >&2
      exit 0
    fi
    echo "pre-tool-agent-worktree.sh: marker points at $marker_path but it is not a registered git worktree — falling through to isolation check" >&2
  fi
fi

# --- Classify the subagent_type ---
# File-editing domain agents MUST have isolation: "worktree".
# Keep this list in sync with `.claude/rules/agent-routing.md` routing table
# and with `.claude/agents/*.md` file ownership.
case "$subagent_type" in
  # File-editing agents — enforce worktree
  game-logic|ui-agent|content-agent|qa-agent|docs-agent)
    if [ "$isolation" != "worktree" ]; then
      cat >&2 <<EOF
╔══════════════════════════════════════════════════════════════════════╗
║  BLOCKED: worktree-mandatory policy violated                           ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                      ║
║  Sub-agent: $subagent_type
║  Isolation: ${isolation:-<not set>}
║                                                                      ║
║  Every file-editing sub-agent dispatch MUST pass                      ║
║      isolation: "worktree"                                            ║
║                                                                      ║
║  Why: cross-session \`git add\` races produced three bundling         ║
║  incidents on 2026-04-11 (713ea981c, 4a1ba6f5c, 63995b4ce).          ║
║  The worktree isolates your edits on a one-time branch so they       ║
║  cannot be swept up by a parallel session's commit.                   ║
║                                                                      ║
║  Fix: re-dispatch with isolation: "worktree" in the Agent call.      ║
║  The WorktreeCreate hook (scripts/setup-worktree.sh) will create     ║
║  the tree, symlink node_modules, and the sub-agent runs in           ║
║  isolation. After it returns, merge via scripts/merge-worktree.sh.   ║
║                                                                      ║
║  Full policy: .claude/rules/git-workflow.md                          ║
║                     → "Worktrees — MANDATORY for Every               ║
║                        File-Editing Dispatch"                         ║
║                                                                      ║
║  Read-only agent types (Explore, Plan, claude-code-guide,           ║
║  general-purpose) are exempt and pass without isolation.              ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
EOF
      exit 2
    fi
    # Worktree isolation confirmed — allow.
    exit 0
    ;;

  # Read-only agent types — never need worktrees.
  Explore|Plan|claude-code-guide|general-purpose|statusline-setup)
    exit 0
    ;;

  # Empty subagent_type — probably a harness edge case, allow with a log.
  "")
    exit 0
    ;;

  # Unknown subagent_type — don't block (may be a new agent type the
  # matcher table doesn't know about yet), but log a stderr warning so
  # the next pass updates this hook.
  *)
    echo "pre-tool-agent-worktree.sh: unknown subagent_type '$subagent_type' — allowed but please classify in the hook" >&2
    exit 0
    ;;
esac
