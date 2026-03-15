---
name: work-tracking
description: Enforces AR-based work tracking for all implementation tasks. Ensures every session has a phase doc before any code is touched. Always active — check before starting any implementation work.
---

# 🚨🚨🚨 THIS IS THE MOST IMPORTANT RULE IN THE ENTIRE PROJECT 🚨🚨🚨
#
# EVERY non-trivial task MUST have an AR phase doc BEFORE any code is written.
# This means: new features, multi-file changes, content batches, refactors,
# balance changes, UI updates — EVERYTHING that takes more than 2 minutes.
#
# The AR doc goes in `docs/roadmap/phases/AR-NN-SHORT-NAME.md` and contains:
# - Overview of what's being done and why
# - Numbered TODO checklist with acceptance criteria per item
# - Files affected table
# - Verification gate (typecheck, build, tests)
#
# When ALL TODOs are checked off → move to `docs/roadmap/completed/`
#
# AGENTS: You are the #1 violator of this rule. DO NOT start coding without
# checking if an AR doc exists. If it doesn't exist, CREATE ONE FIRST.
# 🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨

# Work Tracking Enforcement

## ⛔ ABSOLUTE BLOCKER — READ THIS FIRST ⛔

**YOU MUST NOT WRITE A SINGLE LINE OF CODE, DELEGATE TO ANY SUB-AGENT, OR EDIT ANY FILE UNTIL YOU HAVE:**

1. Listed `docs/roadmap/phases/` to see active work
2. Found or created an AR phase doc for your current task
3. Read the phase doc — it is your implementation spec
4. Loaded the phase doc's TODO items into your `TodoWrite` session tracker

**This is NON-NEGOTIABLE. No exceptions. No "I'll do it after." No "let me just quickly..."**

## How It Works

- **`docs/roadmap/phases/`** = active/pending work. If a doc is here, it's not done.
- **`docs/roadmap/completed/`** = finished work. Moved here when all sub-steps pass.
- **There is NO index file.** The phase docs ARE the tracking system.
- To find next AR number: check both `phases/` and `completed/` directories.

## Phase Doc Format — MANDATORY TODO Checklist

Every AR phase doc MUST be structured as a comprehensive, granular TODO checklist. Each task is a single atomic action (one file, one edit, one verification). The format:

```markdown
# AR-NN: Phase Name

**Status:** In Progress | Complete
**Created:** YYYY-MM-DD
**Depends on:** AR-XX (status)

## Overview
One paragraph: what this phase delivers and why.

## Deliverables
Total: N files created/modified, M verification steps

## Tasks

### Section A: [Group Name]

- [ ] **A.1** Create `path/to/file.mjs` — [one-line description of what it does]
  - Acceptance: [what must be true when this is done]
- [ ] **A.2** Edit `path/to/other.mjs` — [what changes]
  - Acceptance: [verification criteria]
- [ ] **A.3** Run `node scripts/verify.mjs` — all checks pass
  - Acceptance: exit code 0, no FAIL results

### Section B: [Next Group]

- [ ] **B.1** ...

## Verification Gate

- [ ] `npm run typecheck` — clean
- [ ] `npx vitest run` — all pass
- [ ] Manual verification: [specific check]
- [ ] All section tasks checked off above

## Files Affected

| File | Action | Task |
|------|--------|------|
| `path/to/file.mjs` | NEW | A.1 |
| `path/to/other.mjs` | EDIT | A.2 |
```

### Rules for Writing Phase Docs

1. **Every task gets a checkbox** — `- [ ]` for pending, `- [x]` for done
2. **Tasks are atomic** — one file, one operation, one verifiable outcome
3. **Tasks have acceptance criteria** — what must be true when done
4. **Tasks are numbered** — `A.1`, `A.2`, `B.1` etc. for cross-referencing
5. **Verification gates are explicit** — exact commands to run, expected outcomes
6. **Files affected table** — every file touched, what action (NEW/EDIT/DELETE), which task
7. **No vague tasks** — "improve performance" is banned. "Reduce query time in fetch.mjs from 5s to <1s by adding batch caching" is correct.
8. **Estimate deliverable count** — "Total: 6 new files, 3 edits, 2 verification steps"

## Live Tracking During Sessions

### Starting a Phase

1. **Read the phase doc** from `docs/roadmap/phases/`
2. **Load all unchecked tasks into `TodoWrite`** — mirror the phase doc's checkboxes
3. **Mark each task `in_progress` → `completed`** as you work through them
4. **Update the phase doc checkbox** (`- [ ]` → `- [x]`) immediately after completing each task — not at the end

### During Work

- **ONE task at a time** — mark it `in_progress` in TodoWrite, do it, mark `completed`, check it off in the phase doc
- **Never batch completions** — check off each task the moment it's done
- **If a task reveals new work** — add new sub-tasks to the phase doc AND to TodoWrite
- **If a task is blocked** — note the blocker in the phase doc, move to the next unblocked task
- **After every 3-5 completed tasks** — re-read the phase doc to confirm you're on track

### Completing a Phase

When ALL checkboxes in the phase doc are `[x]`:

1. **Run the verification gate** — every command must pass
2. **Set status to `Complete`** in the phase doc header
3. **Move the phase doc** from `docs/roadmap/phases/` to `docs/roadmap/completed/`
4. **Update `docs/roadmap/PROGRESS.md`** — check off the phase
5. **Update `docs/GAME_DESIGN.md`** and `docs/ARCHITECTURE.md` if changes affect gameplay/systems/files
6. **Clear TodoWrite** — remove all completed tasks for this phase

Do NOT leave a completed phase in `phases/`. Do NOT leave unchecked boxes in a moved phase doc.

## After Context Compaction

When resuming after compaction:
1. List `docs/roadmap/phases/` to find active phase docs
2. Re-read the active phase doc — **scan for unchecked `- [ ]` boxes**
3. Re-read any canonical spec documents referenced in the phase doc
4. **Reload unchecked tasks into TodoWrite** — pick up where you left off
5. **NEVER continue from memory alone** — always re-read the source documents

## Content Pipeline Work — Additional Rules

When working on content pipeline (knowledge facts, vocabulary, geography):
1. **ALWAYS read `docs/RESEARCH/SOURCES/content-pipeline-spec.md` FIRST** — it is the canonical spec
2. **ALWAYS update `docs/RESEARCH/SOURCES/content-pipeline-progress.md`** after every batch operation
3. **NEVER generate facts without curated entity input** — follow the spec's Stage 2 pipeline
4. **NEVER tell Sonnet workers to "pick entities"** — workers receive structured entity data FROM you
5. The spec defines exact methodologies for entity selection, subcategory quotas, validation gates — follow them exactly

## Common Violations (DON'T DO THESE)

- ❌ Starting code before reading the phase doc
- ❌ Writing a phase doc with vague tasks like "implement feature"
- ❌ Forgetting to check off tasks as they're completed
- ❌ Leaving a fully-complete phase in `phases/` instead of moving to `completed/`
- ❌ Batching checkbox updates at session end instead of doing them per-task
- ❌ Not using TodoWrite to track live progress
- ❌ Continuing after compaction without re-reading the phase doc
- ❌ Creating tasks that aren't atomic (one task = one file operation or one verification)
