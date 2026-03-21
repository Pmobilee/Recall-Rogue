# AR-200: Card Expansion — Master Orchestration Document

**Source:** `docs/RESEARCH/EXPANSION_FINAL_PRODUCTION.md`
**Priority:** Critical — this is the game's content expansion
**Estimated complexity:** Very High (60 new cards, 36 new relics, 2 new status effects, 3 new systems, combo removal)

## Overview

This is the master AR that coordinates all expansion sub-ARs. It does NOT contain implementation tasks itself — those live in the sub-ARs below. This document defines the dependency chain, the implementation order, and the verification gates between phases.

**The expansion spec is the single source of truth:** `docs/RESEARCH/EXPANSION_FINAL_PRODUCTION.md`

Workers implementing any sub-AR MUST read the relevant sections of the expansion spec before writing code. Every card, relic, status effect, and interaction ruling is defined there — do not deviate.

## Sub-AR Dependency Chain

```
AR-201 (Kill Echo + Combo) ← START HERE, blocks everything
    |
    +---+---+---+
    |   |   |   |
AR-202 AR-203 AR-204 AR-205
(Cursed) (Burn/  (Inscr.  (Unlock
         Bleed)  +Browser) Gating)
    |   |   |   |
    +---+---+---+
           |
        AR-206 (Cards Phase 1: 30 cards — needs AR-203, AR-204, AR-205)
           |
        AR-207 (Cards Phase 2: 15 cards — needs AR-206)
           |
        AR-208 (Cards Phase 3: 23 cards — needs AR-206, AR-207)
           |
        AR-211 (All 36 Relics — needs AR-202, AR-203, AR-205. Can parallel with AR-207/208)
           |
        AR-209 (Unlock Schedule Wiring — needs AR-208, AR-211)
           |
        AR-210 (Balance Pass — needs AR-209)
           |
        AR-212 (Art Studio Prompts — needs AR-208, AR-211)
           |
        AR-213 (GAME_DESIGN.md Full Sync — needs AR-210)
           |
        AR-214 (Final Integration Test — needs AR-213)
```

## Sub-AR Summary

| AR | Name | Depends On | Cards | Relics | Systems | Est. Tasks |
|----|------|-----------|-------|--------|---------|------------|
| AR-201 | Kill Echo + Kill Combo | None | 0 | -3 (remove) | Echo removal, combo removal | 8 |
| AR-202 | Cursed Card System | AR-201 | 0 | 0 | Cursed facts, visuals, auto-cure | 12 |
| AR-203 | Burn + Bleed Status Effects | AR-201 | 0 | 0 | 2 new status effect types | 10 |
| AR-204 | Inscription System + Card Browser | AR-201 | 0 | 0 | Inscription keyword, card browser UI | 10 |
| AR-205 | Card Unlock Gating | AR-201 | 0 | 0 | Level-gated mechanic unlock | 6 |
| AR-206 | Cards Phase 1 (Filler + Basics) | AR-203, AR-204, AR-205 | 30 | 0 | — | 18 |
| AR-207 | Cards Phase 2 (Identity) | AR-206 | 15 | 0 | — | 12 |
| AR-208 | Cards Phase 3 (Advanced) | AR-206, AR-207 | 23 | 0 | — | 14 |
| AR-209 | Unlock Schedule Wiring | AR-208, AR-211 | 0 | 0 | Character level tables | 6 |
| AR-210 | Balance Pass | AR-209 | 0 | 0 | Headless sim validation | 8 |
| AR-211 | All New Relics | AR-202, AR-203, AR-205 | 0 | 36 | Relic definitions + triggers | 16 |
| AR-212 | Art Studio Prompts | AR-208, AR-211 | 0 | 0 | Sprite gen prompts | 8 |
| AR-213 | GAME_DESIGN.md Full Sync | AR-210 | 0 | 0 | Documentation | 4 |
| AR-214 | Final Integration Test | AR-213 | 0 | 0 | Full game testing | 10 |

**Total: ~138 tasks across 14 sub-ARs**

## Rules for All Sub-AR Workers

Every sub-AR worker MUST:

1. **Read the expansion spec** (`docs/RESEARCH/EXPANSION_FINAL_PRODUCTION.md`) — the relevant Part/Section for their task
2. **Read Appendix F** (Confirmed Interaction Rulings) before implementing ANY mechanic that interacts with other systems
3. **Read Appendix E** (Damage Pipeline) before touching `cardEffectResolver.ts`
4. **Add MASTERY_UPGRADE_DEFS entries** for every new card mechanic (from Part 3 Section 3I)
5. **Update `data/inspection-registry.json`** with new element entries
6. **Run `npm run typecheck` and `npm run build`** after every implementation task
7. **Run `npx vitest run`** after any logic changes
8. **Update `docs/GAME_DESIGN.md`** if changes affect gameplay (cards, relics, mechanics, balance)
9. **Self-question at task end:** "Is this truly complete? Did I handle all edge cases from Appendix F? Did I update the mastery defs? Did I update the registry? Did I update the docs?"

## Verification Gates Between Phases

| Gate | Requirement | Command |
|------|------------|---------|
| After AR-201 | No Echo or Combo references in codebase | `grep -r "echo\|COMBO_" src/ --include="*.ts" --include="*.svelte"` should return 0 results (excluding imports/types) |
| After AR-202 | Cursed system functional | Headless sim: 100 runs, verify cursedFactIds populated and cured |
| After AR-203 | Burn/Bleed working | Unit tests: Burn halving, Bleed per-hit, Bleed no-poison-trigger |
| After AR-206 | All Phase 1 cards playable | Headless sim: 200 runs × 6 profiles, 0 crashes |
| After AR-208 | All 60 new cards playable | Headless sim: 500 runs × 6 profiles, 0 crashes |
| After AR-211 | All 36 new relics functional | Headless sim: relic audit script, all triggers verified |
| After AR-210 | Balance validated | Win rates 40-60% across all profiles, no degenerate combos |
| After AR-214 | Full game tested | Visual audit of all screens, E2E tests pass, headless sim clean |

## Critical Files (Most-Touched)

These files will be modified by multiple sub-ARs. Workers must be careful about merge conflicts:

| File | Modified By |
|------|-----------|
| `src/services/cardEffectResolver.ts` | AR-201, AR-202, AR-203, AR-204, AR-206, AR-207, AR-208 |
| `src/services/turnManager.ts` | AR-201, AR-202, AR-203, AR-206, AR-207, AR-208 |
| `src/data/balance.ts` | AR-201, AR-202, AR-203, AR-205, AR-210 |
| `src/data/mechanics.ts` | AR-206, AR-207, AR-208 |
| `src/services/cardUpgradeService.ts` | AR-206, AR-207, AR-208 |
| `src/services/relicEffectResolver.ts` | AR-201, AR-211 |
| `src/data/relicData.ts` | AR-201, AR-211 |
| `src/data/statusEffects.ts` | AR-203 |
| `docs/GAME_DESIGN.md` | AR-201-AR-213 (continuous) |
| `data/inspection-registry.json` | All ARs |
