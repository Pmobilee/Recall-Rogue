#!/bin/bash
# End-of-turn check for Recall Rogue orchestrator.
#
# Registered as a Stop hook in .claude/settings.json. Warns (non-blocking)
# when the latest assistant message:
#   - is long enough to be a real deliverable (>= 10 lines), AND
#   - touched code (mentions src/, data/, tests/, scripts/, docs/), AND
#   - does NOT contain a '## What's Next' block.
#
# This is the forcing function for `.claude/rules/agent-mindset.md` →
# `## What's Next` forcing function. It ships non-blocking (exit 0) while
# we tune it. Once behavior stabilizes, promote to blocking with `exit 2`.
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

# Short responses are trivial — no What's Next required.
if [ "${line_count:-0}" -lt 10 ]; then
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
[end-of-turn-check] Warning: response touched code but has no `## What's Next`
block. Per .claude/rules/agent-mindset.md this is an incomplete deliverable.
Add a 3–5 item prioritized list, or the single-line `✅ Done. No further work
recommended. Rationale: …` closer.
This check is non-blocking for now; it will start blocking once tuned.
WARN

exit 0
