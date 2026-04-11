---
name: catchup
description: Quick session context recovery — git log, working tree, memory. Use at the start of any conversation to get oriented fast. Runs in <5s by default.
---

# Session Catchup

Fast orientation, not a full audit. Keep it under 5 seconds unless the user asks otherwise.

## Default (fast mode, <5s)

Run these in parallel:
1. `git log --oneline -10` — recent commits
2. `git status --short` — uncommitted state (use `--short`, never `-uall`)
3. Read the last 5 entries in `MEMORY.md` (auto-memory index, already in context on most sessions)

If `.claude/pending-next-steps.json` exists, read it and mention the count in the summary. **Do NOT auto-create tasks from it** — just tell the user "N pending items from last session, want to pick them up?" and wait. That file is a hint, not a work queue.

## Summary (always)

Produce a 3–6 line summary:
- What was worked on recently (git log)
- Clean or dirty tree
- Pending-items count if any
- Suggested focus if obvious from context

Keep it brief. The goal is orientation, not a build report.

## Health mode — ONLY when explicitly asked

If the user says "catchup health" / "full catchup" / "is the build okay" or similar, additionally run:
- `npm run typecheck`
- `npm run build`
- Grep `.claude/commit-attribution-log.jsonl` for multi-agent warnings in last 24h (skip silently if jq/log absent)

Do NOT run these in default mode. They take 30–90s each and are almost never relevant to the user's first question.

## What NOT to do

- Don't run typecheck or build in default mode
- Don't auto-create tasks from pending-next-steps.json
- Don't write a long audit report — the user wants to start working, not read a summary
- Don't stamp registries, run deck verification, or touch any state
