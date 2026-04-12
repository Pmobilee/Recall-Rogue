# Balance Curve Report — BATCH-2026-04-12-001

**Tester**: Balance Curve | **Model**: sonnet | **Domain**: general_knowledge | **Encounters**: 3 | **Deaths**: 0

## Verdict: ISSUES

Three full combats played, zero deaths, but two HIGH-priority findings about damage data drift between card metadata and rendered/actual values, plus a low-FPS warning surfaced from the recent-events ring buffer.

---

## Floor-by-Floor Data

| # | Encounter | Floor | Start HP | End HP | Enemy | Enemy HP | Turns | Gold Earned | Notes |
|---|-----------|-------|----------|--------|-------|----------|-------|-------------|-------|
| 1 | Page Flutter | 1 | 100 | 86 → 94 | Page Flutter | 33 | 2 | +10 | Vial heal post-combat (+8 HP) |
| 2 | Pop Quiz | 1 | 94 | 82 | Pop Quiz | 41 | 6 | +10 | Took 12 dmg net through block |
| 3 | Mold Puff | 1 | 82 | 76 | Mold Puff | 40 | 5 | +10 | Debuffer enemy, took poison ticks |

**HP trajectory**: 100 → 94 → 82 → 76 (24% HP loss over 3 combats, no checkpoint heal yet).
**Gold trajectory**: 0 → 20 → 40 → 60 (steady 10g per combat + reward).
**Total damage taken**: 24 net (with block + vial healing factored in).
**Total damage dealt**: 114 (33 + 41 + 40).

> NOTE: All three combats happened on Floor 1 because `__rrPlay.spawn({screen:'combat'})` reset the run, so the subsequent map node selections (`r0-n0`, `r1-n0`) advanced from r0, not from a "real" mid-run state. The "Floor 2-3 danger" objective check (O-BC2) cannot be evaluated cleanly from this run.

---

## Damage Exchange Log

### Combat 1 — Page Flutter (HP 33, attack 14)

| Turn | Player Action | Enemy HP After | Player HP After | Block | Notes |
|------|---------------|----------------|------------------|-------|-------|
| 1 | Charge Strike (correct) | 33 → 26 (−7) | 100 | 0 | base 8, charge ×1.5 expected = 12, got 7 |
| 1 | Quick Strike | 26 → 22 (−4) | 100 | 0 | base 8, quick should be 8, got 4 |
| 1 | endTurn → enemy attack | 22 | 100 → 86 (−14) | 0 | enemy displayDmg 14, took 14 |
| 2 | Charge Strike (correct) | 22 → 11 (−11) | 86 | 0 | charge correct |
| 2 | Charge Strike (correct) | 11 → 0 KILL | 86 | 0 | charge correct |
| Post | Reward vial heal | n/a | 86 → 94 (+8) | 0 | small vial |

Combat 1 turns: **2**. Quick play average ~4 dmg. Charge play range 7–11 dmg.

### Combat 2 — Pop Quiz (HP 41, attack 15-17)

| Turn | Player Action | Enemy HP After | Player HP After | Block | Notes |
|------|---------------|----------------|------------------|-------|-------|
| 1 | Charge Strike (correct) | 41 → 30 (−11) | 94 | 0 | charge correct |
| 1 | Quick Block | 30 | 94 | +4 | base 6, quick reduces to 4 |
| 1 | endTurn | 30 | 94 (−0) | 3 | block absorbed full attack? unclear |
| 2 | Charge Strike (WRONG) | 30 → 26 (−4) | 94 | 3 | charge wrong (~0.5×) |
| 2 | Quick Strike | 26 → 22 (−4) | 94 | 3 | quick base |
| 2 | endTurn → enemy attack | 22 | 94 → 82 (−12) | 0 | 15 dmg, 3 block, 12 net |
| 3 | Charge Strike (correct) | 22 → 12 (−10) | 82 | 0 | charge correct |
| 3 | Quick Block | 12 | 82 | +4 | block |
| 3 | endTurn | 12 | 82 (−0) | 3 | poison telegraph; no immediate dmg |
| 4 | Charge Strike (correct) | 12 → 5 (−7) | 82 | 3 | charge correct |
| 4 | Quick Strike | 5 → 1 (−4) | 82 | 3 | quick base |
| 5 | Quick Strike | 1 → KILL | 82 | 3 | finished |

Combat 2 turns: **5–6**. Healthy length but felt long due to inconsistent damage.

### Combat 3 — Mold Puff (HP 40, debuffer — weakness/poison/no direct attacks)

| Turn | Player Action | Enemy HP After | Player HP After | Block | Notes |
|------|---------------|----------------|------------------|-------|-------|
| 1 | Charge Strike (correct) | 40 → 33 (−7) | 82 | 0 | charge correct |
| 1 | Quick Transmute | 33 | 82 | 0 | utility, no dmg |
| 1 | endTurn → enemy debuff | 33 | 82 | 0 | weakness applied |
| 2 | Charge Strike (correct, weakened) | 33 → 25 (−8) | 82 | 0 | charge w/ weakness |
| 2 | Charge Strike (WRONG) | 25 → 21 (−4) | 82 | 0 | charge wrong |
| 2 | endTurn → enemy debuff | 21 | 82 → 80 (−2) | 0 | poison applied + 2 dmg |
| 3 | Charge Strike (correct) | 21 → 11 (−10) | 80 | 0 | charge correct |
| 3 | Quick Strike | 11 → 7 (−4) | 80 | 0 | quick base |
| 3 | endTurn → enemy debuff | 7 | 80 → 76 (−4) | 0 | poison tick |
| 4 | Charge Block (correct, misclick) | 7 | 76 | +7 | meant to play strike — finger error |
| 4 | Quick Strike | 7 → 3 (−4) | 76 | 7 | quick base |
| 4 | endTurn → enemy debuff | 3 | 76 (−0) | ? | poison absorbed by block? |
| 5 | Quick Strike | 3 → KILL | 76 | ? | finished |

Combat 3 turns: **5**.

---

## Damage Pattern Summary

| Mode | Mean Damage Observed | Card `baseEffectValue` | Card In-Game Text | Multiplier |
|------|----------------------|-------------------------|--------------------|------------|
| Quick Strike | 4.0 (n=8) | 8 | "Deal 4 damage" | 0.5× of `baseEffectValue` |
| Charge Strike (correct) | 9.0 avg, range 7–11 (n=9) | 8 | implied 6 (4+2 from text "Deal 4+2 damage") | ~1.13× of base, ~2.25× of quick |
| Charge Strike (wrong) | 4.0 (n=2) | 8 | n/a | matches quick |
| Quick Block | 4.0 (n=2) | 6 | "Block 4" implied | 0.66× of `baseEffectValue` |

**Charge:Quick observed ratio**: 9.0 / 4.0 = **2.25×**, well above the documented 1.5× CHARGE_CORRECT_MULTIPLIER.

**Variance in charge correct**: 7, 11, 11, 10, 7, 8, 10, 10 (~9 ± 1.5) — possibly chain bonus or first-of-encounter mod, but the variance is wider than expected for a deterministic ×1.5.

---

## Objective Findings

| Check | Result | Measured | Expected | Notes |
|-------|--------|----------|----------|-------|
| O-BC1 Floor 1 survivability | PASS | 86% HP after combat 1, 94% with vial | >40% | Strong margin |
| O-BC2 Floor 2-3 danger | N/A | All combats on Floor 1 | n/a | spawn() reset run; can't evaluate |
| O-BC3 Quick vs Charge value | FAIL | 4.0 vs 9.0 = 2.25× | 1.3-2.0× | Charge over-rewarded vs spec |
| O-BC4 HP recovery pace | PASS | 100→76, 24% loss over 3 combats | not in death spiral | Vial helped |
| O-BC5 Gold economy | FAIL (low) | 60g after 3 combats | 50-200 at checkpoint | Lower-bound met but no shop access tested |
| O-BC6 Combat length | PASS / EDGE | 2, 6, 5 turns | 3-8 turns | Combat 1 was 2 turns (under range) |
| O-BC7 Enemy damage scaling | N/A | All Floor 1 enemies | n/a | spawn issue |
| O-BC8 No instant death | PASS | Max single-turn dmg taken: 14 | <60% HP swing | safe |

---

## Subjective Assessments

| Check | Rating | Notes |
|-------|--------|-------|
| S-BC1 Tension curve | 3/5 | Combat 1 was over before tension built; combat 2/3 were healthier. The first turn of combat 1 telegraphed 14 dmg and the player could only deal 11 — that creates a moment of "do I push or block?" which is the right vibe. |
| S-BC2 Agency (quick vs charge) | 2/5 | The choice "matters" mathematically (2.25× difference) but the wrong-answer penalty is identical to a quick play, so charging wrong is genuinely free — there's no risk to charging every card. The "correct choice" is just "always charge unless you're certain you'll be wrong." |
| S-BC3 Reward pacing | 4/5 | Vial heal felt earned after combat 1, the 3-card draft after combat 2/3 felt good. Gold scaling slow but acceptable for floor 1. |
| S-BC4 Deck growth | 2/5 | Got Double Strike and a Smite from rewards (mid-tier upgrades) but never got to play Double Strike before combat ended — encounters too short to use 2-AP combo cards. |
| S-BC5 Death fairness | n/a | No deaths in 3 encounters. |

---

## Issues Found

### CRITICAL
None.

### HIGH

**H-1: `baseEffectValue` field in `getCombatState` does not match in-game damage.**
- **Evidence**: Every card in the hand reports `baseEffectValue: 8` for Strike, but the in-game card text reads "Deal 4 damage" and quick plays consistently deal 4.
- **From `getAllText` capture during combat 2**:
  ```
  "Strike  Deal 4 damage 1"
  "Strike  Deal 4+2 damage 1"  (charged variant)
  "Block 4 damage" implied via Block card
  ```
- **Impact**: Any external balance tooling (headless sim, analysis scripts, tester sub-agents) reading `baseEffectValue` from `getCombatState` will be off by 2× and produce wrong DPS / win-rate predictions. The headless simulator and balance tests likely use the actual `cardEffects.ts` code which is correct, but anything reading the API will diverge.
- **Fix candidates**:
  1. Update `getCombatState` to surface the resolved `effectValue` (post-tier/mastery resolution) rather than the raw `baseEffectValue`.
  2. Add an `effectValue` field alongside `baseEffectValue` so callers know which to use.
  3. Document the field as "raw card data, not in-game damage" in `action-specs.md`.

**H-2: Charge:Quick observed ratio is 2.25×, not the documented 1.5×.**
- **Evidence**: Quick Strike consistently deals 4. Charge Strike correct deals 7–11 (mean 9.0). Ratio 9.0 / 4.0 = 2.25×.
- **Action-specs says**: "Quick play = `quickPlayValue` (this is the BASE, not a penalty). Charge correct = `quickPlayValue × CHARGE_CORRECT_MULTIPLIER (1.5x)`."
- **Possible explanations** (none verified — flagging for designer):
  1. Chain bonuses or relic effects are silently boosting charge damage.
  2. `CHARGE_CORRECT_MULTIPLIER` was bumped without updating the docs.
  3. Mastery level 0 cards have a hidden "first-encounter" boost.
  4. `baseEffectValue: 8` IS used internally for charge plays (charge ×1.5 of 8 = 12, not 6), while quick plays use a separate `quickPlayValue: 4`.
- **Impact**: Either the docs are wrong (most likely) or the math is wrong. Either way, agents reading `action-specs.md` to predict damage will be off by ~50%.

### MEDIUM

**M-1: `getCombatState` returns `null` after the killing blow lands but before the screen transitions.**
- **Evidence**: Combat 1 turn 2's second charge strike killed the enemy; the very next `getCombatState` returned null instead of a "combat ended" state. The `endTurn` call after a kill returns `{ok: true, message: "End turn button gone — combat likely ended"}` which is friendly, but `getCombatState` going to null mid-batch breaks any tester that polls state per-action.
- **Impact**: Forces testers to wrap every `getCombatState` in a null check. The graceful path should be a state object with a `combatEnded: true` flag.
- **Fix**: Have `getCombatState` return the last known state with a `combatEnded: true` marker until the transition completes.

**M-2: `getScreen` says `combat` while `RewardRoom` is the active Phaser scene.**
- **Evidence**: After combat 1 and combat 2 ended, the layout dump showed an active `▸ PHASER LAYER (RewardRoom)` with the gold/vial/3-card layout, but `getScreen()` continued returning `"combat"`. Only after `acceptReward()` does `getScreen` flip to `dungeonMap`.
- **Impact**: The Screen Router in `action-specs.md` says to handle screens by name. If `getScreen` lies about the active screen during the rewardRoom transition window, every tester following the router will get stuck. (This explains the existing note in action-specs that `cardReward` is integrated into rewardRoom — the same lie applies to combat→rewardRoom.)
- **Fix**: Either `getScreen` returns `'rewardRoom'` while RewardRoomScene is active, or the docs need a "during combat→reward transition, getScreen lags by ~1s" warning.

**M-3: First `acceptReward()` after combat 2 returned `{ok: false, message: "RewardRoomScene not active after 3s wait"}` even though the layout dump confirmed RewardRoomScene WAS active and visible.**
- **Evidence**: After playing the killing blow on Pop Quiz, immediate `acceptReward` failed. Waiting 2s and retrying succeeded. The Phaser scene was visible in the layout dump in the meantime.
- **Impact**: Race condition between scene activation and the 3s timeout in `acceptReward`. Not a hard block (retry works) but tester sub-agents will hit this and need fallback logic.

**M-4: Low FPS in CombatScene — sustained 22-30 fps over 600+ seconds**.
- **Evidence**: From `look()` recent-events ring buffer:
  ```
  [fps] Low FPS alert: 29 fps in CombatScene for 906s
  [fps] Low FPS alert: 30 fps in CombatScene for 966s
  [fps] Low FPS alert: 22 fps in CombatScene for 1026s
  [fps] Low FPS alert: 22 fps in CombatScene for 1086s
  [fps] Low FPS alert: 29 fps in CombatScene for 1146s
  ```
- **Impact**: Docker SwiftShader is expected to be slower than real GPU, but 22 fps for 17+ minutes of CombatScene uptime is concerning. The duration counter (`906s`, `966s`, ...) suggests the FPS sample window is the entire time the scene has been active, meaning the average is dragging down. Real player FPS likely much higher, but the alert thresholds may need adjustment for the Docker testing environment to avoid noise.
- **Note**: This is logged as a finding because the alerts exist in the ring buffer; real-player perf should be checked separately via `phaser-perf` skill.

### LOW

**L-1: Charge plays consume 2 AP for cards labeled `apCost: 1`.**
- **Evidence**: Strike has `apCost: 1` in `getCombatState.hand[i]`. Quick play consumes 1 AP (correct). Charge play consumes 2 AP (the +1 is the "charge tax").
- **Impact**: This is intended design, but the field is misleadingly named — `apCost` is the *quick* cost, not the cost in either mode. A field named `quickApCost` and `chargeApCost` would prevent the wrong assumption.

**L-2: Damage variance on charge correct is wider than a flat ×1.5 would predict.**
- **Evidence**: Charge correct values: 7, 11, 11, 10, 7, 8, 10, 10. Standard deviation ~1.7. A flat ×1.5 of base 8 would always be 12; or of base 4 (the rendered base) would always be 6. Neither matches.
- **Impact**: Probably mastery / chain interaction; needs spec confirmation.

---

## Raw Run Data

```json
{
  "runs": [{
    "tester": "balance-curve",
    "encounters": [
      {
        "id": 1, "floor": 1, "enemy": "Page Flutter", "enemyHpStart": 33,
        "playerHpStart": 100, "playerHpEnd": 86, "playerHpAfterReward": 94,
        "turns": 2, "damageDealt": 33, "damageTakenNet": 14, "goldEarned": 10,
        "damageLog": [
          {"turn": 1, "action": "charge_strike_correct", "dmg": 7, "playerHp": 100, "enemyHp": 26},
          {"turn": 1, "action": "quick_strike", "dmg": 4, "playerHp": 100, "enemyHp": 22},
          {"turn": 1, "action": "enemy_attack", "dmgIn": 14, "playerHp": 86, "enemyHp": 22},
          {"turn": 2, "action": "charge_strike_correct", "dmg": 11, "playerHp": 86, "enemyHp": 11},
          {"turn": 2, "action": "charge_strike_correct", "dmg": 11, "playerHp": 86, "enemyHp": 0}
        ],
        "rewardChoices": ["double_strike", "strike", "expose"],
        "rewardAccepted": "vial_heal+8"
      },
      {
        "id": 2, "floor": 1, "enemy": "Pop Quiz", "enemyHpStart": 41,
        "playerHpStart": 94, "playerHpEnd": 82,
        "turns": 6, "damageDealt": 41, "damageTakenNet": 12, "goldEarned": 10,
        "damageLog": [
          {"turn": 1, "action": "charge_strike_correct", "dmg": 11, "enemyHp": 30},
          {"turn": 1, "action": "quick_block", "block": 4},
          {"turn": 1, "action": "enemy_attack_blocked", "dmgIn": 0, "playerHp": 94, "playerBlock": 3},
          {"turn": 2, "action": "charge_strike_wrong", "dmg": 4, "enemyHp": 26},
          {"turn": 2, "action": "quick_strike", "dmg": 4, "enemyHp": 22},
          {"turn": 2, "action": "enemy_attack", "dmgIn": 12, "playerHp": 82},
          {"turn": 3, "action": "charge_strike_correct", "dmg": 10, "enemyHp": 12},
          {"turn": 3, "action": "quick_block", "block": 4},
          {"turn": 4, "action": "charge_strike_correct", "dmg": 7, "enemyHp": 5},
          {"turn": 4, "action": "quick_strike", "dmg": 4, "enemyHp": 1},
          {"turn": 5, "action": "quick_strike", "dmg": 1, "enemyHp": 0}
        ],
        "rewardChoices": ["transmute", "expose", "quicken"],
        "rewardAccepted": "vial+gold+card"
      },
      {
        "id": 3, "floor": 1, "enemy": "Mold Puff", "enemyHpStart": 40,
        "playerHpStart": 82, "playerHpEnd": 76,
        "turns": 5, "damageDealt": 40, "damageTakenNet": 6, "goldEarned": 10,
        "playerStatusEffects": ["weakness:1", "poison:2-then-4"],
        "damageLog": [
          {"turn": 1, "action": "charge_strike_correct", "dmg": 7, "enemyHp": 33},
          {"turn": 1, "action": "quick_transmute", "dmg": 0},
          {"turn": 1, "action": "enemy_debuff", "applied": "weakness:1"},
          {"turn": 2, "action": "charge_strike_correct_weakened", "dmg": 8, "enemyHp": 25},
          {"turn": 2, "action": "charge_strike_wrong", "dmg": 4, "enemyHp": 21},
          {"turn": 2, "action": "enemy_debuff_poison", "dmgIn": 2, "playerHp": 80},
          {"turn": 3, "action": "charge_strike_correct", "dmg": 10, "enemyHp": 11},
          {"turn": 3, "action": "quick_strike", "dmg": 4, "enemyHp": 7},
          {"turn": 3, "action": "poison_tick", "dmgIn": 4, "playerHp": 76},
          {"turn": 4, "action": "charge_block_misclick", "block": 7},
          {"turn": 4, "action": "quick_strike", "dmg": 4, "enemyHp": 3},
          {"turn": 5, "action": "quick_strike", "dmg": 3, "enemyHp": 0}
        ],
        "rewardChoices": ["unknown"],
        "rewardAccepted": "gold+card"
      }
    ],
    "playerSimulation": {
      "targetAccuracy": 0.7,
      "actualAccuracy": "8 charge correct, 2 charge wrong = 80%",
      "quickPlayRate": "8/22 = 36%"
    }
  }]
}
```

---

## Verdict Rationale

**Verdict: ISSUES** because two HIGH findings (H-1 damage data drift, H-2 charge:quick ratio mismatch) together break the contract that any external tooling can trust `getCombatState` numbers and `action-specs.md` damage formulas. No CRITICAL bugs (no crashes, no soft-locks, no instant deaths), so not FAIL. The MEDIUM findings (M-1, M-2, M-3) are quality-of-life papercuts in the playtest API itself, not gameplay bugs.

The actual combat balance feels mostly OK from a player perspective: 24% HP loss over 3 encounters is healthy, no death spiral, gold pacing reasonable. The only gameplay-feel concern is **S-BC2 Agency** — charging is strictly dominant because the wrong-answer penalty equals a quick play, so there's no actual decision. If quick plays exist as a "safe option" they should be meaningfully better than charge-wrong (e.g. quick = base 5, charge wrong = base 3), or the quiz should be loud enough that "I don't know this" is a real consideration.
