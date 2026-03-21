---
name: feature-pipeline
description: |
  Enforces a rigorous 7-phase workflow for ALL non-trivial tasks: Clarify, Research, Propose, Plan, Implement, Verify, Complete. Always active — triggers for any feature, refactor, content pipeline, balance change, UI modification, or system change that is not a single-line bugfix. Prevents blind implementation by requiring intent verification, proactive research, alternative proposals, AR documentation, visual testing, and doc sync. This is the master workflow skill that governs how work gets done.
user_invocable: false
---

# STOP — Pre-Response Self-Check

Before EVERY response in a non-trivial task, ask yourself these 3 questions:

1. **Am I about to implement without clarifying?** If the user's request has ANY ambiguity, ask first. Don't guess.
2. **Am I about to end a response without next steps?** Every milestone completion MUST end with "Recommended Next Steps" — prioritized, with reasoning. A summary without next steps is INCOMPLETE.
3. **Am I being a task executor or a partner?** A task executor does exactly what's asked. A partner questions whether it's the right thing, offers alternatives, and flags risks. Be a partner.

These are the three most common failure modes. Check them EVERY time.

---

# Feature Pipeline — Full Lifecycle Workflow

## When This Skill Applies

EVERY task that is NOT a trivial single-line bugfix or config tweak. This includes:
- New features or mechanics
- Multi-file changes of any kind
- Content pipeline work (fact generation, ingestion, etc.)
- Balance adjustments
- UI/UX modifications
- Refactors
- System integrations
- Any task with more than 2-3 discrete steps

**Bug fixes**: If the fix touches more than 3 files or requires design decisions, use the full pipeline. If it's a clear, isolated fix, start at Phase 4 (create a minimal AR doc) and skip Phases 1-3.

If in doubt, use this pipeline. The cost of following it for a simple task is low. The cost of NOT following it for a complex task is enormous.

## Skip Criteria — When to Short-Circuit Phases

These are the ONLY conditions under which phases may be skipped. When in doubt, don't skip.

**Skip Phase 1 (Clarify) ONLY when:**
- The user gave an unambiguous, specific request with clear acceptance criteria (e.g., "add a `maxHp` field to the Enemy type"), AND
- You have worked with this user before on similar tasks and understand their preferences

**Skip Phase 3 (Propose) ONLY when:**
- There is genuinely only one reasonable approach — no meaningful architectural alternatives exist (e.g., "add a field to this type")

**Never skip Phases 4, 5, 6, or 7** — these are mandatory for all non-trivial work regardless of how simple the task seems.

## Parallel AR Handling

If a new request arrives while you are mid-AR:
1. **Finish the current task** within the AR and commit that progress.
2. **Assess urgency**: If the new request is blocking or urgent, pause the AR by noting progress in the doc and switch. If it's not urgent, finish the current AR first.
3. **Never interleave two ARs** in the same session without explicit user approval — context switching mid-AR produces sloppy, inconsistent work.

## The 7 Phases

### Phase 1: CLARIFY — Understand Intent, Not Just Words

**Before touching any code or creating any AR, interrogate the request.**

1. Restate the user's request in your own words — what is the GOAL, not just the action?
2. Identify ambiguities, unstated assumptions, and missing context
3. Ask targeted questions, but ALWAYS include your best guess so the user can answer yes/no:
   - "I think you want X — is that right, or did you mean Y?"
   - "This could be done as A or B. I'd recommend A because [reason]. Sound good?"
4. **INTENT CHECK**: Ask yourself — "If I build exactly what was literally asked for, would the user actually be satisfied?" If no, say so:
   - "You asked for X, but I think what you actually need is Y, because [reason]. Should I do Y instead?"
5. Check for completeness: "Does this cover everything, or are there related pieces I should handle too?"

**The Wikipedia Pipeline Test**: Before proceeding, imagine you built the feature and showed it to the user. Would they say "yes, that's exactly what I wanted" or "no, you missed the whole point"? If the latter is even possible, you haven't clarified enough.

**GATE**: Do NOT proceed to Phase 2 until the user confirms understanding.

---

### Phase 2: RESEARCH — Gather Context Before Planning

> **Anti-pattern warning — "Phantom Foundation"**: Before building on top of any existing system, pipeline step, or data source, verify it actually exists and works correctly. Don't assume a service is functional just because its code file exists.

1. **Codebase exploration**: Use Explore agents to understand existing patterns, related systems, and potential conflicts
2. **Online research** (when useful): Search for best practices, library docs, design patterns relevant to the task. Use WebSearch and WebFetch proactively — don't guess when you can know.
3. **Check existing work**: Read `docs/roadmap/phases/` for related ARs, check git log for recent changes in affected areas
4. **Read related docs**: `docs/GAME_DESIGN.md`, `docs/ARCHITECTURE.md`, and any referenced specs
5. **Identify risks**: What could go wrong? What are the edge cases? What existing systems might break?

**GATE**: Have enough context to make informed architectural decisions.

---

### Phase 3: PROPOSE — Present Approach WITH Alternatives

**Never just do the first thing that comes to mind. Always think about whether there's a better way.**

1. Present your recommended approach with clear reasoning
2. Present at least ONE alternative approach with tradeoffs
3. Explain WHY your recommendation is best (not just what it is)
4. Flag any concerns: "This approach has a risk of X. We could mitigate by Y."
5. If the task seems like it might be solving the wrong problem, say so: "Instead of X, have you considered Y? It would solve the root cause rather than the symptom."
6. Estimate scope: "This touches N files and involves M discrete changes."

**If the user rejects the proposal**: Ask what they dislike specifically. Revise the proposal and re-present. Don't just accept a vague "do it differently" — understand WHY before changing course.

**GATE**: Get user approval on the approach before creating the AR.

---

### Phase 4: PLAN — Create the AR Phase Doc

1. Create `docs/roadmap/phases/AR-NNN-SHORT-NAME.md` following the work-tracking skill format
2. The AR MUST contain:
   - Overview with goal and reasoning
   - Numbered TODO checklist with atomic tasks and acceptance criteria per item
   - Files affected table
   - **Verification tests** — specific tests (unit, visual, or behavioral) that MUST pass before completion
   - Verification gate with exact commands
3. The AR is written by the **Opus orchestrator directly — NEVER delegated** to sub-agents. Opus writes the spec; Sonnet 4.5 executes it.
4. Include a "Testing Plan" section that specifies:
   - Which unit tests to create or update
   - Which visual inspections to perform (specific screens/states)
   - Which edge cases to verify
   - What the user should see when it's working correctly

**GATE**: AR doc exists and covers the full scope. If anything was missed from Phase 1, catch it here.

---

### Phase 5: IMPLEMENT — Execute the AR Spec

> **Anti-pattern warning — "Entity Names Without Data"**: Verify you are building the real thing, not just a skeleton. If you're implementing a pipeline step, confirm data actually flows through it end-to-end.

> **Anti-pattern warning — "Silent Incompleteness"**: Explicitly state what IS and IS NOT done after each task. If you can't complete something, say so immediately — don't let it silently disappear.

1. Follow the work-tracking skill: one task at a time, check off as completed
2. **Delegate to Sonnet 4.5 workers** (`model: "sonnet"`) for all implementation tasks. Haiku may be used for trivial/mechanical subtasks (formatting, boilerplate) but Sonnet 4.5 is the default executor for all AR work.
3. **Every worker prompt MUST include**:
   - "Update docs/GAME_DESIGN.md and docs/ARCHITECTURE.md if your changes affect gameplay, balance, systems, or file structure"
   - "After implementation, run npm run typecheck and npm run build"
   - The specific acceptance criteria from the AR
4. After each worker completes: commit if the task passes verification (see Git Strategy below)
5. After each worker completes: visually inspect with Playwright if UI/visual
6. If a worker's output doesn't meet acceptance criteria: iterate (see Failure Escalation below)
7. **Scope creep guard**: If during implementation you discover the task is significantly bigger than planned, STOP and tell the user: "This is bigger than we planned. Here's what I found: [details]. Should I update the AR scope, split into a follow-up AR, or descope?"
8. **Mid-implementation check-in**: For large ARs (10+ tasks), pause after ~50% completion and give the user a brief progress update: what's done, what's remaining, any surprises.

**GATE**: All AR tasks checked off, all acceptance criteria met.

### Git Strategy During Implementation

**When to commit**: After each worker task completes and passes verification (typecheck clean, tests pass, visual OK). Don't batch multiple tasks into one commit — granular commits make rollback surgical.

**Commit message format**: Reference the AR number in every commit.
```
feat(AR-120): add relic tooltip system
fix(AR-120): correct tooltip positioning on mobile viewport
docs(AR-120): update GAME_DESIGN.md with tooltip mechanic
```

**Feature branches**: For large ARs (5+ tasks) or ARs that touch core systems (combat, save/load, floor generation), create a feature branch:
```
git checkout -b ar-120-relic-tooltip
# ... implement ...
git checkout main && git merge ar-120-relic-tooltip
```

For small ARs (1-4 tasks) on non-critical systems, committing directly to main is acceptable.

### Worker Failure Escalation

When a worker's output fails verification:
1. **First attempt**: Give the same worker more context — share the error, the exact acceptance criteria, and what you expected vs. what you got. Iterate.
2. **Second attempt**: Spawn a fresh worker. Include the lessons from the first attempt: "The previous implementation failed because X. Avoid Y. Make sure Z."
3. **Third attempt**: Escalate to the user. "I've tried two approaches to implement [task]. Here's what's failing: [specific problem]. I need guidance before continuing."

Never silently move on from a failing task. Never tell the user something is done when it isn't.

### Rollback Plan

If Phase 5 or 6 reveals the approach was fundamentally wrong — not just a bug, but a wrong architecture:
1. **Stop immediately.** Don't keep patching a broken foundation.
2. Identify the last good commit: `git log --oneline` to find it.
3. Roll back: `git stash` to preserve current work for reference, or `git reset --hard <sha>` to the last good commit.
4. Return to Phase 3 with new knowledge. Re-propose with the insight gained.
5. Tell the user what happened and why: "The approach we chose doesn't work because [reason]. I've rolled back to [commit]. Here's what I'd propose instead."

---

### Phase 6: VERIFY — Test Everything Before Declaring Done

**This is where most failures happen. Do NOT skip or rush this phase.**

> **Anti-pattern warning — "Should Work"**: Never report a feature as done without confirming it works in the running game. Either say "I confirmed it works" or "I cannot verify this runtime behavior." Never say "this should work."

> **Anti-pattern warning — "Test Screen Only"**: A feature that works via `__terraScenario` but can't be reached by a real user is not done. Always verify via the real user path.

1. Run full verification gate: `npm run typecheck`, `npm run build`, `npx vitest run`
2. **Balance simulation gate** (mandatory if the change touches gameplay/balance — enemies, cards, relics, damage, HP, costs, turn economy):
   ```
   npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 1000
   ```
   Compare results against the pre-change baseline. If win rates, clear rates, or economy metrics shift significantly, investigate before declaring done.
3. **Visual inspection** of EVERY affected screen using Playwright:
   - Navigate to each affected screen
   - Take screenshots
   - Check console for errors
   - Verify the feature works as a user would experience it
4. **Run or create specific tests** from the AR's Testing Plan:
   - If unit tests were specified, run them and confirm they pass
   - If visual tests were specified, perform them with Playwright
   - If behavioral tests were specified, use browser_evaluate to check state
5. **Edge case verification**: Test boundary conditions, empty states, error states
6. **Intent re-check**: Look at the result and ask — "Does this actually solve what the user asked for in Phase 1?" If there's ANY gap, fix it now.
7. **Activation verification**: Is this feature actually reachable by the user through normal gameplay? Can they trigger it? Is it wired into the game flow, not just working on a test screen? Navigate to it the way a real user would — from the hub, through menus, into gameplay.
8. **Existence verification**: Before building on top of any existing system, verify it actually exists and works as expected. Don't assume a service, endpoint, data source, or pipeline step is functional — check it first.
9. **End-to-end wiring audit**: For every new function, resolver, service method, or data structure created during implementation, ask: "Who calls this? Is the call actually there?" Grep for each new export. If it's not called by a consumer, it's dead code and the feature is NOT done.
10. **Self-review pass**: After all tests pass, re-read the original user request from Phase 1. Walk through the implementation mentally as if you were the user. Ask: "If I play the game right now, will this feature actually fire? Can I trigger every path?"

**If Phase 6 reveals a fundamental flaw**: Don't patch — see Rollback Plan in Phase 5.

**GATE**: Everything passes. The feature works correctly in the actual game, not just in theory. A real user can reach it. Every new function has at least one caller. Balance metrics are acceptable (if applicable).

---

### Phase 7: COMPLETE — Document, Close, Confirm

> **Anti-pattern warning — "Doc Drift"**: Docs must match code. If you added a mechanic, it must appear in GAME_DESIGN.md. If you restructured a system, ARCHITECTURE.md must reflect it. Stale docs are bugs.

1. **Update documentation**:
   - `docs/GAME_DESIGN.md` — if any player-facing behavior changed
   - `docs/ARCHITECTURE.md` — if any systems or file structure changed
   - Any other referenced docs
2. **Move AR to completed**: `docs/roadmap/phases/` → `docs/roadmap/completed/`
3. **Confirm with user**: Brief summary of what was done, with screenshot if visual
4. **Recommend next steps** (MANDATORY — never skip this):
   After every completed AR, present **carefully considered next steps**. These are not throwaway suggestions — think deeply about what the user should do next based on:
   - What you learned during implementation (new risks, opportunities, rough edges discovered)
   - What adjacent systems were affected or exposed as fragile
   - What the user's likely next priority is given the project's current state
   - What would compound the value of the work just completed

   Format as a prioritized list with reasoning:
   ```
   ## Recommended Next Steps
   1. **[Highest priority]** — [why this matters now]
   2. **[Second priority]** — [why this matters now]
   3. **[Optional/nice-to-have]** — [why this could wait but is worth noting]
   ```

   Bad example: "You could also improve the UI." (vague, no reasoning)
   Good example: "The new relic tooltip system exposed that 3 relics have empty `description` fields — these will render as blank tooltips. I'd recommend fixing those before the next playtest."

5. **Save learnings to memory**: If this work revealed a non-obvious pattern, anti-pattern, or surprise — save it to auto-memory. Ask: "What would have saved me time if I knew it at the start? Would a future session benefit from knowing this?" Only save things that are genuinely non-obvious. Skip routine implementation notes.
6. **Post-ship check flag**: Note this AR as needing a spot-check at the start of the next session. At the beginning of the next conversation, if there are recently completed ARs (last 1-2 sessions), do a quick smoke test: load the affected screen, check the console, confirm the feature still works. This catches silent regressions from unrelated changes.

---

## When Things Go Wrong

### User rejects proposal (Phase 3)
Don't just accept and pivot. Ask what specifically they dislike. Understand the WHY. Revise the proposal with that knowledge and re-present. A revised proposal that misses the real concern wastes another round-trip.

### Worker output fails verification (Phase 5)
Follow the escalation ladder: iterate with more context → fresh worker with lessons learned → escalate to user with specific failure details. Never silently move on.

### Phase 6 reveals a fundamental flaw
Don't patch. Stop, roll back to the last good commit, return to Phase 3 with new knowledge. Tell the user exactly what happened and why.

### Scope explodes mid-implementation
STOP immediately. Tell the user exactly what happened: "While implementing [task], I discovered [unexpected complexity]. The scope is now [N times] larger than planned." Give clear options: expand the current AR, split into a follow-up AR, or descope. Never silently absorb scope explosion and deliver a surprise.

---

## Critical Anti-Patterns (Things That Have Gone Wrong Before)

These are consolidated here as a "lessons learned" reference. Inline warnings at each phase point to the most relevant ones.

### The "Entity Names Without Data" Anti-Pattern
Building the scaffolding of a feature without the actual substance. Example: creating a list of Wikipedia entity names but never fetching the actual Wikipedia articles. **Always ask: "Am I building the real thing, or just a skeleton?"**

### The "Should Work" Anti-Pattern
Reporting a feature as done without actually verifying it works in the running game. **Never say "this should work" — either confirm it works or say "I cannot verify this."**

### The "Silent Incompleteness" Anti-Pattern
Implementing 80% of what was asked without mentioning the missing 20%. **Always explicitly state what IS and IS NOT included in your implementation.** If you can't do something, say so upfront.

### The "Junior Colleague" Anti-Pattern
Blindly executing instructions without thinking about whether they make sense. **You are a partner, not a task executor.** If something seems wrong, suboptimal, or incomplete — speak up.

### The "Resolver Without Consumer" Anti-Pattern
Creating a function that computes a value but never wiring it into the code that uses that value. Example: `resolveDrawBias()` existed but `drawHand()` never called it — the relic was dead code. **After creating any resolver/helper/service function, ALWAYS grep for the consumer and wire it in. A function nobody calls is a function that doesn't exist.**

### The "Doc Drift" Anti-Pattern
Making code changes without updating the documentation that describes the system. **Doc updates are part of the implementation, not optional cleanup.**

### The "Phantom Foundation" Anti-Pattern
Building on top of something that doesn't actually exist or work. Before integrating with any existing system, pipeline step, or data source — **verify it exists and functions correctly first.** Don't assume the previous step in a chain is working just because its code file exists.

### The "Test Screen Only" Anti-Pattern
A feature works when you navigate directly to it via dev tools or test scenarios, but a real user can never reach it through normal gameplay flow. **Always verify the feature is accessible via the actual user path** — hub → menus → gameplay → feature.

---

## Relationship to Other Skills

This skill is the **outer workflow wrapper**. It governs WHAT work happens and in what order. The `work-tracking` skill is the **inner execution engine** — it governs HOW tasks within an AR are tracked and checked off. Use both together:
- `feature-pipeline` decides when to create an AR, what goes in it, and when it's truly done
- `work-tracking` manages the task-by-task execution within Phase 5
- `game-design-sync` is automatically enforced during Phases 5 and 7
- `quick-verify` is the toolset used during Phase 6

## Quick Reference: When to Start at Each Phase

**Phase 1 (Clarify)** — mandatory when:
- Request is vague, ambiguous, or could be interpreted multiple ways
- You're not confident what "done" looks like
- User says "do what you think is best"

**Phase 2 (Research)** — start here when:
- User gave a clear, specific request — but still do a quick internal intent check
- Continuing from a previous conversation where Phase 1 already happened

**Phase 3 (Propose)** — start here when:
- Research is complete and you have a strong recommendation but want approval before writing the AR

**Phase 4 (Plan)** — start here when:
- For isolated bug fixes that don't require design decisions — jump straight to writing a minimal AR
- Approach is already agreed upon from a prior conversation

**Phase 5 (Implement)** — start here when:
- Continuing work from a previous session with an existing AR — re-read the AR first

**Phases 4, 5, 6, 7 are never skipped for non-trivial work.**

## Reference

For detailed per-phase checklists, see [references/phase-checklist.md](references/phase-checklist.md).
