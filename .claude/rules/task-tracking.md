# Task Tracking — Canonical Rule

**Every piece of work uses CLI tasks (`TaskCreate`, `TaskUpdate`, `TaskList`). No exceptions. No "too small." No "just a quick fix."**

This is the canonical source. All other rules, skills, and agent definitions reference this file — they MUST NOT re-state the discipline.

## Why

Three entire answer pools were skipped in the Medical Terminology deck on 2026-04-03 because they weren't tracked as tasks. **If it's not a task, it will be forgotten.** Mental tracking fails at scale. Tasks don't.

## Rules

**Before starting work:**
- Break ALL work into granular `TaskCreate` tasks BEFORE writing any code.
- One task per discrete step — not high-level phases.
- Every pool, every batch, every assembly step, every validation check, every doc update gets its own task.
- Even "trivial" work gets tasks: reading docs, one-line fixes, verification, doc sync. The overhead is near-zero; the cost of forgetting is high.

**During work:**
- Mark `in_progress` when beginning each task.
- Mark `completed` immediately when done — not batched "for the end."
- Failed tasks stay `in_progress` as visible reminders — never delete failed work.
- If new sub-tasks are discovered, create them immediately.

**Before committing:**
- Run `TaskList` and verify ZERO pending or in-progress tasks.
- If anything is open, that work hasn't been done — the deliverable is incomplete, not done.

## Applies To Everyone

Every agent — orchestrator, game-logic, ui-agent, content-agent, qa-agent, docs-agent. No role is exempt.
