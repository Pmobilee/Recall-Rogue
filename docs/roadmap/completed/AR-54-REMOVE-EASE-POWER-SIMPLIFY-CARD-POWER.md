# AR-54: Remove Ease Power System — Simplify Card Power to Tier-Only

**Status:** Pending
**Created:** 2026-03-16
**Estimated complexity:** Small-Medium (remove code + update docs)

---

## Problem

Two conflicting power systems exist:

1. **Tier power** (intended design): Learning=1.0x → Proven=1.3x → Mastered=1.6x. Rewards mastery.
2. **Ease power** (EASE_POWER): Easy=0.8x, Hard=1.6x. Rewards struggling, punishes learning.

These contradict each other. The ease power system creates a **perverse incentive**: the optimal strategy is to deliberately get answers wrong (keeping ease low = 1.6x power). Players who genuinely master facts get punished with 0.8x cards. This undermines the core educational mission.

Additionally, `effectMultiplier` from EASE_POWER is used in `cardDescriptionService.ts` for display but NOT in `turnManager.ts` for actual combat damage — making it partially broken and confusing.

## Solution

Remove the EASE_POWER system entirely. Card power is driven ONLY by the tier system:

| Tier | Display | Power | How to Reach |
|------|---------|-------|-------------|
| 1 | Learning | 1.0x | Default for new/unknown facts |
| 2a | Proven | 1.3x | FSRS stability ≥2d, 2+ correct |
| 2b | Proven | 1.6x | FSRS stability ≥5d, 3+ correct |
| 3 | Mastered | 1.6x (permanent) | Pass Mastery Trial |

Players get STRONGER as they learn. The difficulty comes from harder quiz formats at higher tiers (3-option → 4-option → 5-option/fill-blank), not from weaker cards.

## Sub-steps

### 1. Remove EASE_POWER from balance.ts
- [ ] Delete the `EASE_POWER` constant array
- [ ] Remove any related comments

### 2. Remove computeEffectMultiplier from cardFactory.ts
- [ ] Delete the `computeEffectMultiplier()` function
- [ ] In `createCard()`, set `effectMultiplier` based on TIER instead:
  ```typescript
  const TIER_MULTIPLIER: Record<CardTier, number> = {
    '1': 1.0,
    '2a': 1.3,
    '2b': 1.6,
    '3': 1.6,
  }
  const effectMultiplier = TIER_MULTIPLIER[tier] ?? 1.0
  ```

### 3. Apply effectMultiplier in actual combat (turnManager.ts)
- [ ] Currently `turnManager.ts` uses `card.baseEffectValue` for damage/heal/shield calculations WITHOUT multiplying by `effectMultiplier`. This means the tier power multiplier is display-only.
- [ ] Find where card effects are resolved and multiply by `effectMultiplier`:
  - Correct answer damage: `baseEffectValue * effectMultiplier`
  - Shield/heal: same
  - Fizzle (wrong answer): `baseEffectValue * FIZZLE_EFFECT_RATIO` (no multiplier — wrong answers don't benefit from tier)
- [ ] This makes mastered cards genuinely hit 1.6x harder in gameplay, not just on the card label

### 4. Update cardDescriptionService.ts
- [ ] Already uses `card.baseEffectValue * card.effectMultiplier` for display — this will now correctly show tier-based power instead of ease-based
- [ ] Verify displayed values match actual combat values

### 5. Clean up cardUpgradeService.ts
- [ ] Line 151-152 sorts by `effectMultiplier` — update comment from "harder facts = stronger cards" to "higher tier = stronger cards"

### 6. Update GAME_DESIGN.md
- [ ] Remove the "Difficulty-Proportional Power" section (lines ~1298-1305 with the ease-based table)
- [ ] Update the tier table to clearly state power multipliers are the ONLY power source
- [ ] Update line ~86 that mentions "Tier multiplier (1.0x/1.3x/1.6x) follows the FACT" to explain it's tier-based
- [ ] Add a design rationale note: "Card power scales with mastery, not difficulty. Players who learn get stronger decks. Challenge at higher tiers comes from harder quiz formats, not weaker cards."

### 7. Update ARCHITECTURE.md
- [ ] Remove any EASE_POWER references in the card factory section
- [ ] Document that effectMultiplier is tier-derived

### 8. Verify and test
- [ ] `npx tsc --noEmit` passes
- [ ] Grep for any remaining references to `EASE_POWER` or `computeEffectMultiplier`
- [ ] Verify a Tier 2a card displays and deals 1.3x damage
- [ ] Verify a new Tier 1 card displays and deals 1.0x damage

---

## Acceptance Criteria

- [ ] `EASE_POWER` constant deleted from balance.ts
- [ ] `computeEffectMultiplier()` function deleted from cardFactory.ts
- [ ] `effectMultiplier` on cards is now purely tier-derived (1.0/1.3/1.6)
- [ ] Combat in turnManager.ts actually uses effectMultiplier (not just display)
- [ ] Displayed card values match actual combat values
- [ ] No perverse incentive — learning makes cards stronger, never weaker
- [ ] Docs updated
- [ ] Typecheck passes

## Files Affected

| File | Change |
|------|--------|
| `src/data/balance.ts` | Remove `EASE_POWER` constant |
| `src/services/cardFactory.ts` | Replace `computeEffectMultiplier()` with tier-based lookup |
| `src/services/turnManager.ts` | Apply `effectMultiplier` in combat calculations |
| `src/services/cardDescriptionService.ts` | Verify (likely no change needed) |
| `src/services/cardUpgradeService.ts` | Update comment |
| `docs/GAME_DESIGN.md` | Remove ease power section, update tier table |
| `docs/ARCHITECTURE.md` | Update card factory docs |
