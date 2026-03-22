# AR-213: GAME_DESIGN.md Full Sync

**Source:** docs/RESEARCH/EXPANSION_FINAL_PRODUCTION.md — entire document
**Priority:** High (stale docs = bugs)
**Estimated complexity:** Medium
**Depends on:** AR-210 (balance pass complete, final values locked)
**Blocks:** AR-214 (Final Test)

## Overview

Comprehensive update of `docs/GAME_DESIGN.md` and `docs/ARCHITECTURE.md` to reflect the full expansion: 91 card mechanics, 77 relics, 2 new status effects, Cursed Card system, Inscription keyword, card unlock progression, combo system removal. Every section that references card counts, mechanics lists, status effects, or relic lists must be updated.

Individual ARs should have been updating GAME_DESIGN.md incrementally, but this AR does a final comprehensive pass to catch anything missed and ensure full consistency.

## TODO

- [x] 1. Update card mechanics section
  **Files:** `docs/GAME_DESIGN.md`
  **What:** Update the card mechanics section to list all 91 mechanics (31 existing + 60 new). Organize by type (attack, shield, buff, debuff, utility, wild, inscription). For each new mechanic: name, AP cost, brief description, unlock level. Remove any references to Echo-specific mechanics.
  **Acceptance:** Mechanics count matches 91. All 60 new mechanics documented.

- [x] 2. Update status effects section
  **Files:** `docs/GAME_DESIGN.md`
  **What:** Add Burn and Bleed to the status effects section with full descriptions:
  - Burn: hit amplifier, halves on trigger, additive stacking
  - Bleed: persistent amplifier, +1 per stack per card-play hit, decays 1/turn
  - Both: bonus added before block, Bleed does NOT trigger on passive damage
  Remove any Echo-related status effect documentation.
  **Acceptance:** Status effects section lists 8 effects (6 existing + Burn + Bleed).

- [x] 3. Update Cursed Card system documentation
  **Files:** `docs/GAME_DESIGN.md`
  **What:** Replace all Echo system documentation with Cursed Card system:
  - Cursing trigger (wrong Charge on mastery 0)
  - Cure mechanism (correct Charge)
  - Multipliers (QP 0.7x, CC 1.0x, CW 0.5x)
  - Free First Charge exemption
  - Weighted priority in draws
  - Auto-cure safety valve (60% across 2 draws)
  - Fact-based not slot-based
  Remove all Echo references (ghost cards, echo spawning, etc.).
  **Acceptance:** No Echo references remain. Cursed system fully documented.

- [x] 4. Update relic catalogue
  **Files:** `docs/GAME_DESIGN.md`
  **What:** Add all 36 new relics organized by rarity (Common, Uncommon, Rare, Legendary, Cursed). For each: name, trigger, effect, category. Remove Echo Lens, Phantom Limb, Echo Chamber entries.
  **Acceptance:** Relic count matches 77. All removed relics gone. All new relics documented.

- [x] 5. Add Inscription keyword documentation
  **Files:** `docs/GAME_DESIGN.md`
  **What:** Add new section for Inscription cards:
  - Keyword definition (persistent, exhaust = remove from game)
  - 3 inscription cards (Fury, Iron, Wisdom)
  - Application points (Fury: damage calc, Iron: turn start, Wisdom: CC resolution)
  - Cannot be Recollected
  - Cannot stack same type
  **Acceptance:** Inscription system fully documented.

- [x] 6. Add card unlock progression section
  **Files:** `docs/GAME_DESIGN.md`
  **What:** Add the full card unlock table from Part 5 of the expansion spec. Include level, cards unlocked, total available, and design intent per level.
  **Acceptance:** Full 14-level unlock table present.

- [x] 7. Remove combo system documentation
  **Files:** `docs/GAME_DESIGN.md`
  **What:** Remove all references to combo multipliers, combo counter, combo healing, combo decay. Replace with a note: "The combo system has been removed. Chains are the only streak mechanic."
  **Acceptance:** No combo references in GAME_DESIGN.md (except the removal note).

- [x] 8. Update damage pipeline documentation
  **Files:** `docs/GAME_DESIGN.md`
  **What:** Update the damage calculation section to match Appendix E of the expansion spec. Show the full 16-step pipeline. Explicitly note that combo multiplier is NOT in the pipeline.
  **Acceptance:** Damage pipeline matches Appendix E exactly.

- [x] 9. Update balance section with final sim values
  **Files:** `docs/GAME_DESIGN.md`
  **What:** Update the balance section with final values from AR-210's balance report. Include win rates by archetype, card distribution, and any values that were tuned during the balance pass.
  **Acceptance:** Balance section reflects actual tested values, not just spec targets.

- [x] 10. Update ARCHITECTURE.md
  **Files:** `docs/ARCHITECTURE.md`
  **What:** Update architecture docs to reflect:
  - New files added (CardBrowser.svelte, inscription tracking, etc.)
  - Modified systems (cardEffectResolver Burn/Bleed hooks, turnManager cursed logic)
  - New data structures (cursedFactIds, activeInscriptions, encounterChargeCount)
  - Removed systems (Echo, Combo)
  **Acceptance:** Architecture doc accurately reflects current codebase.

- [x] 11. Cross-reference check
  **Files:** `docs/GAME_DESIGN.md`, `docs/ARCHITECTURE.md`
  **What:** Search for stale references:
  - "echo" (should only appear in "Cursed Cards replace Echo" historical note)
  - "combo multiplier" (should only appear in removal note)
  - Old card count "31" (should be "91")
  - Old relic count "42" (should be "77")
  - "Signal Flare" (should not appear)
  - "Echo Chamber" (should not appear except in removal history)
  **Acceptance:** Zero stale references found.

## Testing Plan

1. Grep for stale terms: echo, combo, Signal Flare, Echo Chamber, "31 mechanics", "42 relics"
2. Verify card count = 91 in all locations
3. Verify relic count = 77 in all locations
4. Read through each section for coherence

## Verification Gate

```bash
grep -c "echo" docs/GAME_DESIGN.md  # Should be <=2 (historical notes only)
grep -c "combo multiplier" docs/GAME_DESIGN.md  # Should be <=1 (removal note)
grep -c "Signal Flare" docs/GAME_DESIGN.md  # Should be 0
grep -c "Echo Chamber" docs/GAME_DESIGN.md  # Should be 0
```

## Files Affected

| File | Change Type |
|------|------------|
| `docs/GAME_DESIGN.md` | Major update (all sections) |
| `docs/ARCHITECTURE.md` | Update system descriptions + file list |

## Doc Updates Required

- This IS the doc update AR.
