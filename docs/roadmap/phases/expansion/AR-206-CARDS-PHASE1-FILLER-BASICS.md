# AR-206: Cards Phase 1 — Filler Cards + Basic Expansion Cards

**Source:** docs/RESEARCH/EXPANSION_FINAL_PRODUCTION.md — Part 3 §3A, §3B, §3C, §3D, §3E, §3G, §3H, §3I
**Priority:** High
**Estimated complexity:** High (30 new mechanic definitions + mastery entries)
**Depends on:** AR-203 (Burn/Bleed), AR-204 (Inscription system), AR-205 (Unlock gating)
**Blocks:** AR-207 (Phase 2 cards)

## Overview

Implement the first wave of 26 new card mechanics: 8 filler cards (simple stat upgrades over starters) and 18 basic expansion cards including the first Bleed/Burn applicators, basic utility, and the level-0 Inscriptions. These are the bread-and-butter cards that fill out the card pool.

Workers MUST read `docs/RESEARCH/EXPANSION_FINAL_PRODUCTION.md` Part 3 for exact QP/CC/CW values and Part 3 §3I for mastery upgrade definitions.

## TODO

### Filler Cards (8)

- [ ] 1. Add Power Strike mechanic definition
  **Files:** `src/data/mechanics.ts`, `src/services/cardUpgradeService.ts`
  **What:** Add mechanic `power_strike`: type=attack, AP=1, QP=10 dmg, CC=30 dmg, CW=7 dmg, Pool=3, unlockLevel=0. Add MASTERY_UPGRADE_DEFS: cap=5, perLevelDelta=+2 dmg. Resolver: same as `strike` but with higher base value.
  **Acceptance:** Mechanic appears in card pool at level 0. QP deals 10 damage. Mastery L5 deals 20 damage.

- [ ] 2. Add Twin Strike mechanic definition
  **Files:** `src/data/mechanics.ts`, `src/services/cardUpgradeService.ts`, `src/services/cardEffectResolver.ts`
  **What:** Add mechanic `twin_strike`: type=attack, AP=1, QP=5x2 (10 total), CC=15x2 (30 total), CW=3.5x2, Pool=2, unlockLevel=2. Multi-hit card — hits twice. Each hit triggers Burn and Bleed separately. Add MASTERY_UPGRADE_DEFS: cap=5, perLevelDelta=+1 per hit. Resolver: reuse multi-hit logic but with 2 hits instead of 3.
  **Acceptance:** Card hits enemy twice in one play. Each hit individually triggers Burn halving and Bleed bonus. Mastery L5 = 10x2 QP.

- [ ] 3. Add Iron Wave mechanic definition
  **Files:** `src/data/mechanics.ts`, `src/services/cardUpgradeService.ts`, `src/services/cardEffectResolver.ts`
  **What:** Add mechanic `iron_wave`: type=attack, AP=1, QP=5 dmg + 5 block, CC=15 dmg + 15 block, CW=3.5 dmg + 3.5 block, Pool=2, unlockLevel=0. Hybrid card — deals damage AND grants block. Add MASTERY_UPGRADE_DEFS: cap=5, perLevelDelta=+1 dmg +1 block.
  **Acceptance:** Card deals damage to enemy and grants block to player in one play. Both values scale with mastery.

- [ ] 4. Add Reinforce mechanic definition
  **Files:** `src/data/mechanics.ts`, `src/services/cardUpgradeService.ts`
  **What:** Add mechanic `reinforce`: type=shield, AP=1, QP=8 block, CC=24 block, CW=5.6 block, Pool=3, unlockLevel=0. Add MASTERY_UPGRADE_DEFS: cap=5, perLevelDelta=+2 block. Resolver: same as `block` but higher base.
  **Acceptance:** Mechanic appears at level 0. QP grants 8 block.

- [ ] 5. Add Shrug It Off mechanic definition
  **Files:** `src/data/mechanics.ts`, `src/services/cardUpgradeService.ts`, `src/services/cardEffectResolver.ts`
  **What:** Add mechanic `shrug_it_off`: type=shield, AP=1, QP=6 block + draw 1, CC=18 block + draw 1, CW=4 block (no draw), Pool=2, unlockLevel=2. Block cantrip. Add MASTERY_UPGRADE_DEFS: cap=5, perLevelDelta=+1 block, L3 bonus: draws 2 instead of 1.
  **Acceptance:** Card grants block AND draws a card on QP/CC. CW does not draw. L3+ draws 2.

- [ ] 6. Add Bash mechanic definition
  **Files:** `src/data/mechanics.ts`, `src/services/cardUpgradeService.ts`, `src/services/cardEffectResolver.ts`
  **What:** Add mechanic `bash`: type=attack, AP=2, QP=10 dmg + 1t Vulnerable, CC=30 dmg + 2t Vulnerable, CW=7 dmg + 1t Vulnerable, Pool=2, unlockLevel=1. Attack + debuff application. Add MASTERY_UPGRADE_DEFS: cap=5, perLevelDelta=+2 dmg, L3 bonus: Vuln duration +1t.
  **Acceptance:** Card deals damage and applies Vulnerable to enemy. Vulnerable duration matches play mode.

- [ ] 7. Add Guard mechanic definition
  **Files:** `src/data/mechanics.ts`, `src/services/cardUpgradeService.ts`
  **What:** Add mechanic `guard`: type=shield, AP=2, QP=14 block, CC=42 block, CW=10 block, Pool=2, unlockLevel=1. Add MASTERY_UPGRADE_DEFS: cap=5, perLevelDelta=+2 block.
  **Acceptance:** Card grants 14 block QP for 2 AP. Simple, efficient.

- [ ] 8. Add Sap mechanic definition
  **Files:** `src/data/mechanics.ts`, `src/services/cardUpgradeService.ts`, `src/services/cardEffectResolver.ts`
  **What:** Add mechanic `sap`: type=debuff, AP=1, QP=3 dmg + 1t Weakness, CC=9 dmg + 2t Weakness, CW=2 dmg + 1t Weakness, Pool=2, unlockLevel=1. Attack + Weakness application. Add MASTERY_UPGRADE_DEFS: cap=5, perLevelDelta=+1 dmg, L3 bonus: Weakness duration +1t.
  **Acceptance:** Card deals damage and applies Weakness to enemy.

### Bleed Cards (2)

- [ ] 9. Add Rupture mechanic definition
  **Files:** `src/data/mechanics.ts`, `src/services/cardUpgradeService.ts`, `src/services/cardEffectResolver.ts`
  **What:** Add mechanic `rupture`: type=attack, AP=1, QP=5 dmg + 3 Bleed, CC=15 dmg + 8 Bleed, CW=3.5 dmg + 2 Bleed, Pool=2, unlockLevel=4. Primary Bleed applicator. Resolver: deal damage AND apply Bleed stacks to enemy. Add MASTERY_UPGRADE_DEFS: cap=5, perLevelDelta=+1 dmg +1 Bleed.
  **Acceptance:** Card deals damage and applies Bleed stacks. Bleed stacks visible on enemy. Subsequent attacks trigger Bleed bonus.

- [ ] 10. Add Lacerate mechanic definition
  **Files:** `src/data/mechanics.ts`, `src/services/cardUpgradeService.ts`, `src/services/cardEffectResolver.ts`
  **What:** Add mechanic `lacerate`: type=debuff, AP=1, QP=4 dmg + 4 Bleed, CC=12 dmg + 8 Bleed, CW=3 dmg + 2 Bleed, Pool=2, unlockLevel=4. Bleed applicator with attack. Add MASTERY_UPGRADE_DEFS: cap=5, perLevelDelta=+1 dmg +1 Bleed.
  **Acceptance:** Card deals damage and applies Bleed. Works correctly with Bleedstone relic (+2 Bleed stacks if present).

### Burn Cards (2)

- [ ] 11. Add Kindle mechanic definition
  **Files:** `src/data/mechanics.ts`, `src/services/cardUpgradeService.ts`, `src/services/cardEffectResolver.ts`
  **What:** Add mechanic `kindle`: type=attack, AP=1, QP=4 dmg + 4 Burn, CC=8 dmg + 8 Burn, CW=3 dmg + 2 Burn, Pool=2, unlockLevel=5. Self-triggering Burn applicator — the attack hit ITSELF triggers Burn immediately. So QP: 4 attack + 4 Burn triggers on hit = 8 total, Burn halves to 2. Add MASTERY_UPGRADE_DEFS: cap=5, perLevelDelta=+1 dmg +1 Burn.
  **Acceptance:** Card deals damage, applies Burn, AND triggers Burn on the same hit. Burn stacks halve after trigger.

- [ ] 12. Add Ignite mechanic definition
  **Files:** `src/data/mechanics.ts`, `src/services/cardUpgradeService.ts`, `src/services/cardEffectResolver.ts`
  **What:** Add mechanic `ignite`: type=buff, AP=1, QP=next attack applies 4 Burn, CC=next attack applies 8 Burn, CW=next attack applies 2 Burn, Pool=2, unlockLevel=5. Burn setup buff — applies a "next attack adds Burn" buff to player. Add MASTERY_UPGRADE_DEFS: cap=5, perLevelDelta=+1 Burn applied.
  **Acceptance:** After playing Ignite, the next attack card played adds Burn stacks to the target. Buff consumed after use.

### Basic New Cards (8)

- [ ] 13. Add Overcharge mechanic definition
  **Files:** `src/data/mechanics.ts`, `src/services/cardUpgradeService.ts`, `src/services/cardEffectResolver.ts`
  **What:** Add mechanic `overcharge`: type=attack, AP=1, QP=6 dmg, CC=6 + (2 per Charge played this encounter), CW=4 dmg, Pool=2, unlockLevel=5. Scales with total Charges played in encounter (correct or wrong). Needs to read `encounterChargeCount` from encounter state. Add MASTERY_UPGRADE_DEFS: cap=5, perLevelDelta=+1 dmg.
  **Acceptance:** CC damage increases with each Charge played. At 5 Charges, CC = 6 + 10 = 16 base.

- [ ] 14. Add Riposte mechanic definition
  **Files:** `src/data/mechanics.ts`, `src/services/cardUpgradeService.ts`, `src/services/cardEffectResolver.ts`
  **What:** Add mechanic `riposte`: type=attack, AP=1, QP=5 dmg + 4 block, CC=15 dmg + 12 block, CW=3.5 dmg + 3 block, Pool=2, unlockLevel=3. Hybrid attack/shield (like Iron Wave but different ratios). Add MASTERY_UPGRADE_DEFS: cap=5, perLevelDelta=+1 dmg +1 block.
  **Acceptance:** Card deals damage and grants block. Both values visible and correct.

- [ ] 15. Add Absorb mechanic definition
  **Files:** `src/data/mechanics.ts`, `src/services/cardUpgradeService.ts`, `src/services/cardEffectResolver.ts`
  **What:** Add mechanic `absorb`: type=shield, AP=1, QP=5 block, CC=5 block + draw 1, CW=3 block, Pool=2, unlockLevel=4. Defensive cantrip. Add MASTERY_UPGRADE_DEFS: cap=5, perLevelDelta=+1 block, L3 bonus: CC draws 2 instead of 1.
  **Acceptance:** QP grants block only. CC grants block + draws 1 card (2 at L3+).

- [ ] 16. Add Reactive Shield mechanic definition
  **Files:** `src/data/mechanics.ts`, `src/services/cardUpgradeService.ts`, `src/services/cardEffectResolver.ts`
  **What:** Add mechanic `reactive_shield`: type=shield, AP=1, QP=4 block + 2 Thorns (1t), CC=12 block + 5 Thorns (2t), CW=3 block + 1 Thorns (1t), Pool=2, unlockLevel=5. Uses existing Thorns mechanic. Add MASTERY_UPGRADE_DEFS: cap=5, perLevelDelta=+1 block, L3: +1 Thorns base.
  **Acceptance:** Card grants block AND applies Thorns to player for specified duration.

- [ ] 17. Add Sift mechanic definition
  **Files:** `src/data/mechanics.ts`, `src/services/cardUpgradeService.ts`, `src/services/cardEffectResolver.ts`
  **What:** Add mechanic `sift`: type=utility, AP=1, QP=look at top 3 draw pile + discard 1, CC=look at top 5 + discard 2, CW=look at top 2 + discard 1, Pool=2, unlockLevel=3. Scry mechanic — needs UI to show top N cards and let player select which to discard. Use CardBrowser component from AR-204. Add MASTERY_UPGRADE_DEFS: cap=5, perLevelDelta=+1 cards looked at.
  **Acceptance:** Card shows top N cards from draw pile, player selects which to discard, rest return to top in order.

- [ ] 18. Add Scavenge mechanic definition
  **Files:** `src/data/mechanics.ts`, `src/services/cardUpgradeService.ts`, `src/services/cardEffectResolver.ts`
  **What:** Add mechanic `scavenge`: type=utility, AP=1, QP=put 1 card from discard on top of draw pile, CC=put 2 on top, CW=put 1 on top, Pool=2, unlockLevel=4. Use CardBrowser to browse discard pile. Add MASTERY_UPGRADE_DEFS: cap=3, L3 bonus: QP puts 2 on top instead of 1.
  **Acceptance:** Player browses discard pile, selects card(s), they move to top of draw pile.

- [ ] 19. Add Precision Strike mechanic definition
  **Files:** `src/data/mechanics.ts`, `src/services/cardUpgradeService.ts`, `src/services/cardEffectResolver.ts`
  **What:** Add mechanic `precision_strike`: type=attack, AP=1, QP=8 dmg, CC=24 dmg, CW=5 dmg, Pool=2, unlockLevel=4. Passive: Charge timer +50% longer for this card. Add MASTERY_UPGRADE_DEFS: cap=5, perLevelDelta=+2 dmg, L3 bonus: timer increases to +75%.
  **Acceptance:** Card deals correct damage. When Charged, quiz timer is extended by 50% (75% at L3+). Timer extension visible to player.

- [ ] 20. Add Stagger mechanic definition
  **Files:** `src/data/mechanics.ts`, `src/services/cardUpgradeService.ts`, `src/services/cardEffectResolver.ts`, `src/services/turnManager.ts`
  **What:** Add mechanic `stagger`: type=debuff, AP=1, QP=skip enemy's next action, CC=skip + 1t Vulnerable, CW=skip only, Pool=1, unlockLevel=3. Enemy turn counter ADVANCES (enrage still ticks) but action is skipped. Status effects still tick. Add MASTERY_UPGRADE_DEFS: cap=3, L3 bonus: QP also applies 1t Weakness.
  **Acceptance:** After playing Stagger, enemy's next turn skips their action but counter advances. Enrage timer is not delayed.

### Inscription Cards (2)

- [ ] 21. Add Inscription of Fury mechanic definition
  **Files:** `src/data/mechanics.ts`, `src/services/cardUpgradeService.ts`, `src/services/cardEffectResolver.ts`
  **What:** Add mechanic `inscription_fury`: type=buff, tags=['inscription'], AP=2, QP=all attacks +2 dmg rest of combat, CC=+4 dmg, CW=+1 dmg, Pool=1, unlockLevel=0. Uses Inscription system from AR-204. Exhausts on play (removed from game). Persistent effect added at step 3 of damage pipeline. Add MASTERY_UPGRADE_DEFS: cap=5, perLevelDelta=+0.5 atk bonus (rounded).
  **Acceptance:** After playing, all subsequent attack cards deal bonus damage for rest of encounter. Card is removed from game (not just exhausted). Bonus visible in damage calculation.

- [ ] 22. Add Inscription of Iron mechanic definition
  **Files:** `src/data/mechanics.ts`, `src/services/cardUpgradeService.ts`, `src/services/turnManager.ts`
  **What:** Add mechanic `inscription_iron`: type=buff, tags=['inscription'], AP=2, QP=start each turn with 3 block rest of combat, CC=6 block, CW=1 block, Pool=1, unlockLevel=0. Uses Inscription system. Block applied at player turn start before draw. Add MASTERY_UPGRADE_DEFS: cap=5, perLevelDelta=+0.5 block bonus (rounded).
  **Acceptance:** After playing, player automatically gains block at start of each subsequent turn. Block amount matches play mode. Card removed from game.

### Missing Cards (added during cross-reference review)

- [ ] 23. Add Corrode mechanic definition
  **Files:** `src/data/mechanics.ts`, `src/services/cardUpgradeService.ts`, `src/services/cardEffectResolver.ts`
  **What:** Add mechanic `corrode`: type=debuff, AP=1, QP=remove 5 enemy block + 1t Weakness, CC=remove ALL block + 2t Weakness, CW=remove 3 block + 1t Weakness, Pool=1, unlockLevel=5. Anti-tank card. Resolver: reduce enemy.block by amount, apply Weakness. Add MASTERY_UPGRADE_DEFS: cap=5, perLevelDelta=+1 block removal, L3 bonus: Weakness duration +1t.
  **Acceptance:** Card removes enemy block and applies Weakness. CC removes all enemy block.

- [ ] 24. Add Swap mechanic definition
  **Files:** `src/data/mechanics.ts`, `src/services/cardUpgradeService.ts`, `src/services/cardEffectResolver.ts`
  **What:** Add mechanic `swap`: type=utility, AP=0, QP=discard 1 draw 1, CC=discard 1 draw 2, CW=discard 1 draw 1, Pool=2, unlockLevel=2. 0-cost cycling. Charge costs 1 AP (surcharge). Player selects card to discard. Add MASTERY_UPGRADE_DEFS: cap=3, L3 bonus: CC draws 3 instead of 2.
  **Acceptance:** Card allows discarding 1 card and drawing replacement(s). 0 AP to Quick Play. Discard triggers Reflex passive if Reflex is discarded.

- [ ] 25. Add Siphon Strike mechanic definition
  **Files:** `src/data/mechanics.ts`, `src/services/cardUpgradeService.ts`, `src/services/cardEffectResolver.ts`
  **What:** Add mechanic `siphon_strike`: type=attack, AP=1, QP=6 dmg heal max(2, min(overkill, 10)), CC=18 dmg heal max(2, min(overkill, 10)), CW=4 dmg, Pool=2, unlockLevel=3. Overkill healing capped at 10. Always heals at least 2 even on non-lethal. Add MASTERY_UPGRADE_DEFS: cap=5, perLevelDelta=+1 dmg, L3 bonus: min heal → 3, max heal cap stays 10.
  **Acceptance:** Card deals damage and heals. Overkill healing = damage exceeding enemy remaining HP, capped at 10. Min heal = 2 (3 at L3+).

- [ ] 26. Add Aegis Pulse mechanic definition
  **Files:** `src/data/mechanics.ts`, `src/services/cardUpgradeService.ts`, `src/services/cardEffectResolver.ts`
  **What:** Add mechanic `aegis_pulse`: type=shield, AP=1, QP=5 block, CC=5 block + all same-chain cards in hand gain +2 block value this turn, CW=3 block, Pool=2, unlockLevel=6. Chain synergy for defense. CC buffs other cards of same chain type. Add MASTERY_UPGRADE_DEFS: cap=5, perLevelDelta=+1 block, L3 bonus: chain buff = +3 instead of +2.
  **Acceptance:** QP grants 5 block. CC also buffs same-chain cards in hand. Chain type match works correctly.

### Integration

- [ ] 27. Update headless simulator with all 30 new mechanics
  **Files:** `tests/playtest/headless/simulator.ts`, `tests/playtest/headless/browser-shim.ts`
  **What:** Ensure the headless sim can resolve all 30 new mechanics. The sim imports real game code, so if mechanics.ts and cardEffectResolver.ts are correct, the sim should work. Run a test batch to verify.
  **Acceptance:** `npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 100` completes with 0 crashes.

- [ ] 24. Add unit tests for all new mechanics
  **Files:** `tests/unit/mechanics/` (new test files)
  **What:** Create unit tests for: Twin Strike multi-hit, Iron Wave hybrid, Sap/Bash debuff application, Rupture/Lacerate Bleed application, Kindle self-triggering Burn, Ignite buff consumption, Overcharge scaling, Stagger turn-skip + enrage advance, Inscription persistence, Inscription removal from game. At minimum: test QP value, CC value, CW value, and one edge case per mechanic.
  **Acceptance:** All tests pass. `npx vitest run` shows new test suite with 0 failures.

- [ ] 25. Update inspection registry
  **Files:** `data/inspection-registry.json`
  **What:** Add entries for all 30 new mechanics with today's date as `lastChangedDate`, `mechanicInspectionDate: 'not_checked'`.
  **Acceptance:** Registry has 26 new entries in the `cards` table.

- [ ] 26. Visual verification of new cards
  **Files:** N/A (visual test)
  **What:** Using Playwright + __terraScenario, enter combat with a deck containing new mechanics. Verify: cards display correctly in hand, play animations work, Burn/Bleed status icons appear on enemy when applied, Inscription indicator appears when active, mastery level display shows correct bonuses.
  **Acceptance:** Screenshots show new cards rendering correctly. No visual glitches. Status effect icons visible.

## Testing Plan

1. **Unit tests:** Test each mechanic's QP/CC/CW values, edge cases (multi-hit + Burn/Bleed interaction, Inscription persistence)
2. **Headless sim:** Run 200 runs × 6 profiles with all new cards in pool. 0 crashes.
3. **Visual test:** Playwright screenshot of combat with new cards visible
4. **Type check:** `npm run typecheck` clean
5. **Build:** `npm run build` clean

## Verification Gate

```bash
npm run typecheck
npm run build
npx vitest run
npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 200
```

All must pass with 0 errors.

## Files Affected

| File | Change Type |
|------|------------|
| `src/data/mechanics.ts` | Add 26 mechanic definitions |
| `src/services/cardUpgradeService.ts` | Add 26 MASTERY_UPGRADE_DEFS entries |
| `src/services/cardEffectResolver.ts` | Add resolver logic for new mechanic types |
| `src/services/turnManager.ts` | Add Stagger turn-skip logic, Inscription turn-start block |
| `data/inspection-registry.json` | Add 26 entries |
| `tests/unit/mechanics/` | New test files |

## Doc Updates Required

- `docs/GAME_DESIGN.md` — Add all 30 new mechanics to the card mechanics section, update card count from 31 to 57
- Update mechanic count references throughout docs
