# Documentation-First Rule

## Core Principle

Documentation is read FIRST, updated LAST, and never skipped.

## Before Any Code Change
1. Navigate to `docs/INDEX.md`
2. Find the relevant sub-file for what you're changing
3. Read it to understand current state and conventions
4. If no doc covers your area, that's a gap — flag it or create the doc

## After Every Code Change
1. Update the relevant doc sub-file to reflect your changes
2. This is part of the task, not a follow-up
3. Include actual function names, values, and file paths
4. If you found a doc contradiction, fix it AND add a gotcha entry

## Doc Structure
Each sub-file under `docs/` must:
- Cover ONE system or domain
- Stay under ~200 lines
- Have a purpose header listing source files it documents
- Be independently useful

## Sub-Agent Propagation — MANDATORY
Every sub-agent prompt MUST include:
> "Read the relevant doc files under docs/ BEFORE writing any code. After your changes, update those same doc files. Navigate via docs/INDEX.md."

## Persist Everything — Sessions Can End Abruptly

The user may stop a session at ANY time without warning. You cannot rely on a clean shutdown.

**After EVERY meaningful change (not batched, not "at the end"):**
1. Commit and push your work to your branch immediately
2. Update the relevant docs, memory, gotchas, and rules IN THE SAME commit
3. If working in a worktree, push the branch — lingering unpushed worktrees get lost

**At natural breakpoints (task completion, phase transition, or when asked):**
1. Push all changes to your branch
2. ASK THE USER: "Should I merge this into main?" — they may forget about lingering branches
3. If the user says yes, merge and clean up the worktree
4. If they say not yet, remind them the branch name so they can find it later

**Never defer persistence.** Don't plan to "update docs at the end" or "push when done." Every commit should leave the repo in a state where another agent can pick up where you left off.

## Gotchas
When you discover non-obvious behavior or make a mistake:
- Append to `docs/gotchas.md` immediately
- Format: `### YYYY-MM-DD — Brief Title` followed by what/why/fix
- NEVER edit or remove existing entries — append only
