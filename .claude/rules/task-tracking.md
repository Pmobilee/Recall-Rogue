# Task Tracking — MANDATORY

## Core Rule

EVERY non-trivial task MUST use CLI tasks (TaskCreate, TaskUpdate, TaskList). No exceptions. If it's not a single-line fix, it needs tasks.

## Before Starting Work
- Break ALL work into granular TaskCreate tasks BEFORE writing any code
- One task per discrete step — not high-level phases
- Every pool, every batch, every assembly step, every validation check gets its own task
- Mark `in_progress` when beginning each task

## During Work
- Mark `completed` immediately when done — not batched
- Failed tasks stay `in_progress` as visible reminders — never delete failed work
- If new sub-tasks are discovered, create them immediately

## Before Committing
- Run TaskList and verify ZERO pending tasks
- If anything is pending, that work hasn't been done and the deliverable is incomplete

## Why This Exists
Three entire answer pools were skipped in the Medical Terminology deck (2026-04-03) because they weren't tracked as tasks. This is the #1 cause of incomplete deliverables. Tasks are the only reliable way to ensure nothing is forgotten.

## Every Agent Must Follow This
This rule applies to ALL agents — content-agent, game-logic, ui-agent, qa-agent, docs-agent. No agent is exempt. The orchestrator must also track its own coordination tasks.
