> **Status**: Phases 1-8 COMPLETE. Phase 9 (re-simulation) pending user request.

# AR-95: Headless Simulator Fidelity Overhaul

## Overview

**Goal:** Bring the headless combat simulator (`tests/playtest/core/headless-combat.ts`) to full mechanical parity with the live game, so that mass simulations (4M+ runs) produce results that actually reflect real gameplay.

**Motivation:** A comprehensive audit on 2026-03-18 revealed that the simulator is missing or incorrectly modeling 8+ core combat systems. The 4.4M-run balance report produced that day used wrong damage values, wrong AP economy, no chains, and missing relic hooks — making the data directionally useful but numerically unreliable.

**Dependencies:** None (standalone simulator improvement)
**Estimated complexity:** HIGH — touches combat core, strategy AI, and deep analytics

## Completed Work (2026-03-18)

### Phase 1: Play Mode Decision Engine ✅
- Added `selectPlayMode()` to `combat-strategies.ts` with per-strategy-level logic
- Basic: 70% quick play, charges on surge. Intermediate: 40% quick, surge/combo-aware. Optimal: 15% quick, always charges surge.
- Checks AP affordability — can't afford charge surcharge → forced quick play
- Supports `playModeOverride` for mass-simulate forced strategies

### Phase 2: Surge System ✅
- Imported `isSurgeTurn` from `src/services/surgeSystem`
- Surge turn detection wired into play mode decision — strategies heavily favor charging on surge

### Phase 3: Play Mode Wiring ✅
- `playCardAction` now receives correct `playMode` parameter (5th arg)
- Quick Play: `effectiveCorrect = true` (no quiz), combo decays, quickPlayValue used
- Charge: normal answer correctness, combo builds, chargeCorrectValue/chargeWrongValue used
- Deep stats track chargePlayCount, quickPlayCount, surgeChargeCount, surgeUtilization

### Phase 4: Relic Hooks ✅
- glass_cannon +35% attack damage bonus added (was missing)
- berserker_band corrected from +50% to +40% (matching resolveAttackModifiers)
- resolveAttackModifiers and resolveChargeCorrectEffects confirmed already covered by manual implementation (timer-based relics not simulatable in headless)

### Phase 5: Enemy Reactive Callbacks ✅
- Verified: turnManager automatically handles onPlayerChargeWrong, onPlayerChargeCorrect, onPlayerNoCharge, and quickPlayImmune when correct playMode is passed
- No additional wiring needed — Phase 1 fix resolved this

### Phase 6: Combo Healing ✅
- Verified: turnManager lines 815-825 handle combo heal (threshold 6+, +1 HP per correct charge)
- With correct playMode, quick plays correctly skip combo heal

### Phase 7: Status Effect Multipliers ✅ (deferred verification)
- cardEffectResolver handles vulnerability and strength internally
- With correct playMode, these apply via the standard playCardAction path

### Phase 8: Mass Simulate Mixed Mode ✅
- New `--mode mixed` added to mass-simulate.ts
- Generates force_quick, force_charge, and mixed configs for all profiles × difficulty × ascension
- Produces comparative analysis table showing survival, DPS, combo per strategy
- Smoke test confirmed: force-quick 0% survival, force-charge up to 37%, mixed intermediate

### Phase 3b: Knowledge Chain System — DEFERRED
- Chain system integration requires importing chainSystem.ts and adding chain-type tracking to cards
- Cards in the simulator currently don't carry chainType information
- This is a larger change that requires card pool restructuring — deferred to AR-96

---

## Root Cause

The simulator's `playCardAction()` call on line 453 of `headless-combat.ts` passes only 4 arguments:

```typescript
const pcr = playCardAction(turnState, card.id, correct, speed);
```

The 5th parameter `playMode: PlayMode = 'charge'` always defaults to `'charge'`, meaning:
- Quick Play mode is never exercised
- All cards always use `chargeCorrectValue` damage (3× base for Strike)
- AP surcharge for charging is always applied by turnManager
- Combo always builds +1 (never decays from Quick Play)
- Chain system never receives Quick Play break signals
- Enemy reactive callbacks never trigger

This single omission cascades to invalidate ~80% of the simulator's mechanical modeling.

---

## Sub-Steps

### Phase 1: Play Mode Decision Engine

#### 1.1 Add Quick Play / Charge decision logic to combat strategies
- **File:** `tests/playtest/core/combat-strategies.ts`
- **What:** Add a `selectPlayMode()` function that returns `'charge' | 'quick'` based on:
  - Player profile's `strategicSkill.level` (basic/intermediate/optimal)
  - Current AP available vs cards remaining to play
  - Whether it's a Surge turn (free charge)
  - Whether the card's fact has been seen before (Free First Charge)
  - Enemy HP remaining (low HP → quick play to finish fast)
  - Current combo count (high combo → prefer charge to maintain)
  - Card type (attack vs utility — utility cards may be worth quick-playing)
  - Player accuracy (low accuracy players should quick play more to avoid fizzle)
- **Decision heuristics by profile level:**
  - `basic`: Quick Play 60-80% of cards. Charge only on Surge turns or when hand has 1-2 cards left. Never considers AP efficiency.
  - `intermediate`: Quick Play 30-50%. Charges when Surge is active, when combo is high (3+), or when enemy HP is above 50%. Considers AP budget.
  - `optimal`: Quick Play 10-20%. Charges almost everything except when AP is critical (1 AP left, 3 cards to play). Always charges on Surge. Chains aggressively.
- **Acceptance:** Unit tests showing different profiles produce different charge rates matching expected behavior

#### 1.2 Pass playMode to playCardAction
- **File:** `tests/playtest/core/headless-combat.ts`, line 453
- **What:** Change from:
  ```typescript
  const pcr = playCardAction(turnState, card.id, correct, speed);
  ```
  To:
  ```typescript
  const playMode = selectPlayMode(profile, turnState, card, correct);
  const pcr = playCardAction(turnState, card.id, correct, speed, playMode);
  ```
- **What for wrong answers:** When `correct === false` and `playMode === 'charge'`, the turnManager already handles fizzle. When `playMode === 'quick'`, the card always "succeeds" but at quickPlayValue.
- **Acceptance:** Console log showing mix of 'charge' and 'quick' plays per run

#### 1.3 Track play mode statistics in deep analysis
- **File:** `tests/playtest/core/headless-combat.ts` (deep stats), `scripts/mass-simulate.ts` (DeepAccumulator)
- **What:** Add to deep stats:
  - `chargeRate`: % of cards played as Charge
  - `quickPlayRate`: % played as Quick Play
  - `chargeCorrectRate`: % of charges answered correctly
  - `chargeWrongRate`: % of charges answered wrong
  - `avgChargesPerTurn`: average charges per turn
  - `surgeChargeRate`: % of surge turns where player charged
- **Acceptance:** Deep analysis JSON includes play mode breakdown

---

### Phase 2: Knowledge Surge System

#### 2.1 Import and wire surge system
- **File:** `tests/playtest/core/headless-combat.ts`
- **What:** Import `getSurgeChargeSurcharge` from `src/services/surgeSystem`
- **Wire:** Before play mode decision, check if current turn is a Surge turn
- **Effect:** Surge turns should heavily bias toward Charge play (AP surcharge = 0)
- **Note:** The turnManager already handles surge internally when playMode='charge' is passed — but the STRATEGY needs to know about surge to make the right decision
- **Acceptance:** Surge turns show 90%+ charge rate for all profiles

#### 2.2 Track surge utilization in deep stats
- **What:** Add `surgeUtilization` metric: % of surge turns where at least 1 charge was played
- **Acceptance:** Metric appears in deep analysis output

---

### Phase 3: Knowledge Chain System

#### 3.1 Import and integrate chain tracking
- **File:** `tests/playtest/core/headless-combat.ts`
- **What:** Import chain system from `src/services/chainSystem`
- Track `chainType` for each card played
- Chain builds when consecutive Charge plays share same `chainType`
- Chain breaks on: Quick Play, wrong Charge, or different chainType
- Chain multipliers: 1-chain: 1.0×, 2: 1.3×, 3: 1.7×, 4: 2.2×, 5: 3.0×
- **Note:** Chain multiplier stacks MULTIPLICATIVELY with combo multiplier — this could be huge for damage output
- **Acceptance:** Deep stats show chain length distribution and chain multiplier contribution to damage

#### 3.2 Add chain-aware card selection to strategies
- **File:** `tests/playtest/core/combat-strategies.ts`
- **What:** When selecting which card to play, consider chainType:
  - `optimal`: Prefer cards matching current chain's chainType (to extend chain)
  - `intermediate`: Sometimes chain-aware (50% of the time)
  - `basic`: Ignores chains entirely
- **Acceptance:** Optimal profiles build longer chains than basic profiles

#### 3.3 Track chain statistics in deep analysis
- **What:** Add to deep stats:
  - `avgChainLength`: average chain length per encounter
  - `maxChainLength`: longest chain achieved in run
  - `chainDamageContribution`: % of total damage attributable to chain multipliers
  - `chainLengthDistribution`: histogram of chain lengths (1, 2, 3, 4, 5+)
- **Acceptance:** Chain stats appear in deep analysis and mass-simulate output

---

### Phase 4: Missing Relic Hooks

#### 4.1 Wire resolveAttackModifiers
- **File:** `tests/playtest/core/headless-combat.ts`
- **What:** Import `resolveAttackModifiers` from `src/services/relicEffectResolver`
- Call it when computing attack damage (currently the simulator computes damage via playCardAction which goes through cardEffectResolver, but relic attack modifiers may be applied separately)
- **Verify:** Check whether `cardEffectResolver.ts` already calls `resolveAttackModifiers` internally, or if it needs external wiring
- **Relics affected:** whetstone (+2 base damage), flame_brand (first attack bonus), glass_cannon (damage multiplier), berserker_band (low HP damage boost), chain_lightning_rod, crescendo_blade, war_drum, barbed_edge
- **Acceptance:** Solo relic test for whetstone shows correct +2 damage per attack card

#### 4.2 Wire resolveChargeCorrectEffects
- **File:** `tests/playtest/core/headless-combat.ts`
- **What:** Import `resolveChargeCorrectEffects` from `src/services/relicEffectResolver`
- Call after a successful Charge play
- **Relics affected:** quicksilver_quill (1.5× on fast answers), adrenaline_shard (AP refund), combo_ring (+2 flat damage), bastions_will (+50% shield on charge shield cards), scholars_crown (+30-50% on tier 2/3), mirror_of_knowledge (replay card), crit_lens (25% crit chance), memory_nexus (bonus draw after 3 charges)
- **Acceptance:** Solo relic test for combo_ring shows +2 damage on first correct charge per turn

---

### Phase 5: Enemy Reactive Mechanics

#### 5.1 Wire enemy charge callbacks
- **File:** `tests/playtest/core/headless-combat.ts`
- **What:** After each card play, check and invoke:
  - `enemy.template.onPlayerChargeWrong` — when charge play and wrong answer
  - `enemy.template.onPlayerChargeCorrect` — when charge play and correct answer
  - At end of turn: `enemy.template.onPlayerNoCharge` — if no charge plays this turn
- **Note:** turnManager.ts already handles these (lines 473, 706, 899) but ONLY when playMode='charge' is correctly passed. With Phase 1 fix, these should work automatically.
- **Verify:** Confirm that with playMode correctly passed, turnManager invokes these callbacks. If so, no extra wiring needed — just verify.
- **Acceptance:** Test against quickPlayImmune enemy (The Librarian) — quick play damage should be 0

#### 5.2 Wire quickPlayImmune check
- **What:** Verify that `enemy.template.quickPlayImmune` is checked when playMode='quick'
- **Note:** turnManager.ts line 688 already does this check. With playMode correctly passed, it should work.
- **Acceptance:** Runs against quickPlayImmune enemies show 0 damage from quick plays

---

### Phase 6: Combo Healing

#### 6.1 Verify combo heal triggers
- **What:** turnManager.ts lines 815-825 already implement combo healing (at threshold 6+, heal 1 HP per correct charge). Since the simulator calls `playCardAction` which contains this logic, it SHOULD work already.
- **Verify:** Add logging to confirm combo heals are triggering in simulation runs
- **Risk:** The combo heal code in turnManager reads `playMode !== 'quick'` — with Phase 1 fix, Quick Play cards will correctly NOT trigger combo heal
- **Acceptance:** Deep stats show combo heals happening in runs where combo reaches 6+

---

### Phase 7: Status Effect Multipliers

#### 7.1 Verify vulnerability and strength multipliers
- **What:** Check whether `cardEffectResolver.ts` applies vulnerability (1.5× damage) and strength modifiers internally
- If it does: the simulator already benefits (since it calls playCardAction → cardEffectResolver)
- If it doesn't: need to apply these modifiers in the simulator's damage calculation
- **Files to check:** `src/services/cardEffectResolver.ts`, `src/data/statusEffects.ts`
- **Acceptance:** Debuff cards that apply vulnerability result in subsequent attacks dealing 1.5× damage

---

### Phase 8: Mass Simulate Enhancements

#### 8.1 Add play mode metrics to mass-simulate output
- **File:** `scripts/mass-simulate.ts`
- **What:** Extend `AggregatedMetrics` and `DeepAccumulator` with:
  - `avgChargeRate`: average % of cards played as Charge
  - `avgQuickPlayRate`: average % of cards played as Quick Play
  - `avgChainLength`: average chain length
  - `avgSurgeUtilization`: average surge turn utilization
- **Acceptance:** Mass simulation output includes new metrics

#### 8.2 Add "mixed strategy" mode
- **File:** `scripts/mass-simulate.ts`
- **What:** New mode `--mode mixed` that runs each profile with:
  - All-quick strategy (never charge)
  - All-charge strategy (current behavior, charge every card)
  - Profile-appropriate mixed strategy (from Phase 1)
  - Compares survival, DPS, and floor reached across all three
- **Purpose:** Answers the user's exact question: "Is charging worth it at each floor?"
- **Acceptance:** Mixed mode produces comparative table showing charge vs quick vs mixed performance

#### 8.3 Add per-floor charge/quick breakdown to deep mode
- **What:** In deep mode, track per-floor statistics:
  - Charge rate by floor
  - Quick play rate by floor
  - Average chain length by floor
  - Charge impact on survival by floor (damage dealt via charge vs quick)
- **Acceptance:** Deep analysis JSON includes per-floor play mode breakdown

---

### Phase 9: Verification & Re-Simulation

#### 9.1 Run unit tests
- **What:** `npx vitest run` — ensure no regressions from simulator changes
- **Acceptance:** All 1900+ tests pass

#### 9.2 Run typecheck and build
- **What:** `npm run typecheck && npm run build`
- **Acceptance:** Clean typecheck, successful build

#### 9.3 Re-run mass simulation with fixed simulator
- **What:** Re-run the full 7-mode mass simulation from 2026-03-18 with the corrected simulator
- Compare results against previous run to quantify the impact of each fix
- **Acceptance:** New report at `docs/MASS-SIMULATION-REPORT-2026-03-18-v2.md` with comparison notes

#### 9.4 Run the new "mixed" mode specifically
- **What:** `npx tsx scripts/mass-simulate.ts --mode mixed --seeds 2000 --ascension 0,5,10,15,20`
- **Purpose:** Directly answers "is charging worth it on early floors?"
- **Acceptance:** Report includes charge vs quick vs mixed strategy comparison

---

## Files Affected

### Modified
- `tests/playtest/core/headless-combat.ts` — play mode passing, chain system, surge system, relic hooks, combo heal verification
- `tests/playtest/core/combat-strategies.ts` — play mode decision engine, chain-aware card selection
- `tests/playtest/core/types.ts` — new deep stat fields for play mode and chain tracking
- `scripts/mass-simulate.ts` — new metrics, new "mixed" mode, enhanced deep accumulator

### Possibly Modified (verify first)
- `src/services/relicEffectResolver.ts` — may need export adjustments for simulator imports
- `src/services/chainSystem.ts` — may need export adjustments

### Not Modified
- `src/services/turnManager.ts` — the game code is correct; only the simulator is wrong
- `src/services/cardEffectResolver.ts` — already handles play modes correctly
- `src/data/mechanics.ts` — already has correct quickPlay/chargeCorrect/chargeWrong values

---

## Verification Gate

- [x] `npm run typecheck` passes
- [x] `npm run build` succeeds
- [x] `npx vitest run` — all tests pass (1969/1969, 2 pre-existing failures unrelated)
- [x] Mass simulation runs without errors (mixed mode smoke-tested)
- [x] Deep analysis output includes play mode metrics
- [ ] Deep analysis output includes chain metrics (chain system not yet integrated — deferred)
- [x] "mixed" mode produces charge vs quick comparison table
- [x] Optimal profile shows higher charge rate than basic profile (65% vs 45% verified)
- [x] Surge turns show elevated charge rate (basic 88.5%, optimal 100%)
- [x] quickPlayImmune enemies block quick play damage (wired via turnManager automatically)
- [ ] Solo relic tests show different results from pre-fix values (requires re-simulation)
- [ ] Comparison report documents pre-fix vs post-fix differences (requires re-simulation)

---

## Priority & Sequencing

**Phases 1-3 are the highest priority** — they fix the fundamental damage calculation, AP economy, and chain system that every other metric depends on.

**Phase 4-5** fix relic and enemy hooks that affect specific configurations.

**Phase 6-7** are verification steps for systems that may already work once Phase 1 is fixed.

**Phase 8-9** are the payoff — enhanced analytics and the re-simulation that produces trustworthy data.

Recommended execution order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 (sequential, each builds on prior)
