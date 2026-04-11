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

## 5. Pending Next Steps (from previous session)

Check for `.claude/pending-next-steps.json`. If the file exists, it was written by the `persist-whats-next.sh` Stop hook at the end of the previous session and contains the last `## What's Next` items, parsed into `{subject, description}` entries.

**Consume-and-clear protocol (atomic):**

1. Read the file into memory (single `Read` call).
2. For each entry in `items`, call `TaskCreate` with the `subject` and `description` fields.
3. Delete the file: `rm .claude/pending-next-steps.json` via `Bash`.
4. In the summary (step 6 below), note how many pending items were carried over and explicitly ask the user whether to start on item #1, or continue with whatever they asked for.

**Important ordering:** read all items into memory BEFORE deleting the file. If `TaskCreate` fails partway through, the file is still intact on disk and the user can retry.

**If the file is missing or empty:** skip this step silently — the previous session either ended with Form B (`✅ Done`) or was a short research-only turn that produced nothing to carry forward.

## 6. Summary
Produce a concise 5-10 line summary:
- What was worked on recently (from git log)
- Current state (clean/dirty, any errors)
- Any relevant memory context
- Suggested focus for this session (if obvious from context)

Keep it brief. The goal is orientation in 30 seconds, not a full audit.
