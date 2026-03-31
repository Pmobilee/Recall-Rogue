---
name: docs-keeper
description: Enforces docs-first agent culture — read docs before code, update docs after every change, modular sub-file structure. Always active.
trigger: ALWAYS ACTIVE — applies to every task, every agent, every session. No exceptions.
---

# Docs-Keeper — Documentation-First Enforcement

## Philosophy

Documentation is the FIRST thing any agent reads, and the LAST thing updated before a task is done. Agents must understand the system from docs BEFORE diving into code. This prevents wasted exploration, contradictory changes, and knowledge loss.

## The 5 Rules

### Rule 1 — Read Docs First
Before ANY code change, read the relevant doc files under `docs/`. Navigate via `docs/INDEX.md`.
- Changing combat logic? Read `docs/mechanics/combat.md` first.
- Changing UI layout? Read `docs/ui/layout.md` first.
- Adding an enemy? Read `docs/mechanics/enemies.md` first.
- If no doc covers what you're about to change, that's a gap — flag it or create the doc first.

### Rule 2 — Update Docs After Every Change
After EVERY code modification, update the relevant doc sub-file. This is not batched, not "I'll do it later" — it's part of the same task.
- Added a new service? Update `docs/architecture/services.md`.
- Changed a balance value? Update `docs/mechanics/combat.md` or the relevant mechanics file.
- Added a UI component? Update `docs/ui/components.md`.
- Changed screen flow? Update `docs/ui/screens.md`.

### Rule 3 — Modular Structure
Docs are organized as focused sub-files under `docs/`, not monoliths. Each sub-file:
- Covers ONE system or domain
- Stays under ~200 lines
- Has a purpose header and lists the source files it documents
- Is independently useful — an agent reading just that file should understand that system

Structure:
```
docs/
├── INDEX.md                    # Navigation hub
├── architecture/               # Code structure, services, data flow
├── mechanics/                  # Game systems, combat, cards, enemies
├── ui/                         # Components, screens, layout, animations
├── content/                    # Decks, facts, domains
├── testing/                    # Test strategy, headless sim, Playwright
├── gotchas.md                  # Append-only mistake log
└── GAME_DESIGN.md              # Design intent (not code docs)
```

### Rule 4 — Code Trumps Stale Docs
When a doc section contradicts code, the CODE is truth — but the doc MUST be fixed immediately, not ignored. Add a gotcha entry in `docs/gotchas.md` explaining the drift.

### Rule 5 — Sub-Agent Propagation
Every sub-agent prompt MUST include:
> "Read the relevant doc files under docs/ BEFORE writing any code. After your changes, update those same doc files to reflect what you changed. Navigate docs via docs/INDEX.md."

This is non-negotiable. Sub-agents that skip docs waste cycles rediscovering what's already documented.

## Gotchas Protocol

When an agent makes a mistake or discovers a non-obvious behavior:
1. Append to `docs/gotchas.md` immediately
2. Format: `### YYYY-MM-DD — Brief Title\nWhat happened, why, and the fix.`
3. NEVER edit or remove existing gotchas — append only

## Verification

After any task completion, the orchestrator checks:
- [ ] Were relevant docs read before code changes?
- [ ] Were docs updated to reflect changes?
- [ ] If a doc gap was found, was it filled?
- [ ] If a doc contradiction was found, was it fixed + gotcha added?

## Rule 6 — Persist Continuously, Not At The End

Sessions can end abruptly — the user may just close the terminal. NEVER defer documentation updates, memory writes, or commits to "the end of the session."

**After every meaningful change:**
- Commit + push immediately (not batched)
- Docs, memory, rules, gotchas updated in the SAME commit as code
- If in a worktree, push the branch — unpushed worktrees get lost

**At task completion or natural breakpoints:**
- Push all changes
- ASK THE USER: "Should I merge this into main?" — they forget about lingering branches
- Run `git worktree list` and flag any orphaned worktrees

Every commit should leave the repo in a state where a fresh agent can pick up seamlessly.

### Rule 7 — Zero-Threshold Policy
There is NO change too small for documentation. A single new prop on a component, a position value tweak, a renamed CSS class — ALL require doc updates. "It's trivial" or "I'll do it later" are NEVER acceptable. The user has explicitly demanded obsessive documentation discipline. Honor it.

## Integration with Other Skills

- **game-design-sync**: Handles `GAME_DESIGN.md` specifically. docs-keeper handles all OTHER docs.
- **feature-pipeline**: Phase 2 (Research) should include reading relevant docs. Phase 6 (Verify) should include checking doc updates.
- **work-tracking**: Task descriptions should note which docs were read/updated.
