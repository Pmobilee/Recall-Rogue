#!/bin/bash
# End-of-turn check for Recall Rogue orchestrator.
#
# Registered as a Stop hook in .claude/settings.json. Warns (non-blocking)
# when the latest assistant message is a substantial deliverable that is
# missing its '## What's Next' block.
#
# Per .claude/rules/employee-mindset.md → "What's Next Forcing Function",
# trivial tasks (mechanical edits, ≤5 files, self-evident success) are
# explicitly exempt. The threshold below (40 lines) is set so short
# mechanical-change responses never trigger this warning — the check only
# fires on genuinely substantial responses.
#
# IMPORTANT: exit code 2 is the blocking code for Claude Code hooks, not 1.
# This script deliberately uses exit 0 so it never interrupts the session.

set -u

# Claude Code passes a JSON payload on stdin for Stop hooks. It contains
# transcript_path — the JSONL file that holds the full conversation.
payload="$(cat 2>/dev/null || true)"
transcript_path=""
if command -v jq >/dev/null 2>&1 && [ -n "$payload" ]; then
  transcript_path="$(printf '%s' "$payload" | jq -r '.transcript_path // empty' 2>/dev/null || true)"
fi

# If we cannot locate the transcript, fail silently (non-blocking).
if [ -z "$transcript_path" ] || [ ! -f "$transcript_path" ]; then
  exit 0
fi

# Grab the last assistant message text. JSONL format: each line is a message.
# We want the `.message.content` of the most recent assistant entry.
# Note: macOS has no `tac`; we reverse with awk which works on both platforms.
last_assistant_text=""
if command -v jq >/dev/null 2>&1; then
  last_assistant_text="$(awk '{a[NR]=$0} END{for(i=NR;i>=1;i--) print a[i]}' "$transcript_path" 2>/dev/null \
    | jq -rs 'map(select(.type == "assistant")) | .[0] // {} | (.message.content // [] | map(select(.type == "text") | .text) | join("\n"))' \
    2>/dev/null || true)"
fi

if [ -z "$last_assistant_text" ]; then
  exit 0
fi

line_count="$(printf '%s\n' "$last_assistant_text" | wc -l | tr -d ' ')"

# Short/mechanical responses are trivial — no What's Next required.
# Threshold 40 matches the "trivial task" carve-out in employee-mindset.md.
if [ "${line_count:-0}" -lt 40 ]; then
  exit 0
fi

# Did it touch anything code-like? If not, it's probably research/chat.
if ! printf '%s' "$last_assistant_text" | grep -qE '\b(src/|data/|tests/|scripts/|docs/|\.claude/|CLAUDE\.md)' ; then
  exit 0
fi

# Does it already contain the forcing function?
if printf '%s' "$last_assistant_text" | grep -qE "^##[[:space:]]+What's Next" ; then
  exit 0
fi

# Warn on stderr (Claude Code surfaces this in the session) but do not block.
cat >&2 <<'WARN'
[end-of-turn-check] Warning: substantial response touched code but has no
`## What's Next` block. Per .claude/rules/employee-mindset.md, non-trivial
deliverables end with a 3–5 item prioritized list, or the single-line
`✅ Done. Rationale: …` closer. Trivial/mechanical tasks are exempt.
This check is non-blocking.
WARN

exit 0
