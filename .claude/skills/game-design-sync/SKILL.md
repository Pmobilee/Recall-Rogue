---
name: game-design-sync
description: Enforce that docs/GAME_DESIGN.md stays perfectly in sync with every gameplay change. This skill is ALWAYS ACTIVE and must be checked after any code change that touches gameplay, balance, UI, mechanics, enemies, rooms, cards, relics, or player-facing systems.
user_invocable: false
---

# Game Design Document Sync — ALWAYS ACTIVE

## The Rule

**`docs/GAME_DESIGN.md` is the single source of truth for how the game works.** Every gameplay change MUST be reflected in this document. Stale docs are treated as bugs with the same priority as broken tests.

## When GAME_DESIGN.md Must Be Updated

ANY change that touches:
- New mechanic, card type, enemy, status effect, relic, or system
- Modified balance values, damage numbers, heal amounts, costs
- Changed UX flow, screen transitions, room behavior
- New or modified room types (mystery, treasure, rest, shop)
- Enemy additions, renames, ability changes, animation overhauls
- Card reward system changes (reroll, upgrade chances, bonus relics)
- Ascension modifier changes
- Map/node distribution changes
- New UI components that are player-facing
- Quiz system changes (timer, scoring, mastery)

## What Does NOT Require an Update

- Internal refactors that don't change player-facing behavior
- Bug fixes that restore already-documented behavior
- Test-only changes
- Build/tooling/CI changes
- Sprite asset changes (unless they affect documented behavior)

## How to Update

1. Read the relevant section of `docs/GAME_DESIGN.md` first
2. Update the specific section that describes the changed system
3. If the change introduces a new system, add a new `###` subsection in the appropriate location
4. Include: what the system does, key constants/thresholds, file locations
5. Remove stale information that no longer applies — do NOT leave contradictions

## Sections Quick Reference

| Topic | Section in GAME_DESIGN.md |
|-------|--------------------------|
| Combat mechanics | 5. Combat System |
| Card types & effects | 4. Card System |
| Enemy bestiary | 5.5 Combat Visuals & Enemy Sprites |
| Relics | 6. Relic System |
| Dungeon map & rooms | 7. Run Progression |
| Mystery rooms | 7. Mystery Rooms — Floor-Scaled Events |
| Treasure rooms | 7. (note after node distribution table) |
| Rest sites | 7. Rest Site — Three Choices |
| Shop | 7. Shop System |
| Card rewards | 7. Card Reward System |
| Ascension | 8. Ascension System |
| Quiz & mastery | 3. Quiz System |
| Balance constants | Referenced inline with `src/data/balance.ts` paths |
| Animations | 5.5 Per-Enemy Lore-Driven Animations |

## Enforcement

This skill is referenced in CLAUDE.md under "Game Design Documentation — MANDATORY". Every worker prompt MUST include the instruction to update GAME_DESIGN.md. The orchestrator MUST verify docs are current after every worker task.

**If you are the orchestrator and a worker just completed a gameplay change**: read the relevant section of GAME_DESIGN.md and verify it matches the new code. If it doesn't, spawn a follow-up worker to fix it BEFORE marking the task done.

**If you are a worker implementing a gameplay change**: update GAME_DESIGN.md in the SAME task, not as a follow-up. The doc update is part of the implementation, not optional cleanup.
