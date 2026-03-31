#!/usr/bin/env bash
# Chrome browser lock — prevents concurrent agent conflicts
# Usage:
#   scripts/chrome-lock.sh acquire [agent-id]  — acquire lock (fails if held)
#   scripts/chrome-lock.sh release             — release lock
#   scripts/chrome-lock.sh check               — check if locked (exit 0=free, 1=locked)
#   scripts/chrome-lock.sh wait [timeout_secs]  — wait until free, default 60s
#   scripts/chrome-lock.sh status              — print lock status

LOCK_FILE="/tmp/rr-chrome.lock"

is_locked() {
  [ -f "$LOCK_FILE" ]
}

case "${1:-status}" in
  acquire)
    if is_locked; then
      echo "LOCKED by $(cat "$LOCK_FILE")"
      exit 1
    fi
    echo "${2:-unknown-agent} $(date '+%Y-%m-%d %H:%M:%S')" > "$LOCK_FILE"
    echo "Lock acquired"
    exit 0
    ;;
  release)
    rm -f "$LOCK_FILE"
    echo "Lock released"
    exit 0
    ;;
  check)
    if is_locked; then
      exit 1  # locked
    fi
    exit 0  # free
    ;;
  wait)
    timeout=${2:-60}
    elapsed=0
    while [ $elapsed -lt $timeout ]; do
      if ! is_locked; then
        echo "Chrome is free"
        exit 0
      fi
      echo "Chrome locked by $(cat "$LOCK_FILE"), waiting... (${elapsed}s/${timeout}s)"
      sleep 5
      elapsed=$((elapsed + 5))
    done
    echo "Timeout waiting for Chrome"
    exit 1
    ;;
  status)
    if is_locked; then
      echo "LOCKED by $(cat "$LOCK_FILE")"
      exit 1
    else
      echo "FREE"
      exit 0
    fi
    ;;
  *)
    echo "Usage: chrome-lock.sh {acquire|release|check|wait|status} [arg]"
    exit 2
    ;;
esac
