---
name: catchup
description: Quick session context recovery — shows recent git activity, active tasks, memory entries, and project health. Use at the start of any conversation to get oriented fast.
---

# Session Catchup

When invoked, perform these steps to give the user (and yourself) a quick picture of where things stand:

## 1. Recent Activity
Run `git log --oneline -15` to see the last 15 commits. Summarize what areas were touched.

## 2. Working Tree Status
Run `git status` to check for uncommitted changes or untracked files.

## 3. Project Health
Run these in parallel:
- `npm run typecheck` — are there type errors?
- `npm run build` — does the build succeed?
Report pass/fail for each (don't dump full output unless there are errors).

## 4. Memory Context
Read the last 5 entries in MEMORY.md to recall recent feedback, project decisions, or user preferences.

## 5. Summary
Produce a concise 5-10 line summary:
- What was worked on recently (from git log)
- Current state (clean/dirty, any errors)
- Any relevant memory context
- Suggested focus for this session (if obvious from context)

Keep it brief. The goal is orientation in 30 seconds, not a full audit.
