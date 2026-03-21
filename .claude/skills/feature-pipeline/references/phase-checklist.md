# Feature Pipeline — Detailed Phase Checklists

Copy the relevant phase checklist into your working context when entering that phase.

---

## Phase 1: CLARIFY Checklist

```
CLARIFY Progress:
- [ ] Restated user's request in my own words
- [ ] Identified the GOAL behind the request (not just the literal action)
- [ ] Listed ambiguities and unstated assumptions
- [ ] Asked targeted questions with my best-guess answers (yes/no format)
- [ ] Performed the "Wikipedia Pipeline Test" — would the user be satisfied with a literal interpretation?
- [ ] Checked for completeness — are there related pieces the user didn't mention?
- [ ] Got user confirmation before proceeding
```

### When to skip Phase 1:
ONLY when: the user gave an unambiguous, specific request with clear acceptance criteria AND you've worked with this user before on similar tasks. When in doubt, don't skip.

### Questions to ask yourself:
- What problem is the user trying to solve?
- If I built exactly what they said, would they be happy? Or would they say "you missed the point"?
- Are there standard approaches for this that the user might not know about?
- Is there existing code that partially solves this already?

---

## Phase 2: RESEARCH Checklist

> **Phantom Foundation warning**: Before building on anything, verify it actually exists and works. Don't assume a service is functional just because its code file exists.

```
RESEARCH Progress:
- [ ] Explored codebase for existing patterns and related systems
- [ ] Verified that any existing system I plan to build on top of actually works
- [ ] Searched online for best practices (if applicable)
- [ ] Checked docs/roadmap/phases/ for related active ARs
- [ ] Read relevant sections of GAME_DESIGN.md and ARCHITECTURE.md
- [ ] Checked git log for recent changes in affected areas
- [ ] Identified risks, edge cases, and potential conflicts
- [ ] Have enough context to make informed decisions
```

### When to use WebSearch:
- Implementing a pattern you haven't used before in this codebase
- Working with a library or API you're not 100% sure about
- The user asks for something that has known best practices (accessibility, security, performance)
- You're about to make an architectural decision that's hard to reverse

### When to use Explore agents:
- Need to understand how an existing system works before modifying it
- Looking for all files that reference a specific function/type/constant
- Need to understand the data flow through multiple files

---

## Phase 3: PROPOSE Checklist

```
PROPOSE Progress:
- [ ] Formulated primary approach with clear reasoning
- [ ] Identified at least ONE alternative approach
- [ ] Explained tradeoffs between approaches
- [ ] Flagged any risks or concerns
- [ ] Considered if the task is solving the right problem (symptom vs. root cause)
- [ ] Estimated scope (files touched, discrete changes)
- [ ] Presented proposal to user and got approval
```

### When to skip Phase 3:
ONLY when there is genuinely only one reasonable approach — no meaningful alternatives exist (e.g., "add a field to this type"). If you're choosing between any two real options, don't skip.

### If user rejects the proposal:
Ask what specifically they dislike. Understand the WHY. Revise with that knowledge and re-present. Don't just pivot blindly.

### Alternative approach triggers:
- "Could this be simpler?" — often the answer is yes
- "Is there a library/existing pattern for this?" — avoid reinventing
- "What would break if we did it differently?" — find constraints
- "Will this still make sense in 3 months?" — avoid over-engineering too
- "Is the user asking for a symptom fix or a root cause fix?" — always prefer root cause

---

## Phase 4: PLAN (AR Creation) Checklist

```
PLAN Progress:
- [ ] Determined next AR number (check both phases/ and completed/)
- [ ] Created AR doc at docs/roadmap/phases/AR-NNN-SHORT-NAME.md
- [ ] Overview section: goal, reasoning, dependencies
- [ ] Tasks section: numbered, atomic, with acceptance criteria each
- [ ] Testing Plan section with specific tests to create/run
- [ ] Verification Gate section with exact commands
- [ ] Files Affected table
- [ ] AR covers the FULL scope from Phase 1 — nothing missing
```

### Never skip Phase 4:
Every non-trivial change needs an AR doc. Even for isolated bug fixes that skip Phases 1-3, write a minimal AR before touching code.

### Testing Plan template:
```markdown
## Testing Plan

### Unit Tests
- [ ] Create/update `src/services/X.test.ts` — test [specific behavior]
- [ ] Verify edge case: [specific edge case]

### Visual Inspection
- [ ] Navigate to [screen] and screenshot
- [ ] Verify [specific visual element] appears correctly
- [ ] Check [screen] at mobile viewport (390x844)
- [ ] Check console for errors on [screen]

### Behavioral Verification
- [ ] Use browser_evaluate to confirm [runtime state]
- [ ] Trigger [interaction] and verify [expected result]
- [ ] Test with empty/null/edge-case data

### Balance Simulation (if gameplay/balance changes)
- [ ] Run headless sim baseline before changes
- [ ] Run headless sim after changes
- [ ] Compare win rates, economy, clear rates — document results
```

---

## Phase 5: IMPLEMENT Checklist

> **Entity Names Without Data warning**: Are you building the real thing or just scaffolding? Verify data flows end-to-end.

> **Silent Incompleteness warning**: After each task, explicitly state what IS and IS NOT done. If something can't be completed, say so immediately.

```
IMPLEMENT Progress:
- [ ] Loaded AR tasks into working context
- [ ] For each task:
  - [ ] Marked in_progress
  - [ ] Delegated to Sonnet 4.5 worker (`model: "sonnet"`) with full context + acceptance criteria
  - [ ] Worker includes doc updates in same task
  - [ ] Verified worker output meets acceptance criteria
  - [ ] Visual inspection if UI/visual change
  - [ ] Committed after task passes verification (see Git Strategy)
  - [ ] Checked off task in AR doc
- [ ] All AR tasks checked off
- [ ] Scope creep check: is this bigger than planned? If yes, paused and told user.
- [ ] Mid-implementation check-in (if 10+ tasks): gave user progress update at ~50%
```

### Git Strategy:
- Commit after each task that passes verification — don't batch tasks
- Commit message format: `feat(AR-NNN): description` or `fix(AR-NNN): description`
- For large ARs (5+ tasks) or changes to core systems: use a feature branch `ar-NNN-short-name`
- For small ARs (1-4 tasks) on non-critical systems: committing directly to main is fine

### Worker Failure Escalation:
1. **First attempt fails**: Give more context — share the exact error, acceptance criteria, expected vs. actual. Iterate.
2. **Second attempt fails**: Fresh worker with lessons from the first: "Previous implementation failed because X. Avoid Y."
3. **Third attempt fails**: Escalate to user with specific failure details and what you've tried.

### Rollback Plan:
If Phase 5 or 6 reveals the approach is fundamentally wrong:
1. Stop immediately — don't keep patching a broken foundation
2. Find last good commit: `git log --oneline`
3. Roll back: `git stash` (preserve current work) or `git reset --hard <sha>` (clean reset)
4. Return to Phase 3 with new knowledge, re-propose
5. Tell user what happened and why, then present new proposal

### Worker prompt template:
**All AR tasks are executed by Sonnet 4.5** (`model: "sonnet"`). Haiku is only for trivial/mechanical subtasks. Include these in EVERY worker delegation:
1. The specific task(s) from the AR with acceptance criteria
2. "Update docs/GAME_DESIGN.md and docs/ARCHITECTURE.md if changes affect gameplay, balance, systems, or file structure."
3. "After implementation, run `npm run typecheck` and `npm run build`."
4. File paths and expected behavior
5. Any relevant context from Phase 2 research

---

## Phase 6: VERIFY Checklist

> **"Should Work" warning**: Confirm, don't assume. Either say "I confirmed it works" or "I cannot verify this." Never say "this should work."

> **"Test Screen Only" warning**: Verify via the real user path (hub → menus → gameplay), not just via `__terraScenario`.

```
VERIFY Progress:
- [ ] npm run typecheck — clean
- [ ] npm run build — clean
- [ ] npx vitest run — all pass
- [ ] Balance simulation run (if gameplay/balance change):
  - [ ] Headless sim results compared to baseline
  - [ ] Win rates / economy metrics acceptable
- [ ] Visual inspection of EVERY affected screen:
  - [ ] Screenshot taken
  - [ ] Console checked for errors
  - [ ] Feature works as user would experience it
- [ ] Testing Plan items from AR all pass:
  - [ ] Unit tests pass
  - [ ] Visual tests pass
  - [ ] Behavioral tests pass
- [ ] Edge cases verified (empty states, boundary conditions, error states)
- [ ] Activation check: feature reachable via normal user path (hub → menus → gameplay)
- [ ] Foundation check: all dependencies/systems I built on top actually work
- [ ] Wiring audit: every new function/resolver has at least one caller (grep to confirm)
- [ ] Intent re-check: "Does this solve what the user asked for in Phase 1?"
- [ ] Explicitly stated what IS and IS NOT included
```

### Headless balance simulator commands:
```bash
# All profiles, 1000 runs each (use before and after for comparison):
npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 1000

# Single profile:
npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 500 --profile scholar

# Relic audit:
npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/relic-audit.ts
```

Run the sim BEFORE making changes to get a baseline, then AFTER to compare. Document both results in the AR.

### Visual inspection commands:
```
1. mcp__playwright__browser_navigate → http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial
2. browser_evaluate(() => window.__terraScreenshot()) — full page screenshot (Phaser + DOM)
3. mcp__playwright__browser_snapshot
4. mcp__playwright__browser_console_messages
5. For Phaser canvas: browser_evaluate(() => window.__terraDebug())
6. For specific states: browser_evaluate(() => window.__terraScenario.load('scenario-name'))
```

### If Phase 6 reveals a fundamental flaw:
Don't patch — see Rollback Plan in Phase 5 checklist. Stop, roll back, return to Phase 3.

---

## Phase 7: COMPLETE Checklist

> **Doc Drift warning**: Docs must match code. A mechanic added without a GAME_DESIGN.md update is a future mystery bug. Don't leave stale references.

```
COMPLETE Progress:
- [ ] docs/GAME_DESIGN.md updated (if player-facing changes)
- [ ] docs/ARCHITECTURE.md updated (if systems/file structure changed)
- [ ] AR status set to "Complete"
- [ ] AR moved from phases/ to completed/
- [ ] Brief summary provided to user
- [ ] Screenshot/proof included if visual change
- [ ] Recommended next steps presented (MANDATORY — see criteria below)
- [ ] Learnings saved to auto-memory (if non-obvious — see criteria below)
- [ ] Post-ship check noted (flag this AR for smoke test at start of next session)
```

### Next steps criteria (MANDATORY — never skip):
After every completed AR, present a prioritized list of recommended next steps. Think deeply — these must be specific, reasoned, and actionable. Consider:
- What you discovered during implementation (risks, rough edges, fragile systems)
- What adjacent systems were exposed or affected
- What would compound the value of the work just completed
- What the user's likely next priority is given the project state

Format:
```
## Recommended Next Steps
1. **[Highest priority]** — [why this matters now]
2. **[Second priority]** — [why this matters now]
3. **[Optional/nice-to-have]** — [why this could wait]
```

Bad: "You could improve the UI." (vague, no reasoning)
Good: "The new relic tooltip system exposed that 3 relics have empty `description` fields — these will render as blank tooltips. Fix before the next playtest."

### Memory save criteria:
Save to auto-memory ONLY if the learning is genuinely non-obvious and would help a future session. Ask:
- "What surprised me about this implementation?"
- "What pattern did I discover that isn't obvious from reading the code?"
- "What anti-pattern did I narrowly avoid — and why would someone repeat it?"
- "What would have saved me 30+ minutes if I knew it at the start?"

Skip routine notes like "this file was changed" or "I used this service." Only save things with lasting signal value.

### Post-ship check:
At the start of the NEXT session, if this AR was completed in the last 1-2 sessions:
1. Load the affected screen (via Playwright or `__terraScenario`)
2. Check the console for new errors
3. Confirm the feature still works as expected
4. Note the result — "AR-NNN smoke test: passed" or escalate if broken

This catches silent regressions from unrelated changes made after this AR shipped.
