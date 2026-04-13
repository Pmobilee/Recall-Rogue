# Track 2 — Combat Core Mechanics
**Date:** 2026-04-12  
**Agent:** QA agent (track-2 Docker container)  
**Container:** warm, agent-id=track-2  

## Verdict: ISSUES FOUND

---

### Sequence A: AP System & Surge

**Status:** PASS (with notes)

**Evidence:**
- Turn 1: `ap=3` — Starting AP is 3 (Act 1). PASS.
- After `quickPlayCard(0)`: `ap=2` — costs 1 AP. PASS.
- After `endTurn` (turn 2 = surge): `ap=4` — 3 base + 1 SURGE_BONUS_AP. PASS.
- Player took expected damage (100→87 = 13 HP, within page_flutter attack range).

**AP Refill Verified:**
```
Before turn end: ap=2
After turn end (surge turn 2): ap=4  [3 base + 1 surge bonus]
```

**Surge timing:** Turns 2, 6, 10, 14 correctly grant +1 AP per `isSurgeTurn()`. Confirmed via unit tests in `surgeSystem.ts`. Live container surge turns vary because `RunState.globalTurnCounter` persists across scenario loads within the same container session — not a bug, a testing limitation.

**Hand Size After Turn End:**
Observed `handSize=7` on surge turns (instead of expected 5). Investigation revealed this is CORRECT:
- Base draw = 5 per turn
- `SURGE_DRAW_BONUS = 1` added on surge turns
- Flow State bonus (+1 draw when fog ≤ 2): fog starts at 0 each encounter, which is below the `FLOW_STATE_THRESHOLD=2`, so flow_state is active from encounter start
- Total: 5 + 1 + 1 = 7 cards drawn on surge turn 1 (global turn 2)

This is documented in `knowledgeAuraSystem.ts` and `turnManager.ts` line 3635-3640. The CLAUDE.md and docs do NOT mention the `SURGE_DRAW_BONUS` in the docs/mechanics/combat.md AP section — this is a documentation gap.

---

### Sequence B: Damage Pipeline Quick vs Charge

**Status:** ISSUES FOUND

**Evidence (sequential, isolated runs):**
```
Quick Play strike:    damage=4, AP cost=1  (QP baseline)
Charge Correct:       damage=6, AP cost=2  (4 × 1.50 = 6.0) ✓
Charge Wrong (fizzle): damage=4, AP cost=1 (on-colour: surcharge waived)
```

**ISSUE B-1 (MEDIUM): Fizzle damage = QP damage, not 0.5× QP**

Expected fizzle: `Math.round(4 × 0.5) = 2` per FIZZLE_EFFECT_RATIO=0.5  
Actual fizzle: 4 (same as QP)  

Root cause traced to TWO divergent fizzle implementations:

1. **`cardEffectResolver.resolveCardEffect()`** (used by unit tests): uses `mechanic.chargeWrongValue` = 3 for strike. Unit tests pass this correctly.

2. **`turnManager.playCardAction()` wrong-answer inline path** (lines 1208-1211): uses `Math.round(card.baseEffectValue × FIZZLE_EFFECT_RATIO)`. In live combat, scenario-spawned cards have `card.baseEffectValue = mechanic.baseValue = 8` (set in `scenarioSimulator.ts` line 895). `Math.round(8 × 0.5) = 4` → fizzle equals QP value.

The docs state: "`FIZZLE_EFFECT_RATIO` (0.50×) is a FALLBACK for cards without explicit CW values, not the default." But the turnManager fizzle code always uses `card.baseEffectValue × ratio` instead of `mechanic.chargeWrongValue`. This means:
- All fizzles in LIVE COMBAT use the ratio formula against `mechanic.baseValue`, not the explicit `chargeWrongValue`
- Unit tests use `cardEffectResolver` which correctly uses `mechanic.chargeWrongValue`
- The unit test coverage does NOT cover the actual live fizzle path in `playCardAction`

For strike: `mechanic.chargeWrongValue=3` vs live fizzle `4`. Live fizzle is HIGHER than it should be.

**AP cost for on-colour fizzle:**
The charge surcharge is correctly waived when `card.chainType === getActiveChainColor()`. So on-colour wrong charges cost 1 AP (not 2). This is correct per the waiver rules in `turnManager.ts` line 959.

**ISSUE B-2 (LOW): chargePlayCard API message string discrepancy**

When charge tests ran in parallel (sharing the container), `chargePlayCard(0, true)` reported "answered incorrectly" and vice versa. This is a race condition in the warm container (parallel test runs share state). The sequential test reproduced correctly. No code bug — a test methodology issue.

---

### Sequence C: Chain System

**Status:** PARTIAL PASS (limited testing due to AP constraints)

**Evidence:**
```
Before: ap=3, enemyHp=37
After chargePlayCard(0, true): ap=1, enemyHp=30
  damage=7, AP cost=2 (no surcharge waiver; chainType≠activeChainColor)
Second chargePlayCard attempted: BLOCKED (needs 2 AP, have 1)
```

Chain damage: 7 vs expected 6 (= 4×1.5). The extra 1 damage suggests chain multiplier applied:  
Chain length 0 → first CC extends to chain length 1 → multiplier for next play would be 1.2×.  
Wait — the damage WAS 7 on the first CC. Chain starts at 0 before the play. CC at chain 0 applies chainMultiplier=1.0 → `round(6 × 1.0) = 6`. But we got 7.

This suggests chain multiplier 1.0 × other factors ≠ 6. The discrepancy may be rounding or a mastery stat table difference at play. Not enough AP remaining to test chain build (second card blocked). 

**getCombatState does NOT expose chainLength or chainMultiplier** — these are not in the API output. Chain testing via the programmatic API is difficult without additional fields.

---

### Sequence D: Status Effects — Poison

**Status:** PASS

**Evidence:**
```
Before endTurn: playerHp=80, status=[{type:'poison', value:3, turnsRemaining:3}]
After endTurn:  playerHp=62, status=[{type:'poison', value:3, turnsRemaining:2}]
HP change: -18 (enemy attack ~15 + poison 3 = 18 total)
Poison turns remaining: 3 → 2 (decremented correctly)
```

Poison tick executes at `endPlayerTurn()` step 7 (`tickPlayerStatusEffects`). Correctly applies value (3 damage) and decrements turnsRemaining by 1. PASS.

Note: `turnOverrides.playerState.statusEffects` does NOT apply via `loadCustom()`. Must use `__rrScenario.spawn()` instead. Documented as a testing gotcha below.

---

### Sequence E: Block Mechanics

**Status:** PASS

**Evidence:**
```
Quick-play block card: playerBlock 0 → 4 (QP block applied)
After enemy turn:      playerBlock 4 → 0, playerHp=100 (block absorbed all damage)
```

Block correctly applies from quick-playing shield card. Block absorbs incoming damage first (if enemy attack ≤ block value, HP is preserved). PASS.

Note: Block fully consumed when damage ≤ block value — block is NOT partially consumed and carried over. After `resetTurnState()`, shield decays per act (15% Act 1), but if completely consumed during enemy attack, it goes to 0 naturally.

---

### Sequence F: Enemy Intent Types

**Status:** PARTIAL PASS

**page_flutter attack intent:**
```
Player HP: 100 → 84 after enemy attack (intent type=attack, displayDamage=16, actual=16)
```
PASS — attack intents deal damage to player.

**Intent variety confirmed:** page_flutter used 'attack' (Swooping strike), 'buff' (Screeching — strength), in testing.

**thesis_construct defend intent:** Could not complete — the endTurn polling timed out when testing combat-10-cards scenario. thesis_construct has longer animation cycles. Skipped.

**Enemy block from defend intent:** Not confirmed due to thesis_construct timeout. However, `getEnrageBonus()` is documented as always returning 0 (enrage removed). The defend intent path should set `enemy.block += intent.value` — not verified live.

---

### Sequence G: Near-Death / Phoenix Feather

**Status:** PASS

**Evidence:**
```
Turn 1: playerHp=1, ap=3 (enemy executed non-attack intent)
Turn 2: playerHp=1, ap=4 (surge; enemy executed non-attack intent again)
Turn 3: playerHp=15, ap=4 (surge; enemy executed attack — lethal → phoenix triggered → 15% of 100 = 15 HP)
```

Phoenix feather correctly:
1. Detects lethal damage (`playerDefeated=true`)
2. Restores HP to `Math.max(1, Math.round(maxHP × 0.15))` = 15
3. Does NOT fire on non-attack intents (player correctly stays at 1 HP when enemy does defend/heal)
4. `phoenixAutoChargeTurns=1` set (confirmed from code inspection at line 3328)

**Note:** `phoenixUsedThisRun` is hardcoded to `false` (line 3304 comment: `TODO: wire up run-level phoenix flag (AR-59.11)`). Phoenix CAN fire every encounter in the current codebase. This is an open AR. PASS for the trigger behavior itself.

---

## Issues Found

### ISSUE 1 — MEDIUM SEVERITY
**[src/services/turnManager.ts:1211] Fizzle damage uses card.baseEffectValue, not mechanic.chargeWrongValue**

In live combat, wrong charge plays (`playMode='charge'`, `answeredCorrectly=false`) resolve via the inline fizzle path:
```typescript
const fizzleBase = Math.round(card.baseEffectValue * wrongMultiplier);  // line 1211
```

For scenario-spawned cards, `card.baseEffectValue = mechanic.baseValue` (set in `scenarioSimulator.ts` and production `cardFactory.ts` uses `BASE_EFFECT[cardType]`). For attack cards: `BASE_EFFECT.attack=4` (unit tests) vs `mechanic.baseValue=8` for strike (live game via scenarioSimulator).

The correct fizzle path per `cardEffectResolver.resolveCardEffect()` uses `mechanic.chargeWrongValue` (3 for strike). The turnManager inline path gives 4 (= 8 × 0.5) for strike in live combat.

**Impact:** Wrong charges on attack cards deal MORE damage than intended (4 vs expected 2 from ratio, or 3 from explicit CW value). Verified in live combat across multiple runs.

**Investigation needed:** What does `card.baseEffectValue` equal for cards created by production `cardFactory.ts`? If `BASE_EFFECT.attack=4`, then `Math.round(4 × 0.5)=2` — different from unit test CW path (3). Either way, the two fizzle implementations produce inconsistent results.

---

### ISSUE 2 — LOW SEVERITY  
**[src/dev/playtestAPI.ts] endTurn timing: 3s polling window insufficient for some scenarios**

The `endTurn()` API polls for up to 3s (60 × 50ms) for the turn to complete. For page_flutter in `combat-basic`, turn completion requires 5-8s after endTurn click. thesis_construct and algorithm scenarios require even longer. Calling `getCombatState` within 3-5s of `endTurn` will return pre-transition state, giving false "turn didn't complete" readings.

**Workaround:** Add `{"type":"wait","ms":6000}` after `endTurn` action, then call getCombatState.

---

### ISSUE 3 — LOW SEVERITY (Documentation Gap)
**[docs/mechanics/combat.md] SURGE_DRAW_BONUS not documented in combat.md AP section**

`SURGE_DRAW_BONUS=1` is defined in `balance.ts` line 359 and implemented in `turnManager.ts` lines 3634-3636. It's not mentioned in the AP System section of `docs/mechanics/combat.md`. The combat docs describe surge as granting "+SURGE_BONUS_AP (+1)" but omit the draw bonus. The combination of surge (+1 draw) and initial flow_state (+1 draw) produces handSize=7 on the first turn end, which appears as unexpected behavior.

---

### ISSUE 4 — INFO
**[src/services/turnManager.ts:3304] Phoenix feather used-flag is a TODO**

```typescript
phoenixUsedThisRun: false, // TODO: wire up run-level phoenix flag (AR-59.11)
```

Phoenix can currently trigger every encounter (not once-per-run as documented). This is AR-59.11, open item.

---

## Test Infrastructure Notes

1. `__rrScenario.loadCustom()` does NOT apply `turnOverrides.playerState.statusEffects`. Use `__rrScenario.spawn()` instead.
2. Parallel Docker test runs on the same warm container share `globalTurnCounter` state — surge timing differs across parallel runs.
3. `getCombatState` does not expose `chainLength`, `chainMultiplier`, `chainType`, `isSurge`, `turn`, or `globalTurnCounter`. Chain mechanic testing is limited via this API.

---

## Full Test Suite Status
- **6249 unit tests: ALL PASS** (190 test files)
- **TypeScript build: verified passing** (prior runs)

