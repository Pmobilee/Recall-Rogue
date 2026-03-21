# AR-209: Unlock Schedule Wiring — Cards + Relics

**Source:** docs/RESEARCH/EXPANSION_FINAL_PRODUCTION.md — Part 5 (Cards), Part 10 (Relics)
**Priority:** High
**Estimated complexity:** Medium
**Depends on:** AR-208 (all cards implemented), AR-211 (all relics implemented)
**Blocks:** AR-210 (Balance Pass)

## Overview

Wire the card unlock schedule and relic unlock schedule to the character level system. All 91 card mechanics and 77 relics must be gated by character level, with the unlock progression defined in the expansion spec. AR-205 built the `getUnlockedMechanics()` infrastructure — this AR populates the actual data tables with all 60 new cards and 36 new relics.

## TODO

- [ ] 1. Populate card unlock data table with all 60 new mechanics
  **Files:** `src/data/characterLevel.ts` (or wherever AR-205 put the unlock data)
  **What:** Add every new mechanic ID to the unlock level map, exactly matching Part 5 of the expansion spec:
  - Level 0: power_strike, iron_wave, reinforce, inscription_fury, inscription_iron
  - Level 1: bash, guard, sap, inscription_wisdom
  - Level 2: twin_strike, shrug_it_off, swap
  - Level 3: stagger, sift, riposte
  - Level 4: rupture, lacerate, scavenge, absorb, precision_strike
  - Level 5: kindle, ignite, corrode, overcharge, archive
  - Level 6: gambit, curse_of_doubt, knowledge_ward, aegis_pulse, reflex, unstable_flux, chameleon
  - Level 7: burnout_shield, battle_trance, volatile_slash, corroding_touch, phase_shift
  - Level 8: ironhide, war_drum, chain_lightning, dark_knowledge, mark_of_ignorance, sacrifice
  - Level 9: smite, entropy, bulwark, conversion, chain_anchor
  - Level 10: feedback_loop, frenzy, aftershock, synapse, catalyst
  - Level 11: recall, mastery_surge, tutor, mimic, siphon_strike
  - Level 12: eruption
  - Level 13: knowledge_bomb, siphon_knowledge
  **Acceptance:** `getUnlockedMechanics(0)` returns 36 mechanics. `getUnlockedMechanics(13)` returns all 91.

- [ ] 2. Populate relic unlock data table with all 36 new relics
  **Files:** `src/data/characterLevel.ts` (or relic unlock data location)
  **What:** Add every new relic ID to the unlock level map, exactly matching Part 10:
  - Level 0: quick_study, thick_skin, tattered_notebook, battle_scars, brass_knuckles
  - Level 1: pocket_watch, chain_link_charm
  - Level 2: worn_shield, bleedstone, gladiator_s_mark
  - Level 3: ember_core, gambler_s_token
  - Level 4: thoughtform, scar_tissue, living_grimoire
  - Level 5: surge_capacitor, obsidian_dice
  - Level 6: red_fang, chronometer
  - Level 7: soul_jar, null_shard, hemorrhage_lens
  - Level 8: archive_codex, chain_forge
  - Level 9: berserker_s_oath, deja_vu, entropy_engine
  - Level 10: inferno_crown, mind_palace
  - Level 11: bloodstone_pendant, chromatic_chain
  - Level 12: volatile_manuscript, dragon_s_heart
  - Level 20: omniscience
  - Level 21: paradox_engine
  - Level 22: akashic_record
  - Level 23: singularity
  **Acceptance:** Relic reward pools filter correctly by level. Level 0 shows 29 relics. Level 24 shows 77.

- [ ] 3. Verify card reward pool filters by unlock level
  **Files:** `src/services/cardRewardService.ts` (or equivalent)
  **What:** Confirm that card reward screens only offer mechanics that are unlocked at the player's current character level. Test with level 0 (should not offer Eruption), level 5 (should offer Kindle but not Chain Lightning).
  **Acceptance:** Card rewards respect unlock gating at all tested levels.

- [ ] 4. Verify shop pool filters by unlock level
  **Files:** `src/services/shopService.ts`
  **What:** Confirm shop card offerings respect unlock level. Shop should never offer a card the player hasn't unlocked.
  **Acceptance:** Shop at level 0 does not offer any level 1+ mechanics.

- [ ] 5. Verify run pool builder filters by unlock level
  **Files:** `src/services/runPoolBuilder.ts`
  **What:** Confirm `applyMechanics()` only assigns unlocked mechanics to the card pool. A level 0 player's 120-card pool should only contain the 36 unlocked mechanics.
  **Acceptance:** Pool builder at level 0 produces pool with only level-0 mechanics.

- [ ] 6. Add unit tests for unlock schedule
  **Files:** `tests/unit/unlock-schedule.test.ts` (new)
  **What:** Test:
  - `getUnlockedMechanics(0)` returns exactly 36 (31 existing + 5 new)
  - `getUnlockedMechanics(13)` returns 91 (or 92 counting inscription duplicates)
  - Each level adds the correct mechanics (spot-check levels 0, 4, 8, 13)
  - Relic unlock at level 0 returns 29, at level 24 returns 77
  **Acceptance:** All tests pass.

## Testing Plan

1. Unit tests for unlock data integrity
2. Manual verification: start a run at level 0, confirm card pool contains only basic mechanics
3. Headless sim at level 0 vs level 13: confirm different card pools
4. Type check + build clean

## Verification Gate

```bash
npm run typecheck
npm run build
npx vitest run
# Manual: Playwright → start run at level 0 → verify card rewards show only basic cards
```

## Files Affected

| File | Change Type |
|------|------------|
| `src/data/characterLevel.ts` | Populate unlock tables |
| `src/services/cardRewardService.ts` | Verify filtering |
| `src/services/shopService.ts` | Verify filtering |
| `src/services/runPoolBuilder.ts` | Verify filtering |
| `tests/unit/unlock-schedule.test.ts` | New test file |

## Doc Updates Required

- `docs/GAME_DESIGN.md` — Add unlock progression section with the full level table
