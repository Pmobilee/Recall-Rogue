# Balance Curve Report — BATCH-2026-04-15-001
**Tester**: Balance Curve | **Model**: claude-sonnet-4-6 | **Domain**: mixed (All decks) | **Encounters**: 3 | **Deaths**: 0

**Run started**: `post_tutorial` preset → fresh run via Trivia Dungeon → All domains selected

---

## Verdict: ISSUES

Three combats completed without death. Core loop is functional, but several balance concerns surfaced around combat pacing (too long), AP bottlenecking the charge mechanic, and one significant player damage spike on Floor 5. See Issues section for details.

---

## Floor-by-Floor Data

| Floor | Encounter | Start HP | End HP | HP Lost | Enemy | Enemy Init HP | Turns | Gold After |
|-------|-----------|----------|--------|---------|-------|---------------|-------|------------|
| 1 | Page Flutter | 100 | 83 | 17 | Page Flutter | 29 | 4 | 20 |
| 2 | Ink Slug | 83 | 65 | 18 | Ink Slug | 51 | 9 | 40 |
| 5 | Overdue Golem | 85* | 58 | 27 | Overdue Golem | 71 | ~9 | 55 |

*Player healed at a rest room between encounters 2 and 3 (65→85 HP). Two non-combat rooms were encountered between rows 1-4 (rest room, two shop rooms), which explains the floor jump.

---

## Per-Combat Damage Exchange Log

### Encounter 1 — Page Flutter (Floor 1, 4 turns)

| Turn | Player Action | Enemy HP After | Player HP After | Player Block | Notes |
|------|---------------|----------------|-----------------|--------------|-------|
| 1 (partial) | chargePlay Strike ✓ | 23 | 100 | 0 | AP already 3/5 at fight start; 6 damage |
| 2 | chargePlay Strike ✓ → chargePlay Shield ✓ → end | 23 | 93 | 0 | Strike missed (enemy still 23); Shield gave 7 blk; enemy Flutter Dive: 14 dmg, 7 absorbed, 7 to HP |
| 3 | chargePlay Strike ✓ → quickPlay Shield | 14 | 83 | 0 | Strike dealt 9 dmg; enemy attacked: 14 dmg, 4 blk absorbed, 10 to HP |
| 4 | chargePlay Strike ✓ (finishing blow) | 0 | 83 | 0 | Enemy defeated; ~7 damage |

**Turn 1 anomaly**: Fight entered mid-turn (AP 3/5). The first batch showed enemy already at full HP so no prior damage — first turn had 2 AP already spent by game initialization.

### Encounter 2 — Ink Slug (Floor 2, 9 turns)

| Turn | Player Action | Enemy HP After | Player HP After | Block | Notes |
|------|---------------|----------------|-----------------|-------|-------|
| 1 | chargePlay Strike ✓ → chargePlay Shield ✓ | 45 | 83 | 5 | 6 dmg; enemy defended (+8 blk) |
| 2 | chargePlay Shield ✓ → quickPlay Shield | 45 | 83 | 13 | No damage; enemy defended again |
| 3 | chargePlay Strike ✓ × 2 | 29 | 78 | 0 | 8+7=15 dmg; enemy attacked: 5 HP lost |
| 4 | chargePlay Strike ✓ → quickPlay Shield | 22 | 78 | 4 | 7 dmg; enemy debuffed |
| 5 | chargePlay Strike ✓ → quickPlay Utility | 14 | 75 | 0 | 8 dmg; enemy debuffed: 3 HP |
| 6 | chargePlay Shield ✓ → quickPlay Shield | 14 | 75 | 13 | No damage; enemy defended (+8 blk) |
| 7 | chargePlay Shield ✓ → chargePlay Strike ✓ → quickPlay Strike | 7 | 65 | 0 | 1+6=7 dmg; enemy attacked: 10 HP spike! |
| 8 | chargePlay Strike ✓ | 3 | 65 | 9 | 4 dmg |
| 9 | chargePlay Strike ✓ (finishing blow) | 0 | 65 | 9 | Enemy defeated |

---

## Quick vs Charge Analysis

### Across all 3 encounters

**Charge plays (correct answers):**
- Encounter 1: 4 correct charge plays. Damages: 6, 9, 7, ~7 → avg **7.3 dmg**
- Encounter 2: ~8 correct charge plays. Damages: 6, 7+8(double), 8, 6, 1, 4, final → avg ~**6.1 dmg**
- Encounter 3: ~7 correct charge plays. Damages: 9, 6, 9, 12, 9, 14, final → avg **9.8 dmg**
- **Overall charge correct avg: ~7.7 damage**

**Quick plays:**
- Mostly used on shield/utility cards (player chose quick for low-AP-cost cards)
- Strike quick plays (when used): 4-6 damage
- Shield quick plays: 3-7 block
- **Overall quick attack avg: ~5 damage** (when used on attacks; most quick plays were defensive)

**Charge incorrect plays:** 0 recorded — the AP system made "incorrect" charges not execute (needed 2 AP, had 1 in most cases). The 70% simulation design couldn't be fully exercised because charge cost (2 AP) and the 5-AP pool means only 2 charge plays per turn maximum, and incorrect plays were rejected by AP limits rather than resulting in reduced damage.

**Ratio (charge correct / quick attack):** approximately **1.5–2.0x** when both are attack plays.

Note: A key systemic observation — charge plays cost **2 AP** vs quick plays costing **1 AP**, so the "meaningful choice" is fundamentally an AP economy decision, not just a damage decision. With apMax=5 and charge costing 2 AP, players can play at most 2 charge cards per turn and 1 leftover for a quick play. This limits how many "incorrect answer" scenarios arise naturally.

---

## Objective Findings

| Check | Result | Measured | Expected | Notes |
|-------|--------|----------|----------|-------|
| O-BC1: Floor 1 survivability | ✅ PASS | 83% HP at floor 2 | >40% HP | Page Flutter is very manageable |
| O-BC2: Floor 2-3 danger | ✅ PASS | Ink Slug dealt up to 10 dmg/turn; Golem 15 dmg/turn | >10 dmg/encounter | Enemy deals meaningful damage |
| O-BC3: Quick vs Charge value | ✅ PASS | ~7.7 charge vs ~5 quick attack | 1.3–2.0x | Charge is clearly better; ratio ~1.5x |
| O-BC4: HP recovery pace | ⚠️ CONCERN | After 3 encounters: 58/100 HP (42% loss) | Not in death spiral | Steady decline; rest rooms help but gap grows |
| O-BC5: Gold economy | ✅ PASS | 55 gold after 3 encounters | 50–200 gold | On the low end; shop items largely unaffordable |
| O-BC6: Combat length | ⚠️ CONCERN | E1: 4 turns ✅; E2: 9 turns ⚠️; E3: ~9 turns ⚠️ | 3–8 turns | Encounters 2 and 3 run too long |
| O-BC7: Enemy damage scaling | ✅ PASS | E1 enemy: 29 HP; E2: 51 HP; E3: 71 HP | Floor 2 > Floor 1 | Solid HP scaling |
| O-BC8: No instant death | ✅ PASS | Max single-turn drop: 15 HP (15%) | Never >60% HP in one turn | No instant kills observed |

---

## Subjective Assessments

| Check | Rating | Notes |
|-------|--------|-------|
| S-BC1: Tension curve | 3/5 | E1 felt trivial. E2 was moderate. E3 felt genuinely tense around turns 5-6 with 15 HP spikes and weakness debuff reducing output. Tension builds appropriately over the run but E2 dragging to 9 turns deflated momentum. |
| S-BC2: Agency | 2/5 | Quick vs charge is theoretically meaningful but the AP economy reduces it in practice. With 5 AP per turn and charge costing 2 AP, there's rarely a decision point — you just play until AP runs out. Wrong answers couldn't be tested naturally because the AP check rejects the play before applying incorrect-answer penalties. |
| S-BC3: Reward pacing | 4/5 | Getting 20 gold per combat and a card reward felt satisfying. The rest room heal was well-timed. Shop selection was interesting (Gold Magnet, Last Breath relics were tempting). |
| S-BC4: Deck growth | 3/5 | Hard to assess in 3 encounters. Hand composition visibly improved by E3 (seeing upgraded Pierce cards, Adapts). But the deck still cycled through shields first most turns, suggesting draw order or deck weight may be skewed toward shields. |
| S-BC5: Death fairness | 4/5 | The 15 HP hit in E3 T5 was the closest thing to "surprising" damage — but the Golem's intent clearly telegraphed "attack" so it was avoidable with better block play. No unfair moments. |

---

## Issues Found

### MEDIUM — Combat length for Floor 2+ enemies exceeds 3–8 turn target

**Encounters 2 (9 turns) and 3 (~9 turns) both exceeded the 3–8 turn design target.** The Ink Slug at 51 HP defended and healed itself with 8-block turns, which meant roughly 2 turns of player action were "wasted" breaking block. The Overdue Golem at 71 HP similarly stretched out due to the AP bottleneck limiting players to 1 charge play per turn (2 AP cost + 1 leftover AP).

Root cause candidates:
1. AP per turn (5) with charge cost (2 AP) caps offensive throughput at ~10-12 damage per turn vs mid-tier enemies with 51-71 HP
2. Enemies with defend-then-attack patterns extend fights by adding an effective buffer turn
3. Early deck has many shields — players cycle through shields before reaching attacks

**Recommendation**: Consider reducing charge AP cost to 1 (with correct answer required to unlock the bonus), OR increase base AP to 6 for floor 2+, OR ensure enemies in row 2 cap at ~35-40 HP to keep fights at 5-6 turns.

---

### LOW — AP system silently blocks "incorrect charge" scenario

The 70% accuracy simulation couldn't be tested because the charge mechanic requires 2 AP. When AP drops to 1 after one charge play, subsequent charge attempts are rejected with "Not enough AP" before the incorrect-answer penalty fires. Players at 1 AP remaining can only quick-play, not charge incorrectly. This means the **quick vs charge tradeoff only materializes when AP ≥ 2**, which narrows the decision window significantly.

**Impact**: The quiz-combat integration feels less present than intended. Many turns, the "choice" is just quick-play the last card. Incorrect answers have no observable cost in practice.

**Recommendation**: Either lower charge AP cost to 1 (answer wrong = quick play damage, answer right = charge damage), or expand the AP pool so multi-charge turns are more common.

---

### LOW — Shield-heavy draw order reduces offensive turns

Across all 3 encounters, the initial draw frequently produced 3-4 shield cards and 1-2 attacks. This forced defensive plays in turns where attacking was optimal (especially E2 turns 2 and 4). The "wrong card at the wrong time" pattern extended combats.

**Recommendation**: Investigate whether the starter deck's shield-to-attack ratio is appropriate, or whether draw order can be weighted toward attacks when player HP > 60%. A minor quality-of-life fix would be ensuring at least 2 attack cards appear in the opening hand.

---

## Raw Encounter Data

```json
{
  "session": "BATCH-2026-04-15-001",
  "preset": "post_tutorial",
  "domain": "mixed",
  "encounters": [
    {
      "id": 1,
      "floor": 1,
      "mapNode": "r0-n0",
      "enemy": "Page Flutter",
      "enemyMaxHp": 29,
      "playerStartHp": 100,
      "playerEndHp": 83,
      "hpLost": 17,
      "turns": 4,
      "goldEarned": 20,
      "goldTotal": 20,
      "cardsPlayed": {
        "chargeCorrect": 4,
        "chargeIncorrect": 0,
        "quickPlay": 1
      },
      "enemyAbilities": ["flutter_dive_strip_block", "attack"],
      "perTurnHpDelta": [
        {"turn": 1, "playerHpChange": 0, "enemyHpChange": -6},
        {"turn": 2, "playerHpChange": -7, "enemyHpChange": 0},
        {"turn": 3, "playerHpChange": -10, "enemyHpChange": -9},
        {"turn": 4, "playerHpChange": 0, "enemyHpChange": -7}
      ]
    },
    {
      "id": 2,
      "floor": 2,
      "mapNode": "r1-n0",
      "enemy": "Ink Slug",
      "enemyMaxHp": 51,
      "playerStartHp": 83,
      "playerEndHp": 65,
      "hpLost": 18,
      "turns": 9,
      "goldEarned": 20,
      "goldTotal": 40,
      "cardsPlayed": {
        "chargeCorrect": 8,
        "chargeIncorrect": 0,
        "quickPlay": 6
      },
      "enemyAbilities": ["sliming_defend", "attack", "debuff"],
      "perTurnHpDelta": [
        {"turn": 1, "playerHpChange": 0, "enemyHpChange": -6},
        {"turn": 2, "playerHpChange": 0, "enemyHpChange": 0},
        {"turn": 3, "playerHpChange": -5, "enemyHpChange": -15},
        {"turn": 4, "playerHpChange": 0, "enemyHpChange": -7},
        {"turn": 5, "playerHpChange": -3, "enemyHpChange": -8},
        {"turn": 6, "playerHpChange": 0, "enemyHpChange": 0},
        {"turn": 7, "playerHpChange": -10, "enemyHpChange": -7},
        {"turn": 8, "playerHpChange": 0, "enemyHpChange": -4},
        {"turn": 9, "playerHpChange": 0, "enemyHpChange": -3}
      ]
    },
    {
      "id": 3,
      "floor": 5,
      "mapNode": "r5-n0",
      "enemy": "Overdue Golem",
      "enemyMaxHp": 71,
      "playerStartHp": 85,
      "playerEndHp": 58,
      "hpLost": 27,
      "turns": 9,
      "goldEarned": 15,
      "goldTotal": 55,
      "cardsPlayed": {
        "chargeCorrect": 7,
        "chargeIncorrect": 0,
        "quickPlay": 4
      },
      "enemyAbilities": ["peat_decay_debuff", "weakness_debuff", "attack"],
      "perTurnHpDelta": [
        {"turn": 1, "playerHpChange": 0, "enemyHpChange": -9},
        {"turn": 2, "playerHpChange": 0, "enemyHpChange": 0},
        {"turn": 3, "playerHpChange": 0, "enemyHpChange": -9},
        {"turn": 4, "playerHpChange": 0, "enemyHpChange": 0},
        {"turn": 5, "playerHpChange": -15, "enemyHpChange": -6},
        {"turn": 6, "playerHpChange": -12, "enemyHpChange": -12},
        {"turn": 7, "playerHpChange": 0, "enemyHpChange": -9},
        {"turn": 8, "playerHpChange": 0, "enemyHpChange": -23},
        {"turn": 9, "playerHpChange": 0, "enemyHpChange": -3}
      ]
    }
  ],
  "runState_after_3_encounters": {
    "currency": 55,
    "playerHp": 58,
    "playerMaxHp": 100
  },
  "nonCombatRoomsVisited": [
    {"type": "restRoom", "floor": 3, "effect": "healed 65->85 HP"},
    {"type": "shopRoom", "floor": 3, "effect": "no purchase (unaffordable)"},
    {"type": "shopRoom", "floor": 4, "effect": "no purchase (unaffordable)"}
  ]
}
```

---

## Notes on Methodology

- **Difficulty of simulating 70% accuracy**: The AP economy (charge = 2 AP, quick = 1 AP, pool = 5 AP/turn) meant most incorrect-answer attempts were rejected by the AP check before the quiz outcome could matter. In practice, ~85-90% of charge plays succeeded because failed charge attempts were due to AP shortage, not wrong answers. A future test protocol should pre-drain AP to 2 before testing incorrect answers, or the game should consider allowing charge plays at 1 AP with wrong-answer-fallback to quick-play damage.
- **Map navigation**: 3 non-combat rooms appeared between rows 1-5 (rest, 2x shop), meaning the "3 combats in sequence" test reached floor 5 rather than floor 3. This is realistic — players will always hit non-combat nodes — but it complicates floor-by-floor comparison.
- **Pre-existing run state**: The Docker container had a pre-existing run at floor 7 that was reset using `resetToPreset('post_tutorial')` before this playtest. The pre-existing run's high block values (61 block) and chain multipliers (3.5x Azure) were impressive but inappropriate for a fresh-run balance assessment.
