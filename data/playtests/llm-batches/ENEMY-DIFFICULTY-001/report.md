# Enemy Difficulty Report — ENEMY-DIFFICULTY-001

**Date:** 2026-03-28
**Method:** Live Playwright combat via `__terraPlay` API + `__terraScenario` scenario loader
**Tester:** Claude Sonnet 4.6 (automated LLM playtest)
**Note on damage:** `quickPlayCard()` deals 50% of base card damage (quick-play mode, no quiz answered). All HP loss figures reflect enemy attacks received. Damage dealt to enemies is half of what a real player scoring correctly would deal.

---

## Run Summary

- **Scenarios tested:** 7 (combat-basic ×2, combat-elite, combat-mini-boss, combat-boss, combat-scholar, combat-near-death, combat-low-hp)
- **Enemies encountered:** Page Flutter (common), The Final Lesson (boss), The Peer Reviewer (mini-boss), The Algorithm (boss), The Omnibus (boss), Ink Slug (from prior Opus run)
- **Player HP range across encounters:** 11–100 HP remaining post-combat
- **Most dangerous single encounter:** The Peer Reviewer (mini-boss) — 40 HP lost
- **Easiest encounter:** Page Flutter / The Omnibus (0 HP lost in scholar scenario)

---

## Encounter Timeline Table

| # | Scenario | Enemy | Category | Enemy HP | Turns | Player HP Lost | Intent Pattern | Notes |
|---|----------|-------|----------|----------|-------|----------------|----------------|-------|
| 1 | combat-basic (manual) | Page Flutter | common | 21 | ~3 | 0 | defend→attack→defend | Killed over 3 turns, no damage taken |
| 2 | combat-basic (runner) | Page Flutter | common | 17 | 4 | 0 | defend→attack→defend | Runner hit turn cap; combat ended via endTurn. 0 dmg |
| 3 | combat-elite | The Final Lesson | boss | 68 | 6 | 14 | multi_attack(2)→attack(2)→attack(2)→attack(2) | 6 turns, 14 HP lost. Loop capped at 6 |
| 4 | combat-mini-boss | The Peer Reviewer | mini-boss | 25 | 3 | 40 | attack(2)→buff(3) | buff(strength+1) before big attacks; 40 HP lost in 3 turns |
| 5 | combat-boss | The Algorithm | boss | 48 | 4 | 42 | attack(2)→attack(2)→heal(10) | Self-healed at turn 3; player at 100 through turn 3, then 42 dmg spike |
| 6 | combat-scholar | The Omnibus | boss | 68 | 6 | 0 | attack(2)×4→defend(2) | Scholar archetype handled this boss cleanly; 0 damage taken |
| 7 | combat-near-death | Page Flutter | common | 20 | 3 | 89* | defend(1)→attack(2) | *Scenario starts with special deck (Lifetap cards); 89 HP lost misleading — pre-existing HP loss |
| 8 | combat-low-hp | Page Flutter | common | 20 | 3 | 85* | attack(2)→buff(2) | *Same caveat — low-hp scenario uses self-damaging deck; HP drain not purely enemy-caused |

*HP loss in near-death and low-hp scenarios is inflated by self-damage mechanics (Lifetap cards confirmed in console log).

---

## Difficulty Curve Analysis

### HP Scaling (base vs. observed)
From the enemy data file (`src/data/enemies.ts`), base HP values before floor scaling:

| Enemy | Category | baseHP | Observed HP (floor ~1) | HP Archetype |
|-------|----------|--------|----------------------|--------------|
| Page Flutter | common | 5 | 17–21 | standard |
| Thesis Construct | common | 5 | — | standard |
| Mold Puff | common | 7 | — | tanky |
| The Crib Sheet | common | 4 | — | glass |
| Ink Slug | common | 7 | 36 (prior run, floor unknown) | glass |
| The Bookwyrm | elite | 7 | — | glass |
| The Peer Reviewer | mini-boss | 11 | 25 | — |
| The Final Lesson | boss | 17 | 68 | — |
| The Algorithm | boss | 12 | 48 | — |
| The Omnibus | boss | 19 | 68 | — |

### Observed Difficulty Curve

```
Floor 1 commons: Page Flutter      ~17-21 HP   Easy    (0 HP lost)
                 Ink Slug           ~36 HP      Easy    (2 HP lost, Opus agent)
Mini-boss:       The Peer Reviewer  ~25 HP      HARD    (40 HP lost — buff spike)
Boss:            The Algorithm      ~48 HP      HARD    (42 HP lost — heal + atk)
Boss:            The Final Lesson   ~68 HP      Medium  (14 HP lost — steady atk)
Boss:            The Omnibus        ~68 HP      Easy    (0 HP lost — scholar counters)
```

### Key Observations

1. **Mini-boss is currently harder than most bosses** — The Peer Reviewer (25 HP) dealt more damage per turn than The Algorithm (48 HP) or The Final Lesson (68 HP). The `buff(strength+1)` on turn 2 followed by attacks causes a sudden damage spike that is hard to outrace with a basic deck.

2. **Heal mechanic on The Algorithm is threatening** — heal(10) at turn 3 extended the fight and the subsequent attacks landed for 42 total. With quick-play at half damage, this fight took 4 turns; at full damage it would be ~2 turns, but the heal timing means a player who can't burst it down quickly will take heavy punishment.

3. **Scholar archetype is disproportionately strong vs The Omnibus** — The Omnibus (68 HP) was defeated with 0 HP lost in 6 turns. The scholar scenario deck has excellent block cards that negate this boss entirely. This may indicate The Omnibus is designed for non-scholar archetypes and is trivial for scholars.

4. **Page Flutter is appropriately tuned** — Consistent 0 HP loss across multiple runs. Good "tutorial" difficulty. The buff(strength) variant occasionally appears but doesn't meaningfully threaten with a standard deck.

5. **HP scaling from baseHP appears to use a ~3.4× multiplier at floor 1** — Page Flutter baseHP 5 → observed 17–21; The Algorithm baseHP 12 → observed 48. This is consistent floor scaling.

---

## Hardest Encounters

1. **The Peer Reviewer (mini-boss, 25 HP)** — 40 HP lost in 3 turns. The buff(strength) on turn 2 compounds every subsequent attack. Players who can't kill it in 1–2 turns face escalating damage.

2. **The Algorithm (boss, 48 HP)** — 42 HP lost. The heal(10)/heal(8) intents are the biggest threat — if the player can't deal burst damage, this boss recovers and extends the fight into dangerous territory. The final-turn damage burst of 42 suggests the boss has high-damage multi-attack intents that punish slow play.

3. **The Final Lesson (boss, 68 HP)** — 14 HP lost across 6 turns. Steady multi_attack(2) damage is consistent but manageable. Less threatening than the mini-boss despite higher HP.

---

## Easiest Encounters

1. **Page Flutter (common, 17–21 HP)** — 0 HP lost in every test. Appropriate early-game enemy.

2. **The Omnibus (boss, 68 HP) vs Scholar deck** — 0 HP lost. This may be an archetype-specific anomaly.

3. **Ink Slug (common, 36 HP, from prior Opus run)** — 2 HP lost in 2 turns. Very manageable.

---

## Top 3 Balance Concerns

### 1. The Peer Reviewer (mini-boss) deals too much damage per HP

**Evidence:** 40 HP lost against a 25 HP enemy that died in 3 turns. This is more damage per-turn than either boss tested (The Algorithm: 42 HP in 4 turns; The Final Lesson: 14 HP in 6 turns). Mini-bosses should be harder than commons but should not out-damage bosses.

**Root cause:** The `buff(strength+1, 2 turns)` intent fires early and then all subsequent `attack(2)` intents land as `attack(3+)`. With only 3 AP per turn and a basic deck, players can't kill it fast enough.

**Recommendation:** Either reduce the Peer Reviewer's strength buff duration to 1 turn, reduce its attack weight after buffing, or increase its HP to give players more time to respond to the buff.

---

### 2. The Algorithm's heal-then-burst pattern is punishing at expected kill speed

**Evidence:** heal(10) fired at turn 3 when enemy was at ~12 HP (based on snapshots), extending the fight. Then 42 HP of damage landed. Player HP was 100 going into turn 4 end — all damage came in a single endTurn call, suggesting multi_attack or charge intent.

**Root cause:** The Algorithm has `multi_attack(value:2, hitCount:4)` and `heal(10)` in its pool. If the heal fires at low HP, it survives to fire a multi-hit next turn. At quick-play damage (half), the kill window is narrow.

**Recommendation:** Consider making the heal intent weight lower (currently 1/8 of pool), or cap heal to not exceed a threshold HP% (e.g., won't heal if below 25% HP). Alternatively, flag it as a reward trade-off — the heal is meant to punish slow players — and ensure the pre-boss rest site is reliably accessible.

---

### 3. Scholar archetype trivializes The Omnibus boss

**Evidence:** 0 HP lost against a 68 HP boss over 6 turns. The scholar scenario deck has strong block cards that negate all attack damage from The Omnibus.

**Root cause:** The Omnibus `intentPool` is predominantly `attack(2)` (weight: 35) with `defend` and `multi_attack` secondaries. The scholar deck's block generation outpaces this entirely.

**Recommendation:** Give The Omnibus access to debuff/weakness intents that reduce player block effectiveness, or add a `bypass_block` mechanic to at least one of its signature moves. Alternatively, this may be intentional — bosses are meant to be easier for the "correct" counter archetype — in which case ensure other archetypes have an equivalent easy matchup.

---

## Top 3 Things That Feel Good

### 1. Quick-play flow is smooth and combat is responsive

The `quickPlayCard()` → `endTurn()` loop felt snappy. Animations fire correctly (confirmed via console: WeaponAnim sword slash, shield raise), cards shift off the hand cleanly, and the state reads back accurately. No stalls or stuck states encountered across 8 combat runs.

### 2. Enemy intent telegraphing is clear and varied

The intent labels are readable and flavor-appropriate: "Wing cover" (Page Flutter defend), "Academic rigor" (Peer Reviewer buff), "Self-repair" / "Backup restore" (Algorithm heal), "Tome slam" (Omnibus attack). The variety of intent types per enemy (attack, defend, buff, heal, multi_attack, charge) gives each enemy a distinct feel even at the data-structure level.

### 3. Floor scaling produces appropriate HP spread

Page Flutter at ~17–21 HP lands in exactly the right range for a first-floor common — killable in 2–3 turns without being trivial. The 3–4× multiplier from baseHP is working as intended and creates a clean early-game experience. The progression from commons (17–36 HP) to bosses (48–68 HP) is a good curve.

---

## Additional Enemy Roster (from src/data/enemies.ts)

For reference — enemies not yet playtested:

| Enemy | Category | baseHP | Notable Mechanic |
|-------|----------|--------|-----------------|
| Thesis Construct | common | 5 | charge(4) bypass-damage-cap |
| Mold Puff | common | 7 | poison debuff |
| The Crib Sheet | common | 4 | multi_attack(3 hits) + vulnerable |
| The Bookwyrm | elite | 7 | charge(5) + multi_attack(3) + vulnerable |
| The Final Exam | boss | 17 | charge(6) + multi_attack(4) + weakness |
| The Burning Deadline | boss | 17 | poison(3–4 stacks) + strength buff |
| The Curriculum | boss | 16 | heal(8) + multi_attack(3–4) |
| The Group Project | boss | 14 | poison(3–4) + multi_attack(4) |
| The Rabbit Hole | boss | 19 | vulnerable + weakness double-debuff |
| The Tenure Guardian | mini-boss | 8 | strength buff |
| The Plagiarist | mini-boss | 7 | — |
| The Proctor | mini-boss | 9 | strength buff |
| The Grade Dragon | mini-boss | 8 | — |
| The Comparison Trap | mini-boss | 8 | — |
| Ink Slug | common | 7 | — |
| Bookmark Vine | common | 7 | — |
| Staple Bug | common | 4 | — |
| Margin Gremlin | common | 4 | — |
| Index Weaver | common | 6 | — |
| Overdue Golem | common | 7 | — |
| Pop Quiz | common | 4 | — |
| Eraser Worm | common | 4 | — |
| The Librarian | elite | 12 | — |
| The Crambot | common | 5 | — |
| The All-Nighter | common | 5 | — |
| The Card Catalogue | mini-boss | 8 | — |
| The Headmistress | mini-boss | 8 | — |
| The Tutor | mini-boss | 8 | — |
| The Study Group | mini-boss | 8 | — |

---

## Methodology Notes

- All combat used `quickPlayCard()` (50% damage, no quiz). A real player answering quizzes correctly would deal 2× damage, halving all turn counts.
- `playerHp` is not reliably read from `getCombatState()` in the current API (returns undefined); `getRunState().playerHp` was used as the source of truth.
- The `victory` flag in this report tracks whether the loop detected a non-combat screen mid-loop; most "victory=false" entries actually ended in victory via `endTurn` triggering the transition — the loop logic didn't catch it before `getRunState()` already reflected post-combat HP.
- HP loss in `combat-near-death` and `combat-low-hp` scenarios is inflated by Lifetap cards in those preset decks — not purely enemy damage.
- Sample size: 1 run per scenario. Results are directionally valid but not statistically robust. Use headless sim for statistical confidence.
