# AR-98: Player Profile Rework — Research-Backed Archetypes

## Overview

**Goal:** Replace 6 unrealistic player profiles with 6 research-backed archetypes that represent distinct real-world player populations. Current profiles have impossible combinations (optimal strategy + 48% accuracy), redundant archetypes (first_timer ≈ developing_newbie), and missing key segments (casual players, good-gamer-bad-student).

**Research basis:**
- Wilson et al. 2019: optimal learning error rate ~15% → 85% accuracy target for experts
- SM-2/FSRS: 10+ runs = spaced repetition has kicked in, accuracy should be 62-70%
- STS player data: experienced roguelite players optimize card selection independently of quiz knowledge

**Estimated complexity:** LOW — profile definitions + label updates only

---

## New Profile Definitions

### 1. `first_timer` — Day 1, never played a roguelite
- **Who:** Brand new player, first session. Doesn't understand mechanics, guessing at facts.
- **Accuracy:** 45% base, improving +0.5%/floor, min 0.30, max 0.55
- **Strategy:** basic (shield when low, attack otherwise, random picks)
- **Charge:** 15% random, 60% on surge turns
- **Reading:** slow, 5% speed bonus
- **Engagement:** 5% skip, passive aggression

### 2. `casual_learner` — Plays occasionally, decent general knowledge
- **Who:** The largest real-world segment. Plays a few runs per week, has good general knowledge from school/life, but doesn't try to optimize strategy. Charges when they feel like it.
- **Accuracy:** 65% flat, min 0.55, max 0.75
- **Strategy:** basic (doesn't read enemy intents, plays cards by feel)
- **Charge:** 30% random, 70% on surge turns
- **Reading:** normal, 15% speed bonus
- **Engagement:** 3% skip, balanced aggression

### 3. `regular` — 10+ runs, learning the ropes
- **Who:** Committed player who's figured out charging matters, reads enemy intents sometimes, SM-2 has started working on their fact retention.
- **Accuracy:** 62% base, improving +0.8%/floor, min 0.50, max 0.75
- **Strategy:** intermediate (reads enemy intent, shields before attacks, uses buffs)
- **Charge:** 40% base, 90% on surge
- **Reading:** normal, 12% speed bonus
- **Engagement:** 3% skip, balanced aggression

### 4. `gamer` — Expert roguelite player, new to facts
- **Who:** STS streamer who just picked up Recall Rogue. Optimal card selection, chain awareness, buff stacking — but answers geography questions at coin-flip rates. Will charge heavily because they understand the multiplier system, even though they get answers wrong often.
- **Accuracy:** 55% base, improving +1.0%/floor, min 0.40, max 0.68
- **Strategy:** optimal (chain-aware, combo management, buff stacking)
- **Charge:** 80% base, always on surge (they understand the system, just bad at facts)
- **Reading:** normal, 15% speed bonus
- **Engagement:** 1% skip, aggressive

### 5. `dedicated` — 20+ runs, good at both
- **Who:** Practiced player who knows both the mechanics and has decent fact recall. SM-2 has been working for weeks. Plays optimally but isn't a savant.
- **Accuracy:** 70% base, improving +0.5%/floor, min 0.58, max 0.80
- **Strategy:** optimal
- **Charge:** 85% base, always on surge
- **Reading:** normal, 20% speed bonus
- **Engagement:** 2% skip, balanced

### 6. `scholar` — 50+ runs, mastery
- **Who:** The realistic ceiling. Strong knowledge base (Wilson et al. optimal 85% zone), plays optimally, charges almost everything. Represents what a committed player achieves after months.
- **Accuracy:** 82% flat, min 0.72, max 0.90
- **Strategy:** optimal
- **Charge:** 90% base, always on surge
- **Reading:** fast, 40% speed bonus
- **Engagement:** 1% skip, aggressive

---

## Charge Logic Updates in `selectPlayMode()`

The function in `combat-strategies.ts` needs updates to support the new profiles:

- **basic:** was 20%/80% surge → now 15%/60% surge (first_timer is more hesitant, casual_learner is 30%/70%)
  - Actually basic covers two profiles now with different charge rates. Solution: add a `chargeRate` and `surgeChargeRate` field to the profile type, then use those instead of hardcoded percentages.
- **intermediate:** keep 40%/90% (matches regular)
- **optimal:** was 85%/100% → now profile-driven (gamer 80%, dedicated 85%, scholar 90%)

### New fields on PlayerProfile

Add to `strategicSkill` in `types.ts`:
```typescript
/** Base probability of choosing Charge over Quick Play (0-1). */
chargeRate?: number;
/** Probability of choosing Charge on surge turns (0-1). */
surgeChargeRate?: number;
```

Then `selectPlayMode()` reads these instead of hardcoding per strategy level.

---

## Files to Modify

1. `tests/playtest/core/types.ts` — Add `chargeRate` and `surgeChargeRate` to `StrategicSkill`
2. `tests/playtest/core/combat-strategies.ts` — Update `selectPlayMode()` to use profile charge rates
3. `scripts/mass-simulate.ts` — Replace all 6 profile definitions

---

## Verification

- [ ] `npm run typecheck` passes
- [ ] `npx vitest run` — all tests pass
- [ ] Quick smoke test: each profile produces distinct survival rates at asc0
- [ ] `casual_learner` should survive more than `first_timer` but less than `regular`
- [ ] `gamer` should outperform `casual_learner` despite lower accuracy (strategy matters)
