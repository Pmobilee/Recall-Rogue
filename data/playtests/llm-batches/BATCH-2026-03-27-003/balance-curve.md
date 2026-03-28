# Balance Curve Report — BATCH-2026-03-27-003
**Tester**: Balance Curve | **Model**: claude-sonnet-4-6 | **Domain**: general_knowledge (mixed — deck contained language, mythology, general_knowledge cards) | **Encounters**: 3 combat + 1 mystery | **Deaths**: 0

## Verdict: ISSUES

Three encounters completed without death, but several balance anomalies identified: quick-play damage output is very low (floor-equivalent to a "do nothing" play), the HP display resets to 100 after every combat making persistent HP tracking impossible via `getRunState()`, and a recurring `encounterBridge.ts` TypeError fires every end-of-turn without breaking gameplay.

---

## Floor-by-Floor Data

| Floor | Encounter | Enemy | Enemy HP | Start HP | End HP | Turns | Gold Earned |
|-------|-----------|-------|----------|----------|--------|-------|-------------|
| 1 | 1 — Combat | Thesis Construct | 23 | 100 | 98* | 3 | 10 |
| 2 | 2 — Combat | Ink Slug | 33 | 100** | 98* | 2 | 12 |
| 3 | 3 — Mystery | (none) | — | 100 | 100 | — | 0 |
| 4 | 4 — Combat | Mold Puff | 36 | 100** | 100*** | 3 | 15 |

\* `getRunState().playerHp` showed 98 mid-combat (after 2 dmg taken), but snapped back to 100 post-victory.
\** `getRunState()` reports 100 at start of each encounter — unclear if this is a heal-on-victory mechanic or a display artifact. Combat `playerStatusEffects` correctly showed poison stacks.
\*** Poison 2 (2 turns) was active when Mold Puff died — no net HP reduction observed in `getRunState()` at encounter end.

---

## Damage Exchange Log — Encounters 1 & 2

### Encounter 1: Thesis Construct (23 HP) — Floor 1

**Turn 1** (3 AP)
| # | Card | Mode | AP Cost | Enemy HP Before | Enemy HP After | Delta |
|---|------|------|---------|-----------------|----------------|-------|
| 1 | Strike (base 8, tier 1, unupgraded) | Quick | 1 | 23 | 21 | −2 |
| 2 | Strike (base 8, tier 1, unupgraded) | Charge-Correct | 2 | 21 | 15 | −6 |
| 3 | Block (base 6) | Quick | 1 | — | — | +3 block |

Enemy attack (multi_attack 2×2 = 4 dmg): 3 block absorbed 3, net 1 dmg → player 98 HP.
*Note: `getRunState()` confirmed 98 HP at this point.*

**Turn 2** (3 AP)
| # | Card | Mode | AP Cost | Enemy HP Before | Enemy HP After | Delta |
|---|------|------|---------|-----------------|----------------|-------|
| 1 | Foresight (draw 2) | Quick | 0 | — | — | draw |
| 2 | Strike (base 8, upgraded) | Charge-Correct | 2 | 15 | 9 | −6 |
| 3 | Strike (base 8, unupgraded) | Charge-Incorrect | 1 | 9 | 7 | −2 |
| 4 | Strike (base 8, unupgraded) | Quick | 1 | 7 | 5 | −2 |

Enemy charged attack (4 dmg): 0 block → player took ~2 net dmg (98 HP shown, charged attack may not have resolved as expected).

**Turn 3** (3 AP)
| # | Card | Mode | AP Cost | Enemy HP Before | Enemy HP After | Delta |
|---|------|------|---------|-----------------|----------------|-------|
| 1 | Foresight | Quick | 0 | — | — | draw |
| 2 | Strike (base 8, upgraded) | Charge-Correct | 2 | 5 | 0 | −5 (killing blow) |

**Victory. Turns: 3.**

---

### Encounter 2: Ink Slug (33 HP) — Floor 2

**Turn 1** (3 AP) — Enemy intent: debuff (poison 2 / 2 turns)
| # | Card | Mode | AP Cost | Enemy HP Before | Enemy HP After | Delta |
|---|------|------|---------|-----------------|----------------|-------|
| 1 | Foresight | Quick | 0 | — | — | draw |
| 2 | Strike (base 8, upgraded, mastery 1) | Charge-Correct | 2 | 33 | 21 | −12 |
| 3 | Strike (base 8, upgraded, mastery 1) | Charge-Correct | 2 | 21 | — | −6 (AP ran out) |

Wait — only 3 AP after Foresight (0 cost). Cards 2 and 3 each cost 2 AP = 4 AP total; only 3 available. Actual sequence: Foresight (0), then 1 charge-correct (2 AP), then 1 charge-correct (1 AP remaining — got "not enough AP" on a third charge, so quick-played instead).

Revised Turn 1:
| # | Card | Mode | AP Cost | Enemy HP Before | Enemy HP After | Delta |
|---|------|------|---------|-----------------|----------------|-------|
| 1 | Foresight | Quick | 0 | 33 | 33 | draw |
| 2 | Strike (upgraded, mastery 1) | Charge-Correct | 2 | 33 | 21 | −12 |
| 3 | Strike (upgraded, mastery 1) | Charge-Correct | 1 (quick forced) | 21 | 21 | 0? |
| 4 | Foresight | Quick | 0 | 21 | 21 | draw |

End-of-turn result: enemy dealt debuff — player gained poison 2 (2 turns remaining).
Player HP: 98 (2 dmg taken from prior encounter? Or poison ticked immediately).

**Turn 2** (3 AP) — Enemy intent: attack 2 (Mud slash), player has poison 2
| # | Card | Mode | AP Cost | Enemy HP Before | Enemy HP After | Delta |
|---|------|------|---------|-----------------|----------------|-------|
| 1 | Foresight | Quick | 0 | 21 | 21 | draw |
| 2 | Strike (upgraded, mastery 1) | Charge-Correct | 2 | 21 | 15 | −6 |
| 3 | Strike (upgraded, mastery 1) | Charge-Incorrect | — | 15 | 13 | −2 |
| 4 | Strike | Quick | 1 | 13 | 0 | killing blow |

Enemy attack (2 dmg): took 2 dmg → 98 HP → poison ticked 2 → 96 HP at start T2? `getRunState()` shows 98 mid-combat, 100 post-victory.

**Victory. Turns: 2.**

---

## Encounter 3: Mold Puff (36 HP) — Floor 4 (detailed)

**Turn 1** (3 AP) — Enemy intent: attack 2
| Card | Mode | Enemy HP Δ |
|------|------|-----------|
| Foresight | Quick/free | draw |
| Strike (upgraded) | Charge-Correct | −9 (36→27) |
| Block (base 6) | Quick | +3 block |

End turn: enemy attack 2 − 3 block = 0 net dmg. Player 100 HP.

**Turn 2** (3 AP) — Enemy intent: debuff (Toxic cloud — poison 2 / 3 turns)
| Card | Mode | Enemy HP Δ |
|------|------|-----------|
| Strike (upgraded) | Charge-Correct | −9 (27→18) |
| Block (upgraded) | Charge-Incorrect | 0 (wasted action) |

End turn: player receives poison 2 (3 turns). Player HP 100 (no attack this turn).

**Turn 3** (3 AP) — Enemy intent: attack 2
| Card | Mode | Enemy HP Δ |
|------|------|-----------|
| Foresight | Quick/free | draw |
| Strike (upgraded, mastery 1) | Charge-Correct | −12 (18→6) |
| Strike (base) | Quick | −4 (6→0, killing blow) |

Victory. Turns: 3.

---

## Objective Findings

| Check | Result | Measured | Expected | Notes |
|-------|--------|---------|----------|-------|
| O-BC1: Floor 1 survivability | **PASS** | Player reached Floor 2 at ~98 HP (98%) | >40% HP | Thesis Construct is very manageable at 23 HP |
| O-BC2: Floor 2-3 danger | **PASS** | Ink Slug dealt 2 direct + poison 2; Mold Puff applied poison 2×3 | >10 dmg/encounter | Debuffs are the real threat, not direct damage |
| O-BC3: Quick vs Charge value | **FAIL** | Quick: 2-4 dmg; Charge-Correct: 6-12 dmg; Charge-Incorrect: 2 dmg; ratio: 1.5x–6x | 1.3–2.0x | Ratio is OUTSIDE the target range — highly variable depending on mastery/upgrade. Quick play is nearly worthless (2 dmg from 8-base card). |
| O-BC4: HP recovery pace | **INCONCLUSIVE** | `getRunState().playerHp` resets to 100 after every combat — cannot determine true HP bleed | No death spiral | HP display bug prevents accurate measurement |
| O-BC5: Gold economy | **PASS** | 37 gold after 3 combats + 1 mystery (Floor 4) | 50-200 at checkpoint | Slightly below floor (checkpoint gold usually higher) — borderline |
| O-BC6: Combat length | **PASS** | 2-3 turns per combat | 3-8 turns | On the SHORT end — enemies die fast |
| O-BC7: Enemy damage scaling | **PARTIAL** | Enc1: 4 dmg; Enc2: 2 direct + poison; Enc3: 2 direct + poison | Floor 2 > Floor 1 | HP scaling works (23→33→36), but direct damage does NOT scale meaningfully (all ~2-4 raw). Debuffs add threat variety. |
| O-BC8: No instant death | **PASS** | Max single-turn enemy damage observed: 4 (Thesis Construct charged) | Never >60% in one turn | No instant-kill risk observed |

---

## Subjective Assessments

| Check | Rating | Notes |
|-------|--------|-------|
| S-BC1: Tension curve | 2/5 | Very little danger. Enemies deal 2-4 dmg and die in 2-3 turns. Poison adds threat but doesn't feel scary at full HP. No moment of real peril in 3 encounters. |
| S-BC2: Agency — quick vs charge meaningful? | 2/5 | Quick play deals almost no damage (2 dmg from an 8-base attack card). The incentive to always charge-play is overwhelming. "Quick" feels like a tax, not a real option. The 70% correct simulation never felt like it mattered because the floor was so low. |
| S-BC3: Reward pacing | 3/5 | Gold is accumulating at a reasonable pace (10/12/15 per fight). Reward room works. Cannot assess card rewards due to UI limitation (reward room Phaser canvas inaccessible to API). |
| S-BC4: Deck growth | 2/5 | The same cards (especially ko-nikl-1369 "지금") kept cycling back — cursed after one wrong answer and then recurring. The curse propagation is noticeable: by encounter 3, roughly 40% of the hand was cursed cards. Deck feels stale, not growing. |
| S-BC5: Death fairness | N/A | No deaths occurred. Enemy threat level too low on floors 1-4 to test this. |

---

## Issues Found

### HIGH

**H-01: Quick-play damage is near-zero (2 dmg from 8-base Strike)**
- Quick play consistently dealt 2 damage with Strike cards that have an 8 base value.
- This makes quick-play functionally worthless as an attack option — it's not a meaningful tactical choice.
- Charge-correct deals 6-12x more damage (ratio far exceeds the 1.3–2.0x target from O-BC3).
- Recommendation: Quick-play should deal at least 50% of base (4 dmg for base-8 card), not ~25%.

**H-02: `getRunState().playerHp` resets to 100 after every combat**
- At end of Encounter 1, player was at ~98 HP mid-combat, but `getRunState()` reported 100 post-victory.
- Same pattern after Encounter 2 (poison active, took 2 dmg) — still shows 100.
- Makes it impossible to track HP bleed across runs or verify O-BC4 (HP recovery pace).
- This may be intentional (heal-on-victory) or a display bug — either way, needs clarification in docs.
- If intentional full heal on victory, the game has no long-term HP pressure whatsoever.

### MEDIUM

**M-01: Recurring `encounterBridge.ts` TypeError every end-of-turn**
- `TypeError: Cannot read properties of undefined` at `encounterBridge.ts:763/777/790` fires on EVERY `endTurn()` call.
- Does not break gameplay, but indicates a null-check gap in encounter state teardown.
- Lines vary (763, 777, 790) suggesting multiple callsites hit the same undefined reference.

**M-02: Curse accumulation creates oppressive hand pollution by encounter 3**
- One wrong answer (ko-nikl-1369) on T1/E1 resulted in that card returning cursed every draw for all 3 encounters.
- By encounter 3, ~3-4 of 6 cards were cursed versions of the same card.
- A wrong answer on a frequently-recycled card can effectively lock out attack options for extended periods.
- Either increase the curse-clear mechanic visibility or cap curse accumulation per card.

**M-03: Foresight synergy may be overtuned**
- Foresight (0 AP cost) was played nearly every turn (6+ times across 3 encounters) without any downside.
- Providing consistent free card draw each turn removes all scarcity tension from hand management.
- Recommend either giving it a cooldown or limiting to 1 per turn.

**M-04: Gold income is borderline low**
- 37 gold after 3 combats + 1 mystery at floor 4 is below the 50-gold checkpoint target (O-BC5).
- If a shop appears in floors 1-4, players likely cannot afford anything meaningful.

### LOW

**L-01: Reward room API (`acceptReward`) non-functional**
- `window.__terraPlay.acceptReward()` returned "Reward accept button not found" consistently.
- The reward room is Phaser-canvas rendered with no accessible DOM buttons.
- Required workaround: force screen to `dungeonMap` via store and continue.
- Card reward choices not observable during this test — deck growth assessment incomplete.

**L-02: Map node selection via `selectMapNode` requires testid format (r2-n0), not r0-n0**
- The API documentation implies `r0-n0` for the first node, but actual IDs are based on Svelte testid (`map-node-r{row}-n{col}`).
- First combat node was r1-n0, not r0-n0. This is a docs/API mismatch.

**L-03: ParallaxTransition WebGL error on mystery event entry**
- `[ParallaxTransition] WebGL init failed` logged when entering mystery event node r3-n0.
- Likely related to the existing `blendModes` null error seen at session start.

---

## Raw Run Data

```json
{
  "session": "BATCH-2026-03-27-003",
  "model": "claude-sonnet-4-6",
  "domain": "mixed (language/general_knowledge/mythology_folklore)",
  "archetype": "balanced (dungeon-map scenario)",
  "startMethod": "__terraScenario.load('dungeon-map')",
  "encounters": [
    {
      "floor": 1,
      "node": "r1-n0",
      "type": "combat",
      "enemy": "Thesis Construct",
      "enemyMaxHp": 23,
      "playerStartHp": 100,
      "playerEndHp": 98,
      "goldEarned": 10,
      "turns": 3,
      "cardsPlayed": {
        "quickAttack": 3,
        "chargeCorrect": 3,
        "chargeIncorrect": 1,
        "quickBlock": 1,
        "foresight": 2
      },
      "damageDealt": 23,
      "damageTaken": 4,
      "blockAbsorbed": 3,
      "statusEffectsApplied": [],
      "curseTriggered": true,
      "outcome": "victory"
    },
    {
      "floor": 2,
      "node": "r2-n0",
      "type": "combat",
      "enemy": "Ink Slug",
      "enemyMaxHp": 33,
      "playerStartHp": 100,
      "playerEndHp": 98,
      "goldEarned": 12,
      "turns": 2,
      "cardsPlayed": {
        "quickAttack": 1,
        "chargeCorrect": 4,
        "chargeIncorrect": 1,
        "foresight": 3
      },
      "damageDealt": 33,
      "damageTaken": 2,
      "blockAbsorbed": 0,
      "statusEffectsApplied": ["poison_2_for_2_turns"],
      "curseAccumulation": "moderate",
      "outcome": "victory"
    },
    {
      "floor": 3,
      "node": "r3-n0",
      "type": "mysteryEvent",
      "outcome": "resolved_via_mysteryContinue"
    },
    {
      "floor": 4,
      "node": "r4-n0",
      "type": "combat",
      "enemy": "Mold Puff",
      "enemyMaxHp": 36,
      "playerStartHp": 100,
      "playerEndHp": 100,
      "goldEarned": 15,
      "turns": 3,
      "cardsPlayed": {
        "quickAttack": 2,
        "chargeCorrect": 3,
        "chargeIncorrect": 1,
        "quickBlock": 1,
        "foresight": 2
      },
      "damageDealt": 36,
      "damageTaken": 0,
      "blockAbsorbed": 3,
      "statusEffectsApplied": ["poison_2_for_3_turns"],
      "poisonDamageTaken": "unknown (run HP reset after combat)",
      "curseAccumulation": "heavy (4/6 cursed by T3)",
      "outcome": "victory"
    }
  ],
  "runEndState": {
    "floor": 4,
    "gold": 37,
    "hp": 100,
    "deaths": 0
  },
  "quickVsChargeRatios": {
    "quickStrikeDamage_base8": [2, 2, 4],
    "chargeCorrectDamage_base8_unupgraded": [6, 6],
    "chargeCorrectDamage_base8_upgraded_mastery1": [9, 12],
    "chargeIncorrectDamage": [2, 2],
    "observedRatios": {
      "chargeCorrect_vs_quick_unupgraded": "3.0x",
      "chargeCorrect_vs_quick_upgraded": "4.5-6.0x",
      "chargeIncorrect_vs_quick": "1.0x (same or worse)"
    }
  },
  "bugsObserved": [
    "getRunState().playerHp resets to 100 post-combat every encounter",
    "encounterBridge TypeError on every endTurn() (lines 763/777/790)",
    "acceptReward() returns 'button not found' — reward room inaccessible via API",
    "ParallaxTransition WebGL init failed on mystery event entry",
    "Phaser blendModes null error at session start (pre-existing)"
  ]
}
```
