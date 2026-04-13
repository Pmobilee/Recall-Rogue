<!--
  Purpose: Chain multiplier rework design spec — formula change, balance impact, DoT extension.
  Extracted from: docs/testing/VISUAL-VERIFICATION-CHECKLIST.md (2026-04-13)
  Sources: src/services/damageCalculator.ts, src/services/chainService.ts
-->

# Chain Multiplier Rework

> This rework must land before the visual verification checklist is meaningful, because it changes the damage/block/DoT formulas that every card item below tests against.

## Problem

Chain multiplier currently compounds with CC multiplier, Strength, Vulnerability, Empower, relic % bonuses, Overclock, and every other multiplicative modifier. A strike L5 with max chain + CC + Strength 2 + Empower reaches ~141 damage. This creates:

1. **Exponential scaling** that makes top-end chains feel mandatory and everything else feel pointless.
2. **Card descriptions that lie** — the card shows "Deal 8 damage" but actually deals 28+ because chain is invisible. `damagePreviewService.ts` has no `chainMultiplier` field in `DamagePreviewContext`, so chain is NEVER reflected on card faces.
3. **DoT playstyles are dead** — poison, burn, and bleed stacks are completely chain-immune. Hex applies 3 poison at chain-0 or chain-5. Building chains has zero value for a DoT player.

## Design: Chain Multiplies Base Only + Extends to All Playstyles

### Core Formula Change

**Current (multiplicative with everything):**
```
damage = round((qpValue × ccMult) × chainMult × strength × vuln × relicMult × empower × overclock) + flat
```

**Proposed (chain adjusts base before other multipliers):**
```
chainAdjustedBase = round(qpValue × chainMultiplier)
damage = round((chainAdjustedBase × ccMult) × strength × vuln × relicMult × empower × overclock) + flat
```

Chain still stacks with CC (1.5×), but no longer compounds with Strength, Vulnerability, Empower, Overclock, or relic % bonuses. The ceiling comes down ~30% while the floor stays identical.

### Why This Fixes Card Display

The card face can now show `round(qpValue × chainMultiplier)` as the base value, which updates live as chain changes. What you read on the card is what you get (before CC/strength/relics, which are separate clearly-signed modifiers). This directly fixes the chain multiplier display gap (Section 18.1).

### Balance Impact

| Scenario | Current | Proposed |
|---|---|---|
| Strike L0 QP, chain-0 | 4 | 4 |
| Strike L0 CC, chain-3 | 12 | 12 |
| Strike L5 CC, chain-5 | 42 | 42 |
| Strike L5 CC, chain-5, Str×2 | ~94 | ~63 |
| Strike L5 CC, chain-5, Str×2, Empower | ~141 | ~95 |

Floor identical. Ceiling drops 30%. Chain is still powerful but doesn't create runaway combos.

### Extending Chain to All Card Types

| Card Type | What chain scales | Formula | What chain does NOT scale |
|---|---|---|---|
| **Attack** | qpValue (base damage) | `round(qpValue × chainMult)` | — |
| **Shield/Block** | qpValue (block amount) | `round(qpValue × chainMult)` | — |
| **Poison** (hex) | stacks applied | `round(extras.stacks × chainMult)` | duration (already fixed per level) |
| **Burn** (kindle) | stacks applied | `round(secondaryValue × chainMult)` | — |
| **Bleed** (lacerate, rupture) | stacks applied | `round(secondaryValue × chainMult)` | — |
| **Debuff** (weak/vuln/slow) | duration only | `round(turns × (1 + (chainMult-1) × 0.5))` | stack count (avoid breaking) |
| **Buff** (empower/warcry) | nothing | — | magnitude (avoid double-compound) |
| **Utility** (draw/heal) | heal amounts only | `round(healAmount × chainMult)` | draw counts (avoid hand explosion) |

### Examples: How DoT Playstyles Become Viable

**Poison chain build (hex):**
- Hex L0 at chain-0: Apply 3 Poison → 3 stacks
- Hex L0 at chain-3: Apply 3 Poison × 2.0 = 6 stacks
- Hex L5 at chain-5: Apply 5 Poison × 3.5 = 17 stacks
- Card face shows "Apply 6 Poison" (updates live with chain)

**Burn chain build (kindle):**
- Kindle L0 at chain-0: 1 dmg + Apply 4 Burn → 4 stacks
- Kindle L0 at chain-3: 2 dmg + Apply 4 Burn × 2.0 = 8 stacks
- Kindle L5 at chain-5: 14 dmg + Apply 6 Burn × 3.5 = 21 stacks (with immediate double-trigger at L5)

**Bleed chain build (lacerate):**
- Lacerate L0 at chain-0: 1 dmg + Apply 4 Bleed
- Lacerate L0 at chain-3: 2 dmg + Apply 4 Bleed × 2.0 = 8 Bleed
- Hemorrhage finisher now benefits from chain-built bleed pools

**Shield chain build (block):**
- Block L0 at chain-0: 4 block
- Block L0 at chain-3: 4 × 2.0 = 8 block
- Block L5 at chain-5: 8 × 3.5 = 28 block
- Defensive chaining is now a real strategy

**Debuff chain build (expose/weaken):**
- Expose L0 at chain-0: 1 Vulnerable, 1 turn
- Expose L0 at chain-3: 1 Vulnerable, `round(1 × (1 + (2.0-1)×0.5))` = 1.5 → 2 turns (soft scale)
- Duration-only scaling prevents Vulnerable stack explosion

### Design Decisions (Confirmed)

1. **Chain × qpValue (mastery-inclusive)** — chain amplifies the stat-table value at current mastery level. Not the pre-mastery seed. Mastery and chain stack linearly.
2. **Full multiplier for DoT stacks** — poison/burn/bleed stacks get `round(stacks × chainMult)`. Linear stacking, not exponential. Poison ticks are linear damage; burn halves on hit; bleed is flat bonus per stack. None of these create runaway scaling.
3. **Soft multiplier for debuff duration** — `round(turns × (1 + (chainMult-1) × 0.5))`. At chain-5 (3.5×): turns × 2.25. Prevents 7-turn Vulnerability.
4. **Buffs and draw counts are chain-immune** — Empower, Warcry, Frenzy, Scout draw counts are NOT scaled. Buffs already benefit from chains indirectly (the buffed attack is chain-scaled). Compounding would create double-multiplicative runaway.
5. **Heal amounts scale with chain** — lifetap, siphon_strike heal components use `round(healBase × chainMult)`. Rewards chaining with sustain.

### Implementation Targets

| File | Change |
|---|---|
| `src/services/cardEffectResolver.ts` | Move chain multiplication to base only: compute `chainAdjustedBase = round(qpValue × chainMult)` at line ~550, use as input to `effectiveBase` instead of multiplying into `scaledValue`. Apply chain to `secondaryValue` and `extras.stacks` for DoT cards. |
| `src/services/damagePreviewService.ts` | Add `chainMultiplier` to `DamagePreviewContext`. Compute preview using `round(qpValue × chainMult)` as base. Apply chain to `secondaryValue`/`extras.stacks` for display. |
| `src/services/turnManager.ts` | Pass `chainMultiplier` correctly (already does). Verify chain_lightning override still works with new base-only approach. |
| `src/data/balance.ts` | Possibly re-tune `CHAIN_MULTIPLIERS` values if needed after testing. Current `[1.0, 1.2, 1.5, 2.0, 2.5, 3.5]` may be fine since the compounding is gone. |
| `src/ui/components/CardCombatOverlay.svelte` | Pass chain state to `DamagePreviewContext` from `damagePreviews` computation (line ~504). |
| `src/services/cardDescriptionService.ts` | Update `getCardDescriptionParts` to accept chain-adjusted base for live display. DoT cards show chain-scaled stacks in description. |
| `src/services/liveCardStats.ts` | Wire `chainMultiplier` from `LiveCardTurnContext` into `DamagePreviewContext`. |
| `docs/mechanics/chains.md` | Update chain docs with new formula, playstyle extensions. |
| `docs/mechanics/combat.md` | Update damage pipeline documentation. |
| `.claude/rules/game-conventions.md` | Update "Chain multipliers stack multiplicatively" to new base-only behavior. |

### Verification Plan (Post-Implementation)

After implementing, run these checks from the checklist:

1. **Section 14 (Chain System)** — all chain multiplier items, but with new expected values
2. **Section 18.1 (Chain Display Gap)** — should now PASS (chain reflected on card face)
3. **Section 11 (Card Functional)** — re-verify all QP/CC values with chain=0 (should be unchanged)
4. **Section 17 (Combos)** — Empower + chain, Overclock + chain (reduced ceiling, verify no runaway)
5. **New**: DoT chain verification:
   - [ ] Hex at chain 0/1/2/3/4/5: verify poison stacks = `round(extras.stacks × chainMult)`
   - [ ] Kindle at chain 0/1/2/3/4/5: verify burn stacks = `round(secondaryValue × chainMult)`
   - [ ] Lacerate at chain 0/1/2/3/4/5: verify bleed stacks = `round(secondaryValue × chainMult)`
   - [ ] Rupture at chain 0/1/2/3/4/5: verify bleed stacks = `round(secondaryValue × chainMult)`
   - [ ] Entropy at chain 3: verify both burn AND poison scale
   - [ ] Block at chain 0/1/2/3/4/5: verify block = `round(qpValue × chainMult)`
   - [ ] Expose at chain 3: verify duration = `round(1 × (1 + (2.0-1)×0.5))` = 2 turns, stacks = 1
   - [ ] Weaken at chain 3: verify duration scales, stacks don't
   - [ ] Empower at chain 5: verify magnitude is NOT scaled (still +50%)
   - [ ] Scout at chain 5: verify draw count is NOT scaled (still 2)
   - [ ] Lifetap at chain 3: verify heal amount scales with chain
   - [ ] Card face on strike: shows `round(8 × chainMult)` not `8`
   - [ ] Card face on hex: shows `Apply round(5 × chainMult) Poison` not `Apply 5 Poison`
   - [ ] Card face on block: shows `round(8 × chainMult) Block` not `8 Block`
6. **Headless sim**: `npx tsx ... --runs 5000` — verify win rates are reasonable after ceiling reduction. May need to adjust `CHAIN_MULTIPLIERS` values if win rate drops too far.
