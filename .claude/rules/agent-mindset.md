# Agent Mindset — Professional Game Developer Standards

## Self-Review Protocol — After EVERY Step

**OBSESSIVE VERIFICATION — NON-NEGOTIABLE.** After completing ANY step — code change, sub-agent result, content edit, script run — you MUST verify the output before moving on. Sample results, check for broken grammar, validate data integrity, read back what was written. NEVER trust that a sub-agent or script produced correct output without checking. This applies after EVERY user message where something changed.

After completing any step (code change, research, sub-agent result, verification), pause and ask:

1. **Did I CHECK the output?** — Read back samples. Grep for broken patterns. Validate at least 5-10 items from any batch operation. Sub-agents produce broken output ~15-20% of the time. Catch it NOW, not after commit.
2. **Docker visual verify done?** — MANDATORY. Run `scripts/docker-visual-test.sh` with `__rrScreenshotFile()` + `__rrLayoutDump()` after EVERY code change. No exceptions. Do not wait for user to ask. This is automatic and silent.
3. **What's missing?** — Did I forget a related system, edge case, or integration point?
4. **What tests?** — Does this need a unit test, visual test, balance sim, or /inspect run?
5. **What should I ask the user?** — Am I making assumptions about intent, scope, or priority?
4. **What's affected?** — What other systems does this touch? Save/load? Audio catalog? Inspection registry? Docs?
5. **What would a player experience?** — Walk through the player's perspective. Is there feedback? Sound? Polish? Confusion?
6. **What should be researched?** — Is there a better pattern in the codebase? A skill I should suggest? A doc I haven't read?

## Running Scratchpad

During complex tasks, maintain a temporary scratchpad (via task comments, inline notes, or a temp doc) tracking:
- Ideas and improvements noticed along the way
- Gaps and concerns to raise with the user
- Things that seem off but aren't part of the current task
- Suggestions a senior game developer would make

Surface these to the user at natural checkpoints — don't silently move on.

## Production-Ready Standard

Every deliverable must meet this bar:

- **End-to-end wired**: Connected to game loop, screen flow, save system, and player experience. "The code exists" is NOT "it's in the game."
- **Player-facing polish**: Visual feedback, SFX wiring (check audio catalog), appropriate animations, loading states
- **Edge cases handled**: First run, empty state, max state, error state, rapid input, screen resize
- **Save/load compatible**: New state persisted correctly, migration if schema changed
- **Documented**: Docs updated in same commit, gotchas appended if applicable
- **Tested**: Appropriate test level — unit, visual, balance sim, or /inspect

If ANY of these are missing, the task is NOT complete. Flag what's remaining rather than delivering incomplete work silently.

## Proactive Suggestions — Mandatory

Do not just execute instructions. Actively think about:
- "While implementing X, I noticed Y could benefit from Z"
- "Players might expect W here — should we add it?"
- "This interacts with [system] in a way we should discuss"
- "A Steam reviewer would notice [issue] — we should address it"
- "This needs SFX/audio wiring per the audio catalog"
- "The inspection registry should be updated for this new element"

The user explicitly wants a collaborator who thinks about things they would never imagine. Over-communicate rather than under-communicate.

## Proactive Skill Triggers — Check Every Conversation

These skills say "proactively suggest" but have no enforcement. YOU must remember to offer them:

| When This Happens | Suggest These Skills |
|---|---|
| Balance, cards, enemies, relics, shop prices discussed | `/rogue-brain`, `/strategy-analysis`, `/advanced-balance` |
| UI changed, new screen, layout modified | `/visual-inspect`, `/ux-review` |
| New game element added (enemy, relic, card, room) | `/inspect`, `/validate-data`, `/audio-manager` |
| Game feel, juice, polish, player engagement discussed | `/audio-manager` |
| New room backgrounds added | `/depth-transitions` |
| Any testing or verification question | `/inspect` (master orchestrator — always suggest this first) |
| Gameplay change committed | Check `/game-design-sync` (is GAME_DESIGN.md still accurate?) |
| New curated deck completed | `/curated-trivia-bridge` (bridge to trivia DB) |

## Anti-Patterns — What "Monkey's Paw" Looks Like

These are FAILURES even if the code compiles:
- Feature exists in code but isn't reachable from any screen or menu
- New mechanic with no visual/audio feedback
- Service created but not registered or imported anywhere
- UI component built but not added to any screen flow
- Data added but not loaded by the runtime
- Test passing but not actually testing the right thing
- "It works in dev" but breaks in production build

## Research Before Implementation

For ANY task beyond a trivial fix:
1. Read docs first (docs/INDEX.md → relevant sub-file)
2. Read relevant skill definitions if one exists
3. Check if similar patterns exist in the codebase — reuse, don't reinvent
4. Consider the /feature-pipeline phases: Clarify, Research, Propose, Plan, Implement, Verify, Complete
5. If the task touches balance: suggest /strategy-analysis, /rogue-brain, or /balance-sim
6. If the task touches UI: suggest /visual-inspect and /ux-review after implementation
