#!/bin/bash
# Shared helpers for Recall Rogue hook scripts.
#
# Usage:
#   source "$(dirname "$0")/lib/hook-common.sh"
#   hook_read_input       # sets HOOK_* env vars from stdin JSON
#   hook_loop_guard "$key_string"   # exits 0 if already processed this session
#   hook_emit_context "text to inject"
#
# Expected stdin JSON (PostToolUse):
#   {
#     "session_id": "...",
#     "transcript_path": "...",
#     "tool_name": "Write",
#     "tool_input": {"file_path": "/abs/path"},
#     "tool_response": {"success": true}
#   }
#
# Emits hook output to stdout as:
#   {"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"..."}}
#
# Loop guard uses /tmp/rr-hook-state-$HOOK_SESSION_ID to dedupe identical keys
# within a single Claude Code session. The file is a flat list of processed
# key strings, one per line.

# Buffered stdin payload — read once, read_input parses it.
HOOK_STDIN_PAYLOAD=""
HOOK_TOOL_NAME=""
HOOK_FILE_PATH=""
HOOK_SESSION_ID=""
HOOK_TOOL_SUCCESS=""
HOOK_TRANSCRIPT_PATH=""
HOOK_EVENT_NAME=""

hook_read_input() {
  if [ -z "$HOOK_STDIN_PAYLOAD" ]; then
    HOOK_STDIN_PAYLOAD="$(cat 2>/dev/null || true)"
  fi
  if ! command -v jq >/dev/null 2>&1; then
    # Without jq we can't parse safely — degrade gracefully.
    return 0
  fi
  if [ -z "$HOOK_STDIN_PAYLOAD" ]; then
    return 0
  fi
  HOOK_SESSION_ID="$(printf '%s' "$HOOK_STDIN_PAYLOAD" | jq -r '.session_id // empty' 2>/dev/null || true)"
  HOOK_TRANSCRIPT_PATH="$(printf '%s' "$HOOK_STDIN_PAYLOAD" | jq -r '.transcript_path // empty' 2>/dev/null || true)"
  HOOK_TOOL_NAME="$(printf '%s' "$HOOK_STDIN_PAYLOAD" | jq -r '.tool_name // empty' 2>/dev/null || true)"
  HOOK_FILE_PATH="$(printf '%s' "$HOOK_STDIN_PAYLOAD" | jq -r '.tool_input.file_path // empty' 2>/dev/null || true)"
  HOOK_TOOL_SUCCESS="$(printf '%s' "$HOOK_STDIN_PAYLOAD" | jq -r '.tool_response.success // "true"' 2>/dev/null || true)"
  HOOK_EVENT_NAME="$(printf '%s' "$HOOK_STDIN_PAYLOAD" | jq -r '.hook_event_name // "PostToolUse"' 2>/dev/null || true)"
}

# Returns 0 (ok to proceed) if the key has NOT been processed in this session.
# Returns 1 (skip) if the key has been processed — the caller should exit 0 early.
hook_loop_guard() {
  local key="$1"
  if [ -z "$key" ]; then
    return 0
  fi
  local session="${HOOK_SESSION_ID:-nosession}"
  local state_file="/tmp/rr-hook-state-${session}.log"
  if [ -f "$state_file" ] && grep -Fqx -- "$key" "$state_file" 2>/dev/null; then
    return 1
  fi
  mkdir -p "$(dirname "$state_file")" 2>/dev/null || true
  printf '%s\n' "$key" >> "$state_file"
  return 0
}

# Emit a JSON PostToolUse context-injection payload. Argument is the
# additionalContext string. Safely JSON-encoded via jq.
hook_emit_context() {
  local text="$1"
  if [ -z "$text" ]; then
    return 0
  fi
  local event_name="${HOOK_EVENT_NAME:-PostToolUse}"
  if command -v jq >/dev/null 2>&1; then
    jq -n --arg e "$event_name" --arg c "$text" '{
      hookSpecificOutput: {
        hookEventName: $e,
        additionalContext: $c
      }
    }'
  else
    # Fallback without jq — escape minimally.
    local escaped
    escaped="$(printf '%s' "$text" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' | tr '\n' ' ')"
    printf '{"hookSpecificOutput":{"hookEventName":"%s","additionalContext":"%s"}}\n' \
      "$event_name" "$escaped"
  fi
}

# Exit 0 silently if the given script path does not exist in the repo.
# Used for graceful degradation when a teammate hasn't pulled.
hook_bail_if_script_missing() {
  local script="$1"
  local root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
  if [ ! -f "$root/$script" ]; then
    exit 0
  fi
}

# Check if the current HOOK_FILE_PATH matches a glob (posix-ish).
# Returns 0 on match, 1 on no match or missing path.
hook_path_matches() {
  local glob="$1"
  if [ -z "$HOOK_FILE_PATH" ]; then
    return 1
  fi
  # Strip repo root prefix if present for cleaner glob matching.
  local root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
  local rel="${HOOK_FILE_PATH#$root/}"
  case "$rel" in
    $glob) return 0 ;;
    *) return 1 ;;
  esac
}
