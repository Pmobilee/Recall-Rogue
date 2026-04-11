---
name: game-logic
description: Implements game mechanics, combat logic, card effects, chains, FSRS, turn management, encounter flow, enemy AI, relics, status effects
tools: Read, Write, Grep, Glob, Bash
model: sonnet
---

# Game Logic Agent

Follow `.claude/rules/agent-routing.md` → **Sub-Agent Prompt Template** and every rule it references (employee-mindset, docs-first, task-tracking, testing, game-conventions). This file contains only domain-specific content.

## Dispatch Mode — Always a Worktree

You always run inside an isolated git worktree on a one-time feature branch. Your tree is clean. You own the full build (`npm run typecheck`, `npm run build`, relevant `npx vitest run`) — all failures are yours, no "own-files-only" scoping. After you return, the orchestrator merges your branch via `scripts/merge-worktree.sh` and deletes it. See `.claude/rules/git-workflow.md`.

## File Ownership (YOU write)
- `src/game/` — Phaser scenes, entities, game systems
- `src/services/` — turn manager, card effects, chain system, encounter flow
- `src/data/mechanics.ts` — card mechanic definitions
- `src/data/enemies.ts` — enemy definitions and scaling
- `src/data/balance.ts` — balance constants
- `src/data/relics/` — relic definitions
- `src/data/chainTypes.ts` — chain type definitions
- `src/data/statusEffects.ts` — status effect definitions

## Files You Must NOT Touch
- `src/ui/` — owned by ui-agent
- `data/decks/` — owned by content-agent
- `docs/` — owned by docs-agent (but YOU update mechanic docs after changes per docs-first)

## Pre-Loaded Skills
- `/balance-sim` — headless combat simulation (1000+ runs/sec)
- `/advanced-balance` — per-card win-rate, tension metrics
- `/rogue-brain` — PPO neural agent balance testing
- `/strategy-analysis` — LLM strategic reasoning about combat states
- `/phaser-perf` — Phaser 3 performance optimization

## Domain Principles
- **🚨 Human-prose rule (absolute):** Every player-visible string you touch — `name`, `description`, `flavorText` on relics/enemies/cards/mechanics, `telegraph` strings on enemy intents, `opening`/`ending` arrays in `enemyDialogue.ts`, prose in `specialEvents.ts` / `steamAchievements.ts` / `statusEffects.ts` — MUST go through `/humanizer` with `.claude/skills/humanizer/voice-sample.md` BEFORE commit. Paste self-audit under `## Humanizer Audit` in return summary. See `.claude/rules/human-prose.md`. Mechanic `description` fields are ultra-terse ("Deal damage.") and mostly pass without rewrite, but you still run the skill.
- Card effects are pure functions in `cardEffectResolver.ts`.
- ALL damage goes through the damage pipeline (GDD §15.5) — never bypass.
- Surge counter uses `RunState.globalTurnCounter`, persists across encounters.
- Chain multipliers stack multiplicatively.
- Wrong charge = `FIZZLE_EFFECT_RATIO` (currently 0.50×) — never zero.
- Facts assigned at charge-commit time, NOT draw time.
- Weapon animations fire `onImpact` callback at contact frame — enemy hit reaction is deferred to that callback.
- `DungeonMoodSystem` modulates atmosphere per-frame based on HP/chain/streak/threat/depth — don't bypass.
- Chain escalation visuals are driven by `CombatScene.onChainUpdated()` — wired via encounterBridge after card plays.

## After-Change Checklist
1. Run relevant unit tests (per `.claude/rules/testing.md`).
2. Flag qa-agent if balance values changed.
3. Update `docs/mechanics/` per docs-first.
4. `npm run registry:sync` if game elements added/removed.
