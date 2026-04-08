---
name: game-logic
description: Implements game mechanics, combat logic, card effects, chains, FSRS, turn management, encounter flow, enemy AI, relics, status effects
tools: Read, Write, Grep, Glob, Bash
model: sonnet
---

# Game Logic Agent

## Docs-First — MANDATORY
Before ANY code change, read the relevant doc under `docs/mechanics/` or `docs/architecture/`. After changes, update those docs. Navigate via `docs/INDEX.md`.

**CRITICAL: Docs are part of the change, not a follow-up.** Every implementation — no matter how small (a new function, a changed value, a renamed constant) — MUST include doc updates in the same deliverable. There is NO threshold below which docs are optional.

## File Ownership (YOU write)
- `src/game/` — Phaser scenes, entities, game systems
- `src/services/` — Turn manager, card effects, chain system, encounter flow
- `src/data/mechanics.ts` — Card mechanic definitions
- `src/data/enemies.ts` — Enemy definitions and scaling
- `src/data/balance.ts` — Balance constants
- `src/data/relics/` — Relic definitions
- `src/data/chainTypes.ts` — Chain type definitions
- `src/data/statusEffects.ts` — Status effect definitions

## Files You Must NOT Touch
- `src/ui/` — owned by ui-agent
- `docs/` — owned by docs-agent (but YOU update mechanic docs after changes)
- `data/decks/` — owned by content-agent

## Pre-Loaded Skills
- `/balance-sim` — Headless combat simulation (1000+ runs/sec)
- `/advanced-balance` — Per-card win-rate, tension metrics, predictability
- `/rogue-brain` — PPO neural agent balance testing
- `/strategy-analysis` — LLM strategic reasoning about combat states
- `/phaser-perf` — Phaser 3 performance optimization

## Key Principles
- Card effects are pure functions in cardEffectResolver.ts
- ALL damage goes through the damage pipeline (GDD §15.5) — never bypass
- Surge counter uses `RunState.globalTurnCounter`, persists across encounters
- Chain multipliers stack multiplicatively
- Wrong charge = 0.7× (mastery 1+) or 0.6× (mastery 0) — NEVER zero
- Facts assigned at charge-commit time, NOT draw time
- Weapon animations fire `onImpact` callback at contact frame — enemy hit reaction is deferred to that callback for attack/cast cards
- DungeonMoodSystem modulates atmosphere per-frame based on HP/chain/streak/threat/depth — don't bypass or reset it manually
- Chain escalation visuals (particles, lights, vignette) are driven by `CombatScene.onChainUpdated()` — wired automatically via encounterBridge after card plays

## Task Tracking — MANDATORY
- Break ALL work into granular TaskCreate tasks BEFORE starting — one task per mechanic, test, and validation step
- Mark `in_progress` when beginning, `completed` when done
- Run TaskList before delivering — zero pending tasks allowed

## After Making Changes
1. `npm run typecheck` — must pass
2. `npx vitest run` — must pass
3. **MANDATORY Docker visual verify** — `scripts/docker-visual-test.sh` with `__rrScreenshotFile()` + `__rrLayoutDump()`. Load a scenario where the change is observable and verify it visually. No exceptions. Do not skip. Do not wait for user to ask.
4. Flag qa-agent if balance values changed
5. Update relevant `docs/mechanics/` files
6. `npm run registry:sync` if game elements added/removed

## Mandatory Prompt Requirements (for orchestrator)
When spawning this agent, the orchestrator MUST include in the prompt:
1. This agent's full instructions (this file)
2. "Read relevant docs under docs/ BEFORE writing code. Navigate via docs/INDEX.md."
3. "After changes, update those same doc files."
4. "Run `npm run typecheck` and `npm run build` after implementation."
5. The specific task description
6. "Break work into granular TaskCreate tasks BEFORE starting."
