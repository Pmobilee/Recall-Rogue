---
name: feature-pipeline
description: |
  Enforces a rigorous 8-phase workflow for ALL non-trivial tasks: Clarify, Research, Propose, Plan, Implement, Verify, Complete, Creative Pass. Always active. Governs how work gets done. Inherits the Employee Mindset from .claude/rules/autonomy-charter.md — defaults to action, never defers, only ships finished work.
user_invocable: false
---

# Feature Pipeline — Full Lifecycle Workflow

This skill is the outer workflow wrapper. It governs **what** work happens and in **what order**. It inherits (does not restate) the following rules:

- `.claude/rules/autonomy-charter.md` — Employee Mindset, Autonomy Ladder, Never Defer, Only Finished Work, Clarification Bar, Keep Going.
- `.claude/rules/player-experience-lens.md` — five mandatory checks on player-visible changes.
- `.claude/rules/creative-pass.md` — three-item Creative Pass at the end of every non-trivial task.
- `.claude/rules/agent-mindset.md` — What's Next forcing function, proactive skill triggers.
- `.claude/rules/task-tracking.md` — granular `TaskCreate` discipline.

If anything in this skill appears to conflict with the rules above, the rules win.

---

## STOP — Pre-Response Self-Check

Before EVERY response in a non-trivial task, ask:

1. **Am I about to ask a question the Clarification Bar says not to ask?** Per `autonomy-charter.md`, only ask if (a) two interpretations would produce materially different implementations, (b) a Red-zone action is required, or (c) the request contradicts a documented invariant. Otherwise: decide, state what you decided, move on.
2. **Am I about to deliver partial work and call it "done"?** Run the Finished-Work Checklist from `autonomy-charter.md`. If any item is incomplete, the deliverable is "in progress," not "done."
3. **Am I skipping the Creative Pass and `## What's Next`?** Both are mandatory on every non-trivial response. Missing them = incomplete deliverable.

---

## When This Skill Applies

Every task that is NOT a trivial single-line bugfix or config tweak: new features or mechanics, multi-file changes, content pipeline work, balance adjustments, UI/UX modifications, refactors, system integrations, any task with 2+ discrete steps.

**Bug fixes:** if the fix touches >3 files or requires design decisions, use the full pipeline. Clear, isolated fix: start at Phase 4 and skip 1–3.

## Parallel Task Handling

If a new request arrives while you are mid-implementation: finish the current unit, commit it, assess urgency of the new request, and either switch (with TaskUpdate) or finish the current plan first. Never interleave two separate workstreams in the same session without explicit user approval.

## The 8 Phases

### Phase 1: CLARIFY — Only If Seriously Unclear

**Default: skip this phase and proceed to Phase 2.** Per the Clarification Bar in `autonomy-charter.md`, ask a question only if one of three triggers fires:

1. Two interpretations would produce materially different implementations.
2. A Red-zone action is required (see Autonomy Ladder).
3. The request contradicts a documented invariant.

If none fire:
- Silently restate the goal to yourself in one sentence.
- Pick the most reasonable interpretation.
- State your interpretation in ONE sentence at the top of your response: *"Interpreting this as X — will proceed unless you stop me."*
- Continue straight to Phase 2.

If one does fire:
- Ask ONE question via `AskUserQuestion` with the best-guess default pre-filled, so the user can answer yes/no.
- Do not list five questions. Do not "interrogate."
- Wait for the answer, then continue.

**GATE:** either the interpretation has been stated in one sentence, or a single clarifying question has been answered.

---

### Phase 2: RESEARCH — Gather Context Before Planning

> **Anti-pattern: "Phantom Foundation"** — before building on top of any existing system, verify it exists and works. Don't assume a service is functional just because its code file exists.

1. Use Explore agents to understand existing patterns, related systems, and conflicts.
2. Online research when useful — WebSearch / WebFetch / context7. Don't guess when you can know.
3. Check git log for recent changes in affected areas; check auto-memory for related prior sessions.
4. Read related docs (`docs/INDEX.md` entry point, then the specific sub-files).
5. Identify risks: what could go wrong, what edge cases, what existing systems might break.

**GATE:** you have enough context to make informed architectural decisions.

---

### Phase 3: PROPOSE — Present Approach WITH Alternatives

**Never just do the first thing that comes to mind. Always think about whether there's a better way.** Skip ONLY if there is genuinely one reasonable approach (e.g., "add a field to this type").

1. Present your recommended approach with clear reasoning.
2. Present at least ONE alternative with tradeoffs.
3. Explain WHY your recommendation is best.
4. Flag concerns and mitigations.
5. If the task seems to be solving the wrong problem, say so: *"Instead of X, have you considered Y? It would solve the root cause."*
6. Estimate scope: "This touches N files and M discrete changes."

If the user rejects the proposal: ask what specifically they dislike, understand the WHY, revise, re-present.

**GATE:** user approves the approach before finalizing the plan.

---

### Phase 4: PLAN — Finalize

1. Use `/plan` (Claude planning mode) to produce the implementation plan. The plan IS the spec.
2. The plan must contain:
   - Overview with goal and reasoning.
   - Numbered task list with atomic items and acceptance criteria.
   - Files affected (created / modified / deleted).
   - Verification tests — specific tests (unit, visual, behavioral) that MUST pass.
   - Verification gate with exact commands.
3. Use `TaskCreate` to break the plan into trackable tasks per `.claude/rules/task-tracking.md`.
4. Testing Plan section: which unit tests, which visual inspections, which edge cases.

**GATE:** plan file exists, tasks are created, full scope covered.

---

### Phase 5: IMPLEMENT — Execute

> **Anti-patterns:** *Entity Names Without Data* (building a skeleton, not the real thing), *Silent Incompleteness* (shipping 80% without mentioning the missing 20%).

**Phase 4 → Phase 5 is seamless. Plan approval is the trigger to start implementing in the same response.** See `.claude/rules/autonomy-charter.md` → *Post-Plan-Approval Execution Trigger* for the hard rule, banned phrases, and self-check. Never end a response on plan approval without at least one concrete execution tool call.

1. **Immediately after approval:** create all TaskCreate items for the plan, mark the first `in_progress`, and spawn the first sub-agent or make the first file edit — all in the same response that acknowledged approval.
2. Mark tasks `in_progress` one at a time. Mark `completed` as you finish.
3. Delegate via `.claude/rules/agent-routing.md`. Use the canonical Sub-Agent Prompt Template from that file. Never spawn a generic worker.
4. After each sub-agent: verify against ground truth (`git status` + `git diff` + sample read-back). Never trust a summary blindly.
5. Commit after each task that passes verification. Granular commits make rollback surgical.
6. Visual inspect after every sub-agent batch if UI/visual changed.
7. **Scope creep guard:** if you discover the task is significantly bigger than planned, stop and tell the user. Give options: expand scope, split into follow-ups, or descope.

**GATE:** all plan tasks `completed`, all acceptance criteria met.

### Git Strategy

Conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`). Direct commits on `main` for small changes; feature branches only if user explicitly asks or the change is large and risky.

### Worker Failure Escalation

1. Iterate with more context — share the error and expected-vs-actual.
2. Fresh worker with lessons learned: "The previous attempt failed because X. Avoid Y. Make sure Z."
3. Escalate to user with specific failure details.

Never silently move on from a failing task.

### Rollback

If Phase 5 or 6 reveals the approach is fundamentally wrong: stop, find the last good commit, `git reset --hard <sha>` (with user confirmation per Autonomy Charter Red zone), return to Phase 3 with new knowledge.

---

### Phase 6: VERIFY — Test Everything Before "Done"

**This is where most failures happen. Do not rush.**

> **Anti-patterns:** *Should Work* (saying "this should work" without verifying), *Test Screen Only* (feature works via `__rrScenario` but not via normal gameplay).

1. Full gate: `npm run typecheck`, `npm run build`, `npx vitest run`.
2. Balance sim gate (if gameplay/balance touched): run headless sim per `.claude/rules/testing.md`, compare to baseline.
3. Docker visual inspect EVERY affected screen per `.claude/rules/testing.md` — screenshot + layout dump, not one without the other. After every sub-agent batch, not just at the end.
4. Specific tests from the plan's Testing Plan.
5. Registry freshness: `lastChangedDate` on every touched element in `data/inspection-registry.json`.
6. Edge-case verification: boundary, empty, error states.
7. **Intent re-check:** does this actually solve what the user asked for? Any gap? Fix now.
8. **Activation verification:** is the feature reachable via normal gameplay, not just a test scenario?
9. **End-to-end wiring audit:** for every new function/resolver/service method, grep for consumers. If nothing calls it, it's dead code — feature not done.
10. **Player-Experience Lens** per `.claude/rules/player-experience-lens.md` — five checks on any player-visible change.

**GATE:** everything passes, feature works in the real game, real user can reach it, every new function has a caller, balance is acceptable.

---

### Phase 7: COMPLETE — Document, Close, Confirm

1. Update `docs/GAME_DESIGN.md` for any player-facing change.
2. Update `docs/architecture/`, `docs/mechanics/`, `docs/ui/`, `docs/content/`, etc. per domain.
3. Update inspection registry (`data/inspection-registry.json`) — `lastChangedDate`, new entries, deprecated entries.
4. Mark all TaskList tasks `completed`.
5. Commit with a conventional-commit message.

---

### Phase 8: CREATIVE PASS & WHAT'S NEXT

**Mandatory for every non-trivial response.** Per `.claude/rules/creative-pass.md` and `.claude/rules/agent-mindset.md`.

1. Write the three-item Creative Pass:
   - "While I was in there…" — adjacent improvement (ship Green-zone, log Yellow/Red)
   - "A senior dev would…" — one concrete design insight
   - "Player would want…" — one concrete player-experience improvement
2. Write the `## What's Next` block — 3–5 prioritized next steps with reasoning, OR the single-line `✅ Done. No further work recommended. Rationale: …` closer.
3. Save any non-obvious lessons to auto-memory per `memory` docs.

A response without both is incomplete, same severity as an untested change.

---

## When Things Go Wrong

**User rejects proposal (Phase 3):** ask what specifically, revise, re-present.
**Worker output fails verification (Phase 5):** follow the escalation ladder — more context → fresh worker → escalate.
**Phase 6 reveals a fundamental flaw:** stop, roll back, return to Phase 3.
**Scope explodes mid-implementation:** stop immediately, tell the user, give options.

## Anti-Patterns Reference

- **Entity Names Without Data** — skeletons without substance.
- **Should Work** — declaring done without verifying.
- **Silent Incompleteness** — shipping 80% without mentioning the missing 20%.
- **Junior Colleague** — blindly executing without questioning (Autonomy Charter explicitly fights this).
- **Resolver Without Consumer** — creating a function nothing calls.
- **Doc Drift** — changing code without updating docs same-commit.
- **Phantom Foundation** — building on top of something that doesn't actually work.
- **Test Screen Only** — works in dev scenarios, unreachable in real gameplay.

## Quick Reference: When to Start at Each Phase

- **Phase 1 (Clarify)** — ONLY when Clarification Bar fires. Otherwise skip.
- **Phase 2 (Research)** — the real default entry for most tasks.
- **Phase 3 (Propose)** — when you have research and want approval.
- **Phase 4 (Plan)** — isolated bug fixes that need no design discussion.
- **Phase 5 (Implement)** — resuming a session with an existing plan.
- **Phases 6, 7, 8 are never skipped for non-trivial work.**
