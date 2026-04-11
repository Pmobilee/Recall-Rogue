---
name: feature-pipeline
description: Workflow wrapper for non-trivial tasks — Research → Propose (if design-laden) → Plan → Implement → Verify → Document. Skip entirely for trivial tasks. Inherits from employee-mindset.md.
user_invocable: false
---

# Feature Pipeline — Workflow Wrapper

This skill governs **how** work proceeds for non-trivial tasks. For trivial tasks, skip it entirely.

Inherits (does not restate) from `.claude/rules/employee-mindset.md`: Autonomy Ladder, Never Defer, Finished-Work Checklist, Clarification Bar, Keep Going, Player-Experience Lens, Creative Pass, What's Next.

---

## Trivial vs Non-Trivial

**Trivial (skip this skill, go direct):**
- Single typo, single config tweak, single-line bugfix
- User gave you exact file paths and exact changes ("replace these 3 sprite paths")
- ≤5 files, mechanical edits, self-evident success criteria
- Pure doc updates that don't change code behavior

For trivial tasks: read the target files → edit → run relevant check (typecheck if code, nothing if docs) → commit. No plan, no proposal, no Creative Pass, no What's Next. Just ship it and report what you did in 1–3 lines.

**Non-trivial (use this skill):**
- New features or mechanics
- Multi-file changes with design decisions
- Refactors, system integrations, balance adjustments
- Content pipeline work with verification gates
- Tasks with 2+ discrete phases
- Anything a reasonable person would want a plan for

**Bug fixes:** isolated fix touching ≤3 files with clear cause → trivial path. Complex bug touching >3 files or requiring design → non-trivial.

---

## Phases (non-trivial only)

### 1. RESEARCH
Use Explore agents to understand existing patterns, related systems, conflicts. Check git log, docs (`docs/INDEX.md`), auto-memory. Identify risks.

**Anti-pattern — Phantom Foundation:** before building on top of an existing system, verify it actually works. A file existing ≠ the service working.

**Gate:** enough context to make informed decisions.

### 2. PROPOSE (only if design-laden)
Skip if there's only one reasonable approach. Otherwise: present your recommended approach with reasoning, ≥1 alternative with tradeoffs, concerns, scope estimate. If the request solves the wrong problem, say so.

**Gate:** user approves the approach (or you've decided there's only one).

### 3. PLAN
Use `/plan` (planning mode) for implementation plans on genuinely non-trivial work. The plan file is the spec — numbered tasks, files affected, verification commands.

Create `TaskCreate` items for each plan step per `.claude/rules/task-tracking.md`. `TaskList` must be empty before you commit.

**Gate:** plan file + tasks created.

### 4. IMPLEMENT
**Plan approval is the go-ahead** — in the same response, start executing. See `employee-mindset.md` → Keep Going. Banned phrases after approval: "standing by," "ready when you are," "kicking off now" (without actually starting).

1. Mark tasks `in_progress` one at a time, `completed` as you finish.
2. Delegate per `.claude/rules/agent-routing.md`. Use the canonical Sub-Agent Prompt Template.
3. After each sub-agent: verify against ground truth (`git status` + `git diff` + sample read-back). Never trust a summary blindly.
4. Commit after each task that passes verification. Granular commits = surgical rollback.
5. **Scope creep guard:** if you discover the task is significantly bigger than planned, stop and tell the user. Give options: expand, split, descope.

### 5. VERIFY
This is where most failures happen. Don't rush.

1. `npm run typecheck`, `npm run build`, `npx vitest run` (relevant tests).
2. Balance sim (if gameplay/balance touched) per `.claude/rules/testing.md`.
3. Docker visual verify **only if the change is observable** per `testing.md` → Visual Verify — Scoped. Skip for lint/test/doc-only edits.
4. Intent re-check — does this actually solve what the user asked?
5. Activation — is the feature reachable via normal gameplay, not just a test scenario?
6. End-to-end wiring — every new function/service has a caller (grep confirms).
7. PX Lens (player-visible changes only) per `employee-mindset.md`.

### 6. COMPLETE
Update `docs/GAME_DESIGN.md` for player-facing changes, relevant `docs/` sub-files, registry entries. Mark all tasks `completed`. Commit with a conventional-commit message.

### 7. CREATIVE PASS + WHAT'S NEXT
Per `.claude/rules/employee-mindset.md`. Required for non-trivial work, skipped for trivial work (see top of this file).

---

## Anti-Patterns

- **Entity Names Without Data** — skeletons without substance
- **Should Work** — declaring done without verifying
- **Silent Incompleteness** — shipping 80% without mentioning the missing 20%
- **Resolver Without Consumer** — creating a function nothing calls
- **Phantom Foundation** — building on top of something that doesn't actually work
- **Test Screen Only** — works in dev scenarios, unreachable in real gameplay
- **Ceremony-First** — running the full 7-phase workflow on a mechanical 3-file swap
