#!/bin/bash
# Stop hook — parses the latest assistant message for a ## What's Next block
# and writes numbered items to .claude/pending-next-steps.json so the next
# session's /catchup skill can convert them into TaskCreate entries.
#
# See docs/roadmap/active/autonomy-overhaul-followups.md Item 5.
#
# Non-blocking (exit 0 always). If the message contains the Form B closer
# (`✅ Done. No further work recommended`), no file is written — there's
# nothing to persist.
#
# Paired with .claude/skills/catchup/SKILL.md which reads and consumes the
# file on the next session's first turn.

set -u

ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
OUT="$ROOT/.claude/pending-next-steps.json"

# Read Stop hook stdin JSON payload — contains transcript_path.
payload="$(cat 2>/dev/null || true)"
if [ -z "$payload" ] || ! command -v jq >/dev/null 2>&1; then
  exit 0
fi

transcript_path="$(printf '%s' "$payload" | jq -r '.transcript_path // empty' 2>/dev/null || true)"
if [ -z "$transcript_path" ] || [ ! -f "$transcript_path" ]; then
  exit 0
fi

# Extract the latest assistant message text (awk reverse + jq).
last_assistant_text="$(awk '{a[NR]=$0} END{for(i=NR;i>=1;i--) print a[i]}' "$transcript_path" 2>/dev/null \
  | jq -rs 'map(select(.type == "assistant")) | .[0] // {} | (.message.content // [] | map(select(.type == "text") | .text) | join("\n"))' \
  2>/dev/null || true)"

if [ -z "$last_assistant_text" ]; then
  exit 0
fi

# Skip if no What's Next block.
if ! printf '%s' "$last_assistant_text" | grep -qE "^## What's Next"; then
  exit 0
fi

# Skip Form B (Done closer) — nothing to persist.
if printf '%s' "$last_assistant_text" | grep -qE '✅ Done\. No further work recommended'; then
  exit 0
fi

# Extract the block: lines from "## What's Next" to the next H2 (or EOF).
block="$(printf '%s' "$last_assistant_text" \
  | awk '/^## What.s Next/{found=1; next} found && /^## /{exit} found {print}')"

if [ -z "$block" ]; then
  exit 0
fi

# Parse numbered items. A numbered item starts with "N. " at the start of
# a line. Multi-line items are joined by leading whitespace continuation.
# We keep it simple: one line per item, first paragraph only.
items_json="$(printf '%s' "$block" \
  | awk '
    BEGIN{item=""; count=0}
    /^[0-9]+\. /{
      if (item != "") {
        printf "%s\n", item
        count++
        if (count >= 5) exit
      }
      item=$0
      next
    }
    /^[[:space:]]+/{
      if (item != "") item = item " " $0
      next
    }
    /^$/{
      if (item != "") {
        printf "%s\n", item
        count++
        if (count >= 5) exit
        item=""
      }
      next
    }
    END{
      if (item != "" && count < 5) printf "%s\n", item
    }
  ' \
  | jq -Rs 'split("\n") | map(select(length > 0)) | map({
      raw: .,
      subject: (. | sub("^[0-9]+\\.\\s+"; "") | sub("\\s+—.*$"; "") | .[0:100]),
      description: (. | sub("^[0-9]+\\.\\s+"; ""))
    })' 2>/dev/null || echo '[]')"

# Bail if parsing produced nothing useful.
item_count="$(printf '%s' "$items_json" | jq 'length' 2>/dev/null || echo 0)"
if [ "${item_count:-0}" -lt 1 ]; then
  exit 0
fi

# Write the output file.
mkdir -p "$(dirname "$OUT")" 2>/dev/null || true
timestamp="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
printf '%s' "$items_json" | jq --arg ts "$timestamp" '{
  generated: $ts,
  source: "persist-whats-next.sh Stop hook",
  items: .
}' > "$OUT" 2>/dev/null || true

exit 0
