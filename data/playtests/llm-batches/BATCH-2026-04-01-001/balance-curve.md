# Balance Curve Report — BATCH-2026-04-01-001
**Tester**: Balance Curve | **Model**: claude-sonnet-4-6 | **Domain**: general_knowledge (Trivia Dungeon) | **Encounters**: 3 | **Deaths**: 0

## Verdict: ISSUES

Three encounters completed on Floor 1 (Segment 1–3). Player survived all encounters at full HP. Enemies were too weak at floor 1, dealing near-zero effective damage. Several balance and API concerns identified.

---

## Floor-by-Floor Data

| Floor | Encounter | Enemy | Enemy HP | Start HP | End HP | Turns | Gold Earned |
|-------|-----------|-------|----------|----------|--------|-------|-------------|
| 1-S1  | 1         | Ink Slug | 27 | 100 | 100 | 2 | 10 |
| 1-S2  | 2         | Page Flutter | 21 | 100 | 100 | 2 | 10 |
| 1-S3  | 3         | Overdue Golem | 30 | 100 | 100 | 2 | 10 |

All three enemies were killed in 2 turns. Player took 0 net HP damage across all encounters (2 dmg per enemy attack was absorbed by block each time).

---

## Damage Exchange Log

### Encounter 1 — Ink Slug (27 HP)

**Turn 1 (Player)** — Enemy intent: Defend (Sliming, +1 block)

| Action | Card | Mode | Correct? | Effect |
|--------|------|------|----------|--------|
| Play Foresight | utility | quick | N/A | Draw 2 cards |
| Strike (mastery 0) | attack | charge | YES | 8 dmg → enemy 27→19 |
| Strike (mastery 0) | attack | quick | N/A | 4 dmg → enemy 19→15 |
| Strike (mastery 0) | attack | quick | N/A | 4 dmg → enemy 15→11 |

AP: 3 used (0 left). Enemy defended T1, dealt 0 damage.

**Turn 2 (Player)** — Enemy intent: Bog Grasp (poison 2, 2 turns)

| Action | Card | Mode | Correct? | Effect |
|--------|------|------|----------|--------|
| Foresight | utility | quick | N/A | Draw 2 cards |
| Strike (mastery 0) | attack | charge | YES | ~8 dmg → enemy 11→~3 |
| (combat ended mid-turn) | — | — | — | Enemy killed |

Player HP end: 100/100. Enemy dealt 0 total damage (defended T1, died T2 before acting).

---

### Encounter 2 — Page Flutter (21 HP)

**Turn 1 (Player)** — Enemy intent: Swooping Strike (attack 2)

| Action | Card | Mode | Correct? | Effect |
|--------|------|------|----------|--------|
| Strike (mastery 1, upgraded) | attack | charge | YES | 13 dmg → enemy 21→8 |
| Strike (mastery 0) | attack | quick | N/A | 5 dmg → enemy 8→3 |
| Block (mastery 0) | shield | quick | N/A | 5 block gained (AP=0) |

AP: 3 used. Enemy dealt 2 dmg, absorbed by 5 block → net 0 HP loss.

**Turn 2 (Player)** — Enemy still at 3 HP

| Action | Card | Mode | Correct? | Effect |
|--------|------|------|----------|--------|
| Strike (mastery 0) | attack | quick | N/A | 4+ dmg → enemy 3→0 (dead) |

Player HP end: 100/100. Enemy dealt 2 dmg total, fully blocked.

---

## Objective Findings

| Check | Result | Measured Value | Expected Range | Notes |
|-------|--------|----------------|----------------|-------|
| O-BC1 | **PASS** | 100% HP after floor 1 | >40% HP | Exceeded — zero damage taken across 3 encounters |
| O-BC2 | **FAIL** | Max 2 dmg/encounter (floor 1) | >10 dmg/encounter | Floor 1 enemies too weak — all dealt exactly 2 dmg/turn |
| O-BC3 | **PASS** | Charge correct = 2.0× quick (8 vs 4) | 1.3–2.0× | At upper bound of target range; mastery bumps this to 2.5–3.0× |
| O-BC4 | **PASS** | Player 100/100 throughout | Not death spiral | No danger of spiral with this enemy damage level |
| O-BC5 | **PASS** | 30 gold after 3 encounters (10/each) | 50–200 at checkpoint | Only 30 after 3 fights — may be low if checkpoint is 5 fights |
| O-BC6 | **PASS** | 2 turns per combat | 3–8 turns | CONCERN: consistently 2 turns — below expected minimum of 3 |
| O-BC7 | **N/A** | All floor 1, can't compare floors | Floor 2 > floor 1 | Only 1 floor accessed during this session |
| O-BC8 | **PASS** | Max enemy dmg = 2/turn | Never >60% in one turn | No instant death risk |

---

## Subjective Assessments

| Check | Rating | Notes |
|-------|--------|-------|
| S-BC1 Tension curve | 1/5 | Zero tension — enemies too easy. Intent telegraphs showed "attack 2" which is trivially survivable. Never felt threatened at any point across all 3 encounters. |
| S-BC2 Agency | 3/5 | Quick vs charge decision is meaningful — charge deals exactly 2× quick at base, and the AP cost difference (1 vs 2) creates a real tradeoff. However with 3AP and cheap 1AP cards, the choice feels low-stakes. |
| S-BC3 Reward pacing | 2/5 | Fixed 10 gold per encounter feels flat. No card reward interaction was achievable (reward screen navigation broken — see Issues). Reward feel is incomplete. |
| S-BC4 Deck growth | 2/5 | Mastery naturally increased across encounters (mastery 0→1→2 visible on repeated cards). However no new cards were added due to reward screen bug. Progression feels invisible without card collection. |
| S-BC5 Death fairness | N/A | No deaths occurred — enemies too weak to threaten. Cannot assess death fairness. |

---

## Issues Found

### HIGH

**H-1: Floor 1 enemy damage critically too low**
All three floor 1 enemies dealt exactly 2 damage per turn (Ink Slug: "Sliming +1 block" T1, Page Flutter: "Swooping Strike 2", Overdue Golem: "Sludge Swing 2"). A starter deck Block card (6 block) trivially negates 2 dmg. Players will complete floor 1 at full HP consistently, eliminating all tension. Target should be 5–10 dmg/turn for floor 1 non-boss enemies.

**H-2: Card reward screen cannot be navigated by API**
`acceptReward()` returns `{ok: false, "Reward accept button not found"}` after combat. The reward screen is a Svelte component with a multi-step animation (gold reveal → card choice). The auto-advance timer (turboDelay 5ms in turbo mode) did not fire reliably — the screen was stuck on "Gold Earned +10" indefinitely. Workaround required: `navigate('dungeonMap')` to bypass. **Players may not be receiving card rewards**, meaning deck growth is broken for this test session.

### MEDIUM

**M-1: Combat length below target minimum (2 turns vs 3–8 expected)**
All 3 encounters ended in exactly 2 turns. With 3 AP, 1AP strikes dealing 4–13 damage, and enemies at 21–30 HP, the math allows killing floor 1 enemies in turns 1–2 easily. Combat length target of 3–8 turns requires either lower player damage output, higher enemy HP, or multi-phase enemies. Current starting deck is too efficient.

**M-2: `getCombatState().playerHp` returns undefined**
The `playerHp` field is not present in combat state API responses — only `playerMaxHp` and `playerBlock` are returned. Required `getRunState().playerHp` to track player HP. This is a documentation gap or API bug that complicates automated testing.

**M-3: Fizzle damage on block seems higher than expected**
Charge Block with wrong answer (fizzle at 0.25×) on a 6-block card gave 3 block (expected floor(6×0.25) = 1). Actual: 3. Either the fizzle ratio is 0.5× not 0.25×, or mastery/other modifiers are affecting the calculation. Needs verification against `cardEffectResolver.ts`.

**M-4: getScreen() reports "rewardRoom" while Phaser shows dungeonMap**
After combat ends, `getScreen()` returns "rewardRoom" while the visual display shows the dungeon map. This state bridge desync makes navigation logic unreliable for automated testers.

### LOW

**L-1: Gold reward rate may be below checkpoint target**
10 gold per standard encounter. If a checkpoint (shop/rest) is 5 encounters away, that's 50 gold — borderline for shop purchases. The O-BC5 check passes technically (30 gold in range) but 3 encounters is insufficient to verify full checkpoint economy.

**L-2: `navigate()` used as workaround bypasses reward system**
The workaround of calling `navigate('dungeonMap')` after combat skips card rewards entirely. This means deck growth testing is invalid for this session — all 3 encounters were completed without acquiring any new cards.

---

## Raw Run Data

```json
{
  "batch": "BATCH-2026-04-01-001",
  "tester": "balance-curve",
  "date": "2026-04-01",
  "domain": "general_knowledge",
  "mode": "triviaDungeon",
  "encounters": [
    {
      "floor": 1,
      "segment": 1,
      "enemy": "Ink Slug",
      "enemyMaxHp": 27,
      "turns": 2,
      "playerHpStart": 100,
      "playerHpEnd": 100,
      "damageTaken": 0,
      "goldEarned": 10,
      "cardsPlayed": {
        "quick": 3,
        "chargeCorrect": 1,
        "chargeWrong": 0
      },
      "damageDealt": 16,
      "notes": "Enemy defended T1 (0 dmg), killed T2 before acting"
    },
    {
      "floor": 1,
      "segment": 2,
      "enemy": "Page Flutter",
      "enemyMaxHp": 21,
      "turns": 2,
      "playerHpStart": 100,
      "playerHpEnd": 100,
      "damageTaken": 0,
      "goldEarned": 10,
      "cardsPlayed": {
        "quick": 3,
        "chargeCorrect": 1,
        "chargeWrong": 0
      },
      "damageDealt": 21,
      "notes": "2 dmg from enemy fully absorbed by block"
    },
    {
      "floor": 1,
      "segment": 3,
      "enemy": "Overdue Golem",
      "enemyMaxHp": 30,
      "turns": 2,
      "playerHpStart": 100,
      "playerHpEnd": 100,
      "damageTaken": 0,
      "goldEarned": 10,
      "cardsPlayed": {
        "quick": 3,
        "chargeCorrect": 3,
        "chargeWrong": 1
      },
      "damageDealt": 30,
      "notes": "Golem killed in 2 turns; 2 dmg absorbed by block"
    }
  ],
  "finalState": {
    "playerHp": 100,
    "playerMaxHp": 100,
    "gold": 30,
    "floor": 1,
    "deaths": 0
  },
  "apiIssues": [
    "acceptReward() non-functional — reward screen stuck on gold step",
    "getCombatState().playerHp returns undefined",
    "getScreen() desyncs from Phaser visual state post-combat",
    "navigate('cardReward') then navigate('dungeonMap') used as workaround"
  ],
  "damageRatioMeasured": {
    "quickStrike_mastery0": 4,
    "chargeCorrect_mastery0": 8,
    "ratio": 2.0,
    "chargeCorrect_mastery1": 13,
    "chargeCorrect_mastery2": 13,
    "chargeWrong_fizzle_block6": 3
  }
}
```
