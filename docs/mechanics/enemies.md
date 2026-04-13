# Enemy System

> **Purpose:** Complete reference for the enemy roster, categories, scaling formulas, special behaviors, and encounter selection.
> **Last verified:** 2026-04-12 (T1.2-retry: Omnibus + Final Lesson status stacks cut 40% to reduce damage-per-turn. Phase 8: Elite unique mechanics — Librarian Silence, Tutor Pop Quiz, Headmistress Detention, Study Group phase sim. Phase 9: strip_block intents on page_flutter/bookmark_vine/staple_bug. Same-floor enemy dedup added 2026-04-12.)
> **Source files:** `src/data/enemies.ts`, `src/services/enemyManager.ts`, `src/data/balance.ts`, `src/services/ascension.ts`

## Enemy Categories

| Category | Description | HP Range (base) |
|---|---|---|
| `common` | Standard combat nodes. Weighted random from act pool. | 6–11 (Act 1); 5–11 overall |
| `elite` | Elite nodes. More HP, phase transitions. | 16 (Act 1); 12–17 overall |
| `mini_boss` | Gate encounters mid-act. | 11–13 (Act 1); 10–15 overall |
| `boss` | Act-ending encounters. Two phases, high HP. | 27–28 (Act 1); 15–28 overall |

## HP and Damage Scaling

HP formula (in `createEnemy`):
```
scaledHP = round(baseHP × ENEMY_BASE_HP_MULTIPLIER × getFloorScaling(floor) × hpMultiplier × coopHpScale × difficultyVariance)
```
- `ENEMY_BASE_HP_MULTIPLIER = 6.0` (raised from 4.0 on 2026-04-09: 50% HP increase, #1 balance fix — ensures meaningful multi-turn fights)
- `getFloorScaling(floor) = 1.0 + (floor - 1) × 0.10` — +10% HP per floor
- `coopHpScale`: from `getCoopHpMultiplier(playerCount)` — 1.0 for solo (see Co-op Scaling section)
- `difficultyVariance`: 0.8–1.2 for common enemies

Damage formula (in `executeEnemyIntent`):
```
damage = round((intent.value + enrageBonusDamage) × strengthModifier × getFloorDamageScaling(floor) × GLOBAL_ENEMY_DAMAGE_MULTIPLIER)
```
- Floors 1–6: `FLOOR_DAMAGE_SCALE_MID = 1.0` (reduced from 1.2 in balance pass #2, 2026-04-03)
- Floors 7+: `1.0 + (floor - 6) × FLOOR_DAMAGE_SCALING_PER_FLOOR` (0.06 per floor above 6)
- `GLOBAL_ENEMY_DAMAGE_MULTIPLIER = 1.60` (added 2026-04-08 Ch12.1; tuned from 2.0 → 1.60 in subsequent passes — see balance history below)

### Per-Turn Damage Caps (`ENEMY_TURN_DAMAGE_CAP`)
Charged attacks with `bypassDamageCap: true` skip these caps.

**Enrage cap enforcement (2026-04-04):** The global enrage bonus (from `getEnrageBonus()` in turnManager.ts) is added AFTER `executeEnemyIntent` returns. The cap is re-applied in turnManager after the enrage addition, using `enemy.floor` for the segment lookup. Without this fix, enrage bypassed the cap: at turn 40 in Act 3 (seg 4, cap 22 after 2026-04-04 tightening), enrage damage was added on top of the cap entirely unbounded. `ENRAGE_PHASE2_BONUS` also reduced 3→2 as part of this fix.

| Segment | Floors | Cap | Rationale |
|---|---|---|---|
| 1 | 1–6 | 16 | Was 22 (2026-04-09: reduced alongside GLOBAL multiplier tuning) |
| 2 | 7–12 | 22 | Was 28 (2026-04-09 pass 2: Act 2 cap reduction) |
| 3 | 13–18 | 32 | Was 40 (2026-04-09 pass 2: Act 3 cap reduction) |
| 4 | 19–24 | 56 | Doubled from 28 (2026-04-08 Ch12.1) |
| endless | 25+ | none | — |

### Ascension and Aura Scaling
- Ascension level 2+: `enemyDamageMultiplier = 1.10`
- `enemyHpMultiplier = 1.0` (no global HP mult; difficulty comes from elite design)
- High ascension: `miniBossTierAttacks` flag upgrades mini-boss intent pools to boss-tier attacks
- Brain Fog aura: all enemy attacks deal ×1.2 damage

### Co-op Scaling (Multiplayer)

Three exported functions in `enemyManager.ts` scale enemy stats for multi-player encounters. All default to 1.0× at solo (playerCount ≤ 1).

The curve is intentionally sublinear because quiz accuracy gates damage: two 70%-accuracy players deal roughly 1.4× effective DPS, not 2×. Scaling too aggressively would punish weaker players in a co-op party.

**`getCoopHpMultiplier(playerCount)`** — applied to HP at `createEnemy` time:

| Players | Multiplier | Formula |
|---|---|---|
| 1 | 1.0× | baseline |
| 2 | 1.5× | 1.0 + 0.5 |
| 3 | 2.0× | 1.0 + 1.0 |
| 4 | 2.3× | min(2.3, 1.0 + 1.5) |

**`getCoopBlockMultiplier(playerCount)`** — multiply enemy `defend` intent block value:
- Formula: `1.0 + (playerCount - 1) × 0.5`
- Prevents combined player DPS from trivializing enemy defense. Apply in the caller (turnManager or multiplayerGameService) using `enemy.playerCount`.

**`getCoopDamageCapMultiplier(playerCount)`** — multiply `ENEMY_TURN_DAMAGE_CAP` segment cap:
- Formula: `1.0 + (playerCount - 1) × 0.5`
- Prevents caps from bottlenecking enemy damage output against multi-player HP pools. Apply in turnManager when computing the cap using `enemy.playerCount`.

**`EnemyInstance.playerCount`** — stored on the instance at spawn time. Defaults to 1. Used by block and damage cap callers to retrieve the scaling factor post-creation without needing the original options object.

---

## 2026-04-03 Balance Pass #1

Full rationale and model in `docs/RESEARCH/enemy-balance-analysis-2026-04-03.md`.

**Problems fixed:**
- Act 1 commons had 100–160 effective HP (baseHP 25–40 × 4.0 multiplier) — took 10+ turns to kill
- Mini-bosses had 1/3 to 1/4 the HP of commons (baseHP 6–9 vs commons 25–40)
- Act 1 bosses had the same HP as floor 1 commons
- Act 2/3 enemies dealt 2–3 base damage — no tension against 100 HP player
- Enemy block values of 1–2 were invisible against player's 35–65 damage/turn

**Design targets (turns to kill):**
| Category | Target | Effective HP |
|---|---|---|
| Act 1 common | 3–4 turns | 40–64 |
| Act 1 elite/mini-boss | 5–7 turns | 88–176 |
| Act 1 boss | 8–12 turns | 200–275 |
| Act 2 common | 3–5 turns | 96–200 |
| Act 2 elite/mini-boss | 5–7 turns | 160–280 |
| Act 2 boss | 8–12 turns | 634–845 |
| Act 3 common | 3–5 turns | 358–538 |
| Act 3 mini-boss | 5–8 turns | 843–1037 |
| Act 3 boss | 10–14 turns | ~1786 |

---

## 2026-04-03 Balance Pass #2

Sim results after pass #1: dedicated 78→13% win rate, regular 23→0% (targets: dedicated 55–70%, regular 10–25%). Root cause: Act 2/3 attack values (4–6) combined with raised caps and FLOOR_DAMAGE_SCALE_MID=1.2 tripled incoming DPS.

**Changes:** `FLOOR_DAMAGE_SCALE_MID` 1.2→1.0. Caps: 10→8 / 16→14 / 22→20 / 32→30. Act 2/3 common attacks 4–5→3–4. Act 2/3 mini-boss attacks 6→5, defend 7→5–6, charge 7→6. Act 2 elite attacks 6→5. Act 2 boss attacks 5–6→4–5 (ph1), 6→5 (ph2). Act 3 boss attacks 5–6→4–5 (ph1), 6–7→5–6 (ph2). HP values unchanged.

---

## 2026-04-03 Balance Pass #3

Root cause identified: pass #2 doubled Act 2/3 common baseHP (e.g., 4→8, 7→12), which doubled fight duration and damage taken through attrition. Mid-tier players die to accumulated damage across the run because there is no post-encounter healing between commons.

**Changes:**
- Act 2 and Act 3 **commons only** — baseHP reverted to near-original (+1 base vs original)
- Act 2/3 **commons only** — attack values reverted to 3 (from 3–4 in pass #2), multi per-hit to 2 (from 3), defend to 2–3 (from 4–5)
- Damage caps seg 2/3/4 reverted to original (12/18/28 from 14/20/30)
- **Mini-bosses, elites, and bosses unchanged** — their higher HP is correct for the hierarchy

---

## 2026-04-03 Balance Pass #4

Pass #1 boss/elite/mini-boss HP increases were too aggressive. An Act 1 boss at baseHP 25 = 275 HP at floor 8 when mid-tier players only deal ~13–25 dmg/turn — fights last 11–21 turns. Reduced to moderate increases that maintain the hierarchy (commons < elite ≤ mini-boss < boss) while keeping fights reasonable.

Also reduced Act 1 boss phase 1 attack values to 3–4 (from 5) and phase 2 to 5 (from 7). Long fights mean cumulative damage adds up; lower single-turn values reduce attrition without removing threat.

**HP changes (all boss/elite/mini-boss categories only — commons unchanged):**

| Tier | Enemy | Old | New |
|---|---|---|---|
| Act 1 elite | librarian | 22 | 16 |
| Act 1 mini-boss | plagiarist | 18 | 12 |
| Act 1 mini-boss | card_catalogue | 20 | 14 |
| Act 1 mini-boss | headmistress | 20 | 14 |
| Act 1 mini-boss | tutor | 16 | 11 |
| Act 1 mini-boss | study_group | 22 | 15 |
| Act 1 boss | final_exam | 25 | 18 |
| Act 1 boss | burning_deadline | 25 | 18 |
| Act 2 elite | deadline_serpent | 18 | 14 |
| Act 2 elite | standardized_test | 22 | 16 |
| Act 2 elite | emeritus | 22 | 16 |
| Act 2 elite | student_debt | 16 | 12 |
| Act 2 elite | publish_or_perish | 22 | 16 |
| Act 2 mini-boss | tenure_guardian | 16 | 11 |
| Act 2 mini-boss | proctor | 18 | 13 |
| Act 2 mini-boss | harsh_grader | 16 | 11 |
| Act 2 mini-boss | textbook | 18 | 13 |
| Act 2 mini-boss | imposter_syndrome | 16 | 11 |
| Act 2 mini-boss | pressure_cooker | 16 | 11 |
| Act 2 mini-boss | grade_dragon | 18 | 13 |
| Act 2 mini-boss | comparison_trap | 14 | 10 |
| Act 2 mini-boss | perfectionist | 20 | 14 |
| Act 2 mini-boss | hydra_problem | 18 | 13 |
| Act 2 mini-boss | ivory_tower | 16 | 11 |
| Act 2 mini-boss | helicopter_parent | 20 | 14 |
| Act 2 boss | algorithm | 18 | 14 |
| Act 2 boss | curriculum | 22 | 16 |
| Act 2 boss | group_project | 22 | 17 |
| Act 2 boss | rabbit_hole | 24 | 19 |
| Act 3 elite | dunning_kruger | 12 | 10 |
| Act 3 elite | singularity | 12 | 10 |
| Act 3 mini-boss | first_question | 14 | 11 |
| Act 3 mini-boss | dean | 14 | 11 |
| Act 3 mini-boss | dissertation | 16 | 13 |
| Act 3 mini-boss | eureka | 13 | 11 |
| Act 3 mini-boss | paradigm_shift | 16 | 13 |
| Act 3 mini-boss | ancient_tongue | 14 | 11 |
| Act 3 mini-boss | lost_thesis | 13 | 10 |
| Act 3 boss | omnibus | 24 | 20 |
| Act 3 boss | final_lesson | 24 | 20 |

**Attack value changes:**
- `final_exam` ph1: atk 5→3. Ph2: atk 7→5
- `burning_deadline` ph1: atk 5/5→3/4. Ph2: atk 7→5

---

## 2026-04-03 Balance Pass #5

Root cause: starter deck L0 cards (QP=3) deal only 9 dmg/turn vs old 12 dmg/turn. Scholar dropped 89→42%, dedicated 56→10%. Act 1 HP must come down ~30% to restore 3–4 turn fights; Act 2/3 non-commons also reduced ~15% to compensate for weaker max-mastery ceiling.

**Player damage model (L0 starter deck: 5 strike, 4 block, 1 transmute — foresight replaced 2026-04-09):**
- 3 QP strikes = 9 dmg/turn
- 3 CC strikes = ~16 dmg/turn
- Mixed (1CC + 2QP) = 11 dmg/turn

**Damage cap:** seg 1: 8→7 (weaker player + weaker enemies; lower cap keeps Act 1 survivable)

**HP changes:**

| Tier | Enemy | Pass #4 | Pass #5 |
|---|---|---|---|
| Act 1 common | page_flutter | 12 | 8 |
| Act 1 common | thesis_construct | 13 | 9 |
| Act 1 common | mold_puff | 10 | 7 |
| Act 1 common | ink_slug | 14 | 10 |
| Act 1 common | bookmark_vine | 11 | 8 |
| Act 1 common | staple_bug | 16 | 11 |
| Act 1 common | margin_gremlin | 12 | 8 |
| Act 1 common | index_weaver | 11 | 8 |
| Act 1 common | overdue_golem | 15 | 10 |
| Act 1 common | pop_quiz | 11 | 8 |
| Act 1 common | eraser_worm | 10 | 7 |
| Act 1 elite | librarian | 16 | 12 |
| Act 1 mini-boss | plagiarist | 12 | 9 |
| Act 1 mini-boss | card_catalogue | 14 | 10 |
| Act 1 mini-boss | headmistress | 14 | 10 |
| Act 1 mini-boss | tutor | 11 | 8 |
| Act 1 mini-boss | study_group | 15 | 11 |
| Act 1 boss | final_exam | 18 | 14 |
| Act 1 boss | burning_deadline | 18 | 14 |
| Act 2 elite | deadline_serpent | 14 | 12 |
| Act 2 elite | standardized_test | 16 | 14 |
| Act 2 elite | emeritus | 16 | 14 |
| Act 2 elite | student_debt | 12 | 10 |
| Act 2 elite | publish_or_perish | 16 | 14 |
| Act 2 mini-boss | tenure_guardian | 11 | 9 |
| Act 2 mini-boss | proctor | 13 | 11 |
| Act 2 mini-boss | harsh_grader | 11 | 9 |
| Act 2 mini-boss | textbook | 13 | 11 |
| Act 2 mini-boss | imposter_syndrome | 11 | 9 |
| Act 2 mini-boss | pressure_cooker | 11 | 9 |
| Act 2 mini-boss | grade_dragon | 13 | 11 |
| Act 2 mini-boss | comparison_trap | 10 | 8 |
| Act 2 mini-boss | perfectionist | 14 | 12 |
| Act 2 mini-boss | hydra_problem | 13 | 11 |
| Act 2 mini-boss | ivory_tower | 11 | 9 |
| Act 2 mini-boss | helicopter_parent | 14 | 12 |
| Act 2 boss | algorithm | 14 | 12 |
| Act 2 boss | curriculum | 16 | 14 |
| Act 2 boss | group_project | 17 | 15 |
| Act 2 boss | rabbit_hole | 19 | 17 |
| Act 3 elite | dunning_kruger | 10 | 9 |
| Act 3 elite | singularity | 10 | 9 |
| Act 3 mini-boss | first_question | 11 | 10 |
| Act 3 mini-boss | dean | 11 | 10 |
| Act 3 mini-boss | dissertation | 13 | 12 |
| Act 3 mini-boss | eureka | 11 | 10 |
| Act 3 mini-boss | paradigm_shift | 13 | 12 |
| Act 3 mini-boss | ancient_tongue | 11 | 10 |
| Act 3 mini-boss | lost_thesis | 10 | 9 |
| Act 3 boss | omnibus | 20 | 18 |
| Act 3 boss | final_lesson | 20 | 18 |

**Attack value changes (Act 1 commons only — single attacks subtract 1; multi per-hit and defend unchanged):**
- `page_flutter`: atk 7/7→6/6
- `thesis_construct`: atk 6→5 (charge 8 stays — bypassDamageCap)
- `mold_puff`: atk 6→5
- `ink_slug`: atk 7→6
- `bookmark_vine`: single atk 6→5
- `staple_bug`: snap atk 8→7
- `margin_gremlin`: atk 7/6→6/5
- `index_weaver`: single atk 6→5
- `overdue_golem`: atk 6→5
- `pop_quiz`: atk 6→5
- `eraser_worm`: single atk 6→5


## 2026-04-03 Balance Pass #6

Root cause: Dedicated profile win rate at 20% (target 30–50%). Players die in Act 2 from cumulative attrition across 8+ common fights. Act 2 commons at baseHP 5–8 produced 60–96 effective HP at floor 9; dedicated deals ~25–30 dmg/turn → 2–4 turns/fight, but damage received across the run exceeds player HP.

**Change: all Act 2 and Act 3 commons reduced by 1 baseHP.**

Act 2 commons (deep_caverns + the_abyss): 5–8 → 4–7.
Act 3 commons (the_archive): 6–9 → 5–8.
Mini-bosses, elites, and bosses unchanged.

**Expected impact:** ~12–20% reduction in cumulative common HP per run. At floor 9 effective HP 48–84 (was 60–96). No intent value changes.

---

## Act 1 Base Stats (2026-04-09 rebalance — pass #8 values)

Act 1 commons: baseHP 6–11 (pass #8, 3-4 turn fights at higher player DPS with 6.0× multiplier). Attack values raised ~50%. Damage cap: 22 (seg 1).

| Enemy | Base HP | Attack intent value | Notes |
|---|---|---|---|
| `page_flutter` | 7 | 9 / 9 | Defend 9 |
| `thesis_construct` | 9 | 8 (atk) / 12 (charge) | Defend 10; multi 5×2; chargeResistant |
| `mold_puff` | 6 | 8 | Attack weight raised; debuff weights lowered |
| `ink_slug` | 10 | 9 | Defend 8; attack weight raised |
| `bookmark_vine` | 8 | 8 (single) / 5×3 | chainVulnerable |
| `staple_bug` | 11 | 10 (snap) / 6×2 | Defend 10; chargeResistant |
| `margin_gremlin` | 8 | 9 / 8 | Self-buffs Strength |
| `index_weaver` | 9 | 6 per hit × 3 | Multi 6×3; chainVulnerable |
| `overdue_golem` | 10 | 8 | Attack weight raised 1→3; heal/debuff lowered |
| `pop_quiz` | 7 | 8 | Attack weight raised 1→3; debuff weights lowered |
| `eraser_worm` | 6 | 8 (single) / 5×4 | chainVulnerable; rare |

`thesis_construct`'s charge uses `bypassDamageCap: true` so the 12-base attack exceeds the floor 1 cap.
Status effect values (poison, weakness, vulnerable) kept at 1–2 per application — already impactful.

### Act 1 Elite
| Enemy | Base HP | Phase | Notes |
|---|---|---|---|
| `librarian` | 16 | 40% HP | Phase 1: attack 6, defend 7, charge 10. Phase 2: attack 8, multi 5×3, charge 10. **Silence**: locks random card type each enemy turn (`onEnemyTurnStart`) |

### Act 1 Mini-Bosses
| Enemy | Base HP | Special |
|---|---|---|
| `plagiarist` | 11 | Gains +1 Strength/turn from turn 4; attack 8/6 |
| `card_catalogue` | 12 | Healer (reduced weight) + multi-hit 5×3; attack 8 |
| `headmistress` | 13 | Heavy defender (defend 9, weight 2) + charge 10; attack 6 (weight 2). **Detention**: forgets player's 2 highest-mastery cards at encounter start (`onEncounterStart`) |
| `tutor` | 11 | Attack weight raised 1→3; debuff/heal weights lowered; attack 8. **Pop Quiz**: wrong Charge doubles next attack (`onPlayerChargeWrong`) |
| `study_group` | 20 | **Phase 8**: raised from 13 to 20 (simulate 3 members). Phase transition at 33% HP — last member stands alone (phase 2: atk 11). Group synergy Strength buff removed on transition |

### Act 1 Bosses
| Enemy | Base HP | Phase transition | Quiz Gauntlet | Notes |
|---|---|---|---|---|
| `final_exam` | 27 | 40% HP | 50% HP — see below | Ph1: atk 5, multi 6×4, defend 8. Ph2: atk 8, multi 6×3, defend 8, charge 12 |
| `burning_deadline` | 28 | 40% HP | 50% HP — see below | Ph1: atk 5/6 (weight 2 each). Ph2: atk 8, multi 6×4 |

#### Boss Phase 2: Comprehensive Review Gauntlet (Phase 7 — 2026-04-09)

At 50% HP, Act 1 bosses (`final_exam` and `burning_deadline`) stop all normal combat attacks and enter the **Comprehensive Review Gauntlet** — the signature "show what you've learned" moment of Act 1.

**Gauntlet rules (defined in `BOSS_QUIZ_GAUNTLET`, `src/data/balance.ts`):**
- 8 rapid-fire quiz questions drawn from the player's weakest knowledge domain (lowest accuracy across the run)
- Correct answer: deals 5% of boss maxHP as damage to the boss
- Wrong answer: deals 10 damage to the player (goes through the damage pipeline — block reduces it)
- Timer starts at **12 seconds** for question 0, decreasing by 0.5s per question, with a floor of **5 seconds**
- Timer sequence: 12s, 11.5s, 11s, 10.5s, 10s, 9.5s, 9s, 9s (clamped at 5s minimum)
- Gauntlet ends after all 8 questions; boss resumes normal Phase 2 combat (if still alive)

**Implementation:** `BOSS_QUIZ_PHASES['final_exam']` and `BOSS_QUIZ_PHASES['burning_deadline']` in `balance.ts`. Timer per question computed via `getQuizPhaseTimerSeconds(config, questionIndex)` in `bossQuizPhase.ts`. The `rapidFire` flag means per-answer effects are applied immediately during the phase; `resolveQuizPhaseResults` returns `playerDamage` (total wrong x 10) in the outcome for the caller to apply.

---

## 2026-04-03 Balance Pass #7

Root cause: first-kill window too long. Player QP output (3 strikes × 3 QP = 9 dmg/turn) against eff-HP of 28–44 (baseHP 7–11 × 4.0) required 3–5 turns to down the first enemy — no urgency and too much pressure from enemy attacks. Target: first common should die in ~2 turns QP (eff-HP ≤ 20), with steeper scaling to make QP alone insufficient by floor 3–4.

**HP changes (Act 1 only — commons, elite, mini-bosses, bosses):**

| Tier | Enemy | Pass #5/6 | Pass #7 | Eff HP (×4.0) | QP turns |
|---|---|---|---|---|---|
| Act 1 common | mold_puff | 7 | 4 | 16 | 1.8 |
| Act 1 common | eraser_worm | 7 | 4 | 16 | 1.8 |
| Act 1 common | page_flutter | 8 | 5 | 20 | 2.2 |
| Act 1 common | bookmark_vine | 8 | 5 | 20 | 2.2 |
| Act 1 common | pop_quiz | 8 | 5 | 20 | 2.2 |
| Act 1 common | thesis_construct | 9 | 6 | 24 | 2.7 |
| Act 1 common | margin_gremlin | 8 | 6 | 24 | 2.7 |
| Act 1 common | index_weaver | 8 | 6 | 24 | 2.7 |
| Act 1 common | ink_slug | 10 | 7 | 28 | 3.1 |
| Act 1 common | overdue_golem | 10 | 7 | 28 | 3.1 |
| Act 1 common | staple_bug | 11 | 8 | 32 | 3.6 |
| Act 1 elite | librarian | 12 | 10 | 40 | ~5 turns |
| Act 1 mini-boss | plagiarist | 9 | 7 | 28 | mid |
| Act 1 mini-boss | card_catalogue | 10 | 8 | 32 | mid |
| Act 1 mini-boss | headmistress | 10 | 8 | 32 | mid |
| Act 1 mini-boss | tutor | 8 | 6 | 24 | lightest |
| Act 1 mini-boss | study_group | 11 | 9 | 36 | toughest |
| Act 1 boss | final_exam | 14 | 12 | 48 | ~5–6 turns |
| Act 1 boss | burning_deadline | 14 | 12 | 48 | ~5–6 turns |

No attack/block/intent values changed. Act 2/3 enemies unchanged.

**Sim results after pass #7 (with mastery stat table system, 2026-04-03):** Scholar 59%, Dedicated 20%, Regular 2%. Scholar target met (50–70%). Dedicated below target (30–50%). Regular below target (5–15%). Further passes needed for dedicated/regular profiles — stat table rebalancing compressed max-mastery ceiling significantly.

---

## Act 2 Base Stats (2026-04-09 rebalance — pass #8 values)

Act 2 commons: baseHP 5–9 (+20-30% from pass #8). Attack values 4. Multi per-hit 3. Defend 3–4.

### Deep Caverns Commons
| Enemy | Base HP | Atk | Notes |
|---|---|---|---|
| `crib_sheet` | 5 | 4 / multi 3×3 | Mirrors wrong Charge |
| `citation_needed` | 9 | 4 / defend 3 | Block-stealer on wrong Charge |
| `crambot` | 6 | 4 / defend 3 | chargeResistant |
| `all_nighter` | 6 | 4 / 4 | Weakness debuffer |
| `spark_note` | 6 | 4 / 4 | Poison |
| `watchdog` | 5 | multi 3×3 / 4 | chargeResistant |
| `red_herring` | 9 | 4 | Multi-debuffer |
| `anxiety_tick` | 9 | 4 | Self-healer |
| `trick_question` | 6 | 4 / 4 | Wrong Charge heals it |
| `dropout` | 9 | 4 / defend 3 | chargeResistant |
| `brain_fog` | 9 | 4 | Mastery eroder |
| `thesis_dragon` | 5 | multi 3×3 / 4 | chainVulnerable |
| `burnout` | 6 | 4 / 4 | Poison |
| `grade_curve` | 9 | 4 / defend 3 | Grows with correct Charges |

### The Abyss Commons
| Enemy | Base HP | Atk | Notes |
|---|---|---|---|
| `writers_block` | 5 | multi 3×4 / 4 | chainVulnerable |
| `information_overload` | 6 | 4 / 4 | Poison |
| `rote_memory` | 9 | 4 / defend 4 | chargeResistant |
| `outdated_fact` | 5 | multi 3×3 / 4 | chainVulnerable |
| `hidden_gem` | 9 | 4 / defend 4 | chargeResistant |
| `rushing_student` | 6 | multi 3×3 / 4 | chainVulnerable |
| `echo_chamber` | 5 | 4 / multi 3×3 | — |
| `blank_spot` | 8 | 4 / defend 4 | Gains 8 block on wrong Charge |
| `burnout_phantom` | 6 | 4 / 4 | Vulnerable debuffer |
| `prismatic_jelly` | 9 | 4 | Weakness + Vulnerable |
| `ember_skeleton` | 8 | 4 / multi 3×3 | chainVulnerable |

### Act 2 Elites
| Enemy | Base HP | Phase | Notes |
|---|---|---|---|
| `deadline_serpent` | 15 | 50% HP | Ph1: atk 6, multi 4×2. Ph2: atk 6, multi 4×3, charge 7 |
| `standardized_test` | 17 | — | defend 7, charge 7, atk 6 |
| `emeritus` | 17 | 50% HP | Ph1: defend 7, atk 6. Ph2: multi 4×3, charge 7 |
| `student_debt` | 12 | 40% HP | Ph1: atk 6, multi 4×3. Ph2: atk 6, multi 4×4 |
| `publish_or_perish` | 17 | — | Immune to natural_sciences; atk 6 |

### Act 2 Mini-Bosses
| Enemy | Base HP | Notes |
|---|---|---|
| `tenure_guardian` | 9 | Gains Str on no Charge; atk 5, defend 5 |
| `proctor` | 11 | Seismic Slam charge 6; defend 5, atk 5 |
| `harsh_grader` | 9 | Poison stacker; multi 3×3, atk 5 |
| `textbook` | 11 | Hardcover armor; charge 6, defend 5, atk 5 |
| `imposter_syndrome` | 9 | multi 3×3, atk 5 |
| `pressure_cooker` | 9 | atk 5, defend 5 |
| `grade_dragon` | 11 | Fire + Poison; atk 5/4 |
| `comparison_trap` | 10 | 3-hit phantom copies; multi 3×3, atk 4 |
| `perfectionist` | 12 | defend 5, charge 6, atk 5 |
| `hydra_problem` | 11 | multi 3×3, defend 5, atk 5 |
| `ivory_tower` | 9 | multi 3×3, atk 5 |
| `helicopter_parent` | 12 | multi 3×3, defend 5, atk 5 |

### Act 2 Bosses
| Enemy | Base HP | Phase | Notes |
|---|---|---|---|
| `algorithm` | 15 | 50% HP | Ph1: atk 5, defend 6, heal 5. Ph2: atk 6, multi 4×4, heal 6 |
| `curriculum` | 17 | 50% HP | Ph1: atk 5, defend 6, multi 4×3, heal 5. Ph2: QP=0; atk 6, defend 6, multi 4×4, heal 4 |
| `group_project` | 14 | 50% HP | Ph1: atk 5, multi 4×3. Ph2: multi 4×2, multi 4×4, atk 4 | (HP 18→14, atk 6→4, pass 2 2026-04-09) |
| `rabbit_hole` | 21 | — | atk 5, multi 4×3, defend 6 |

---

## Act 3 Base Stats (2026-04-03 rebalance — pass #6 values)

Act 3 commons: baseHP 5–8 (−1 across all, pass #6). Attack values 3. Multi per-hit 2. Defend 3.

### The Archive Commons
| Enemy | Base HP | Atk | Notes |
|---|---|---|---|
| `thesis_djinn` | 6 | 3 / 3 | chargeResistant |
| `gut_feeling` | 6 | 3 / multi 2×3 / 3 | — |
| `bright_idea` | 6 | 3 / 3 | Weakness debuffer |
| `sacred_text` | 7 | 3 / defend 3 | chargeResistant |
| `devils_advocate` | 6 | 3 | Poison + self-buff |
| `institution` | 8 | 3 / defend 3 / charge 5 | chargeResistant |
| `rosetta_slab` | 6 | 3 / defend 3 | Weakness |
| `moth_of_enlightenment` | 5 | 3 / 3 | Vulnerable |
| `hyperlink` | 5 | multi 2×3 / 3 | Poison |
| `unknown_unknown` | 6 | 3 | Weakness + Vulnerable |
| `fake_news` | 6 | 3 / multi 2×3 / defend 3 | chargeResistant |

### Act 3 Elites
| Enemy | Base HP | Notes |
|---|---|---|
| `dunning_kruger` | 9 | Flatlines chain multipliers at 1.0×; atk 5/4, defend 6 |
| `singularity` | 9 | QP deals 30% damage; atk 5/4, defend 6 |

### Act 3 Mini-Bosses
| Enemy | Base HP | Notes |
|---|---|---|
| `first_question` | 10 | Phase 2 at 50%; atk 5, multi 3×3, charge 7. Ph2: atk 5, multi 3×4 |
| `dean` | 10 | Gains Str on no Charge; atk 5, defend 6 |
| `dissertation` | 12 | defend 7, charge 7, atk 5 |
| `eureka` | 10 | Self-healer + debuffer; atk 5 |
| `paradigm_shift` | 12 | atk 5, charge 7, multi 3×3 |
| `ancient_tongue` | 10 | Gains Str on no Charge; defend 7, atk 5 |
| `lost_thesis` | 9 | atk 5, defend 6 |

### Act 3 Bosses
| Enemy | Base HP | Phase | Notes |
|---|---|---|---|
| `omnibus` | 9 | 50% HP | Ph1: atk 4/5, defend 5, str+1 buff, charge 7. Ph2: atk 5, multi 4×2, str+1 buff, charge 7 | (HP 12→9, T1.2 -25%; str 2→1, T1.2-retry -40%, 2026-04-11) |
| `final_lesson` | 10 | 33% HP | Ph1: atk 5, multi 4×4, weakness 1, str+1. Ph2: atk 6, multi 4×4, vulnerable 1, str+2, heal 6. Quiz 66%+33%; wrong charge →str+1 perm | (HP 14→10, T1.2 -25%; all status stacks -40%, T1.2-retry, 2026-04-11) |

---

## Act Enemy Pools (`ACT_ENEMY_POOLS`)

Enemy selection uses `getEnemiesForNode(act, nodeType)` which maps to `ACT_ENEMY_POOLS`.

### Same-Floor Enemy Dedup (2026-04-12)

**Source:** `src/services/encounterBridge.ts` — `_lastFloorEnemyId`, `_lastFloorEliteId`, `_lastFloorTracked`

When `startEncounterForRoom` picks a common or elite enemy from an act pool, it filters out the last enemy that appeared on the current floor. This prevents `page_flutter` (or any single enemy) from filling both encounter 1 and encounter 2 on the same floor.

**Rules:**
- Applies to: common encounters and elite encounters (challenge mode).
- Does NOT apply to: mini-bosses, bosses (they have their own rotation — AR-98 `getLastBossForAct`).
- **Softlock guard:** if the pool has only 1 candidate after filtering, the filter is skipped and that single enemy is used.
- **Cross-floor:** trackers reset when `run.floor.currentFloor` changes, so floor 2 may re-use an enemy from floor 1.
- **Run boundary:** `resetEncounterBridge()` clears all three tracker variables so a new run starts fresh.

### Act 1 — Shallow Depths (floors 1–8)
- **Commons (11):** page_flutter, thesis_construct, mold_puff, ink_slug, bookmark_vine, staple_bug, margin_gremlin, index_weaver, overdue_golem, pop_quiz, eraser_worm
- **Elites (1):** librarian
- **Mini-bosses (5):** plagiarist, card_catalogue, headmistress, tutor, study_group
- **Bosses (2):** final_exam, burning_deadline

### Act 2 — Deep Caverns + The Abyss (floors 9–16)
- **Commons (25):** crib_sheet, citation_needed, grade_curve, crambot, all_nighter, spark_note, watchdog, red_herring, anxiety_tick, trick_question, dropout, brain_fog, thesis_dragon, burnout, writers_block, information_overload, rote_memory, outdated_fact, hidden_gem, rushing_student, echo_chamber, blank_spot, burnout_phantom, prismatic_jelly, ember_skeleton
- **Elites (5):** deadline_serpent, standardized_test, emeritus, student_debt, publish_or_perish
- **Mini-bosses (12):** tenure_guardian, proctor, harsh_grader, textbook, imposter_syndrome, pressure_cooker, grade_dragon, comparison_trap, perfectionist, hydra_problem, ivory_tower, helicopter_parent
- **Bosses (4):** algorithm, curriculum, group_project, rabbit_hole

### Act 3 — The Archive (floors 17–24)
- **Commons (11):** thesis_djinn, gut_feeling, bright_idea, sacred_text, devils_advocate, institution, rosetta_slab, moth_of_enlightenment, hyperlink, unknown_unknown, fake_news
- **Elites (2):** dunning_kruger, singularity
- **Mini-bosses (7):** first_question, dean, dissertation, eureka, paradigm_shift, ancient_tongue, lost_thesis
- **Bosses (2):** omnibus, final_lesson

---

## Notable Enemies by Special Mechanic

### Common Enemies

| ID | base HP | Rarity | Special mechanic |
|---|---|---|---|
| `page_flutter` | 7 | standard | Can self-buff Strength 1 for 2 turns. **Phase 9**: Flutter dive strips 5 player block (strip_block debuff) |
| `thesis_construct` | 9 | standard | `chargeResistant` — Quick Play deals 50% damage |
| `mold_puff` | 6 | standard | Stacks Poison 2 for 3 turns each attack |
| `crib_sheet` | 5 | standard | `onPlayerChargeWrong`: reflects card's base damage to player |
| `citation_needed` | 9 | standard | `onPlayerChargeWrong`: steals up to 5 block, heals enemy that amount. **Heal overshoot WAI**: heal intent (+5) and block-steal (+up to 5) are independent — both can fire in the same turn window for up to +10 HP total. **UX gap**: no floating text on block-steal; planned fix via ui-agent. |
| `pop_quiz` | 7 | uncommon | `onPlayerChargeCorrect`: stuns enemy next turn; `onPlayerNoCharge`: +1 permanent `enrageBonusDamage` |
| `eraser_worm` | 6 | rare | `chainVulnerable` — chain attacks deal +50% damage |
| `bookmark_vine` | 8 | uncommon | `chainVulnerable`; multi-hit 3×vine lash. **Phase 9**: Binding grip strips 8 player block (strip_block debuff) |
| `margin_gremlin` | 8 | uncommon | Self-buffs Strength 1 for 2 turns; fast repeated jabs |
| `index_weaver` | 9 | standard | `chainVulnerable`; multi-hit 4×3 fang barrage + Poison 2×3 turns |
| `overdue_golem` | 10 | standard | Heals 5 HP per turn (reduced from 9, 2026-04-03) |
| `ink_slug` | 10 | standard | Stacks Poison 2 per attack; slow attacker |
| `staple_bug` | 11 | standard | `chargeResistant`; Mandible snap (7) + 2-hit Chittering strike (4 per hit). **Phase 9**: Pierce defense strips 10 player block (strip_block debuff) |

### Elite Enemies

| ID | base HP | Special mechanic |
|---|---|---|
| `librarian` | 16 | Phase 2 at 40% HP — gains enraged smash + 3-hit rending claws. **Phase 8 Silence**: locks a random card type each enemy turn via `onEnemyTurnStart`; synced to `turnState.lockedCardType`, cleared at next player turn start |
| `bookwyrm` | 7 | **Deprecated** (not in ACT_ENEMY_POOLS); phase 2 at 50% |
| `peer_reviewer` | 7 | **Deprecated**; `onPlayerNoCharge` gains +3 permanent Strength (999 turns) |

### Mini-Boss Enemies

| ID | base HP | Special mechanic |
|---|---|---|
| `plagiarist` | 11 | `onEnemyTurnStart`: from turn 4 onward, gains +5 `enrageBonusDamage` every enemy turn |
| `tenure_guardian` | 11 | `onPlayerNoCharge`: gains +1 permanent Strength |
| `proctor` | 13 | `onPlayerNoCharge`: gains +1 Strength; telegraphs 7-damage Seismic Slam charge |
| `grade_dragon` | 13 | Fire breath + Poison 2×2 turns |
| `comparison_trap` | 10 | `onPlayerChargeWrong`: mirrors `cardBaseDamage` back to player + gains +1 permanent Strength; `onPlayerNoCharge`: gains +2 permanent Strength. Nastier than crib_sheet — escalates on mistakes AND punishes avoidance |
| `textbook` | 13 | `hardcoverArmor: 16`; reduces Quick Play damage; -4 per correct Charge, +2 per wrong; breaking opens full damage |

### Boss Enemies

| ID | base HP | Phase trigger | Special mechanic |
|---|---|---|---|
| `final_exam` | 27 | 40% HP | Phase 2: 8-base Overdrive slam, 12-damage charged burst (`bypassDamageCap`) |
| `burning_deadline` | 28 | 40% HP | Phase 2: Volcanic blast (8 base) + Poison 4×3 rain |
| `algorithm` | 15 | 50% HP | Quiz phase at 50% HP (5 questions); heals 5–6 HP per turn |
| `curriculum` | 17 | 50% HP | `onPhaseTransition`: `_quickPlayDamageMultiplierOverride = 0` + +2 `enrageBonusDamage`; only Charge deals damage |
| `group_project` | 14 | 50% HP | Phase 2: 2-hit dual strike, 4-hit fang barrage, Poison 4×3, atk 4 (pass 2: HP 18→14, peak atk 6→4) |
| `rabbit_hole` | 21 | — | Debuffs hand with vulnerable and weakness each turn; no phase transition |
| `omnibus` | 9 | 50% HP | Phase 2: 5-base attacks, 2-hit page storm, +1 Strength buff (was +2); charges 7-damage Tome Avalanche (T1.2: HP 12→9, -25%, 2026-04-11; T1.2-retry: str 2→1 on all buff intents, -40%, 2026-04-11) |
| `final_lesson` | 10 | 33% HP | Quiz phases at 66% HP (5q) and 33% HP (8q, 4s rapid-fire); `onPlayerChargeWrong`: +1 permanent Strength (was +2); Ph1: weakness 1 (was 2), str+1 (was +2); Ph2: vulnerable 1 (was 2), str+2 (was +3) | (T1.2: HP 14→10, -25%, 2026-04-11; T1.2-retry: all status stacks -40%, 2026-04-11) |

---

## Intent System

Enemies telegraph next action via `EnemyIntent.telegraph`. Selected by `weightedRandomIntent()` (weighted random).

| Type | Effect |
|---|---|
| `attack` | `round(value × strengthMod × floorDamageScaling × GLOBAL_ENEMY_DAMAGE_MULTIPLIER)` damage |
| `multi_attack` | Above × `hitCount` hits |
| `defend` | Adds `value` to enemy block (resets at enemy turn start) |
| `buff` | Applies status effect to self (e.g., Strength) |
| `debuff` | Applies status effect to player. If `statusEffect.type === 'strip_block'`: instantly removes `value` player block (not a persistent status — resolved immediately in turnManager) |
| `heal` | Restores `value` HP, capped at maxHP |
| `charge` | Winds up; next turn fires auto-attack with `bypassDamageCap: true` |

## Quiz-Reactive Hooks

| Callback | When it fires |
|---|---|
| `onPlayerChargeWrong(ctx)` | After player answers a Charge quiz incorrectly |
| `onPlayerChargeCorrect(ctx)` | After player answers a Charge quiz correctly |
| `onPlayerNoCharge(ctx)` | End of player turn with zero Charge plays that turn |
| `onEnemyTurnStart(ctx)` | Start of each enemy turn (enrage, stun clear, mastery erosion) |
| `onPhaseTransition(enemy)` | When phase 1 → 2 transition fires |
| `onEncounterStart(enemy, deck)` | Once after encounter setup (hand dealt, relics applied). Returns `string[]` of card IDs to forget. Used by Headmistress Detention. Dispatched from `encounterBridge.startEncounterForRoom` |

`chainMultiplierOverride` (used by The Nullifier): forces all Knowledge Chain multipliers to a fixed value while the enemy is alive.

---

## 2026-04-08 Balance Pass Ch12.1 — Global x2 Damage Multiplier

**Root cause:** Playtest 2026-04-08 revealed all player profiles except master were surviving too easily. Enemy damage felt inconsequential and master-tier was winning too often (93%) for a roguelite. Decision: flat x2 global multiplier to raise pressure across all acts uniformly.

**Change (original):** Added `GLOBAL_ENEMY_DAMAGE_MULTIPLIER = 2.0` in `balance.ts`. Applied in `executeEnemyIntent()` to both `attack` and `multi_attack` intent cases. Damage caps doubled proportionally so cap ratios remain the same relative to base enemy output.

**Subsequent tuning:** Multiplier reduced 2.0 → 1.60 in balance pass 4d (2026-04-09). Damage caps also revised: Seg 1 22→16, Seg 2 28→22, Seg 3 40→32. Current live value: `GLOBAL_ENEMY_DAMAGE_MULTIPLIER = 1.60`.

**Pre-change sim results (500 runs each):**
| Profile | Win rate |
|---|---|
| new_player | 0% |
| developing | 10% |
| competent | 14% |
| experienced | 46% |
| master | 93% |

**Post-change sim results (500 runs each):**
| Profile | Win rate | Delta |
|---|---|---|
| new_player | 0% | 0% |
| developing | 1% | −9% |
| competent | 0% | −14% |
| experienced | 0% | −46% |
| master | 22% | −71% |
| language_learner | 0% | −0.2% |

**Analysis:** Overcorrected significantly. Master dropped 93% → 22%. Developing/competent/experienced collapsed to ~0%. The x2 multiplier is too aggressive as a final value — further tuning needed. This serves as a starting point for playtest feedback; next steps likely involve reducing to 1.3–1.5× or adjusting base attack values directly rather than a global multiplier.

---


## 2026-04-09 Balance Pass #8 — 6.0× Multiplier Recalibration

**Context:** ENEMY_BASE_HP_MULTIPLIER changed from 4.0 to 6.0 (separate agent). This pass recalibrates baseHP values and attack damage to restore intended fight durations.

**Root cause:** With 6.0× multiplier, old baseHP values produce 50% more effective HP than designed. Act 1 commons at baseHP 4-8 × 6.0 = 24-48 HP (was 16-32 × 4.0). Also, attack damage needed to scale with increased survivability — fights last longer so per-turn damage must threaten more.

**Design targets (accounting for 6.0× multiplier):**
| Category | Target effective HP (×6) | baseHP |
|---|---|---|
| Act 1 common | 36-66 | 6-11 |
| Act 1 mini-boss | 66-78 | 11-13 |
| Act 1 elite | 96 | 16 |
| Act 1 boss | 162-168 | 27-28 |
| Act 2 common | ~30-54 | 5-9 |
| Act 2 mini-boss/elite | ~66-102 | 11-17 |
| Act 2 boss | ~90-126 | 15-21 |

**Act 1 baseHP changes:**

| Tier | Enemy | Pass #7 | Pass #8 | Eff HP (×6) |
|---|---|---|---|---|
| Act 1 common | mold_puff | 4 | 6 | 36 |
| Act 1 common | eraser_worm | 4 | 6 | 36 |
| Act 1 common | page_flutter | 5 | 7 | 42 |
| Act 1 common | pop_quiz | 5 | 7 | 42 |
| Act 1 common | bookmark_vine | 5 | 8 | 48 |
| Act 1 common | margin_gremlin | 6 | 8 | 48 |
| Act 1 common | thesis_construct | 6 | 9 | 54 |
| Act 1 common | index_weaver | 6 | 9 | 54 |
| Act 1 common | ink_slug | 7 | 10 | 60 |
| Act 1 common | overdue_golem | 7 | 10 | 60 |
| Act 1 common | staple_bug | 8 | 11 | 66 |
| Act 1 elite | librarian | 10 | 16 | 96 |
| Act 1 mini-boss | tutor | 6 | 11 | 66 |
| Act 1 mini-boss | plagiarist | 7 | 11 | 66 |
| Act 1 mini-boss | card_catalogue | 8 | 12 | 72 |
| Act 1 mini-boss | headmistress | 8 | 13 | 78 |
| Act 1 mini-boss | study_group | 9 | 13 | 78 |
| Act 1 boss | final_exam | 12 | 27 | 162 |
| Act 1 boss | burning_deadline | 12 | 28 | 168 |

**Act 1 attack damage changes (~+50%):**
- `page_flutter`: attack 6/6→9/9, defend 7→9
- `thesis_construct`: attack 5→8, charge 8→12, defend 8→10, multi 3→5
- `mold_puff`: attack 5→8, attack weight 2→3, toxic cloud weight 3→2
- `ink_slug`: attack 6→9, defend 6→8, attack weight 2→3, bog grasp weight 3→2
- `bookmark_vine`: multi 3→5, single attack 5→8
- `staple_bug`: defend 8→10, attack 7→10, multi 4→6
- `margin_gremlin`: attack 6/5→9/8
- `index_weaver`: multi 4→6, attack 5→8
- `overdue_golem`: attack 5→8, attack weight 1→3, heal weight 2→1, debuff weight 2→1
- `pop_quiz`: attack 5→8, attack weight 1→3, debuff weights 2→1 each
- `eraser_worm`: multi 3→5, attack 5→8
- `plagiarist`: attack 5/4→8/6
- `card_catalogue`: multi 3→5, attack 5→8, heal weight 2→1, attack weight 1→2
- `headmistress`: defend 7→9 (weight 3→2), charge 7→10, attack 4→6 (weight 1→2)
- `tutor`: attack 5→8 (weight 1→3), debuff weights 2→1 each
- `study_group`: attack 5→8 (weight 1→2), defend 7→9, debuff weight 2→1
- `librarian` ph1: attack 4→6, defend 5→7, charge 7→10
- `librarian` ph2: attack 5→8, multi 3→5, charge 7→10
- `final_exam` ph1: attack 3→5, multi 4→6, defend 6→8
- `final_exam` ph2: attack 5→8, multi 4→6, defend 6→8, charge 8→12
- `burning_deadline` ph1: attack 3/4→5/6 (weight raised to 2 each)
- `burning_deadline` ph2: attack 5→8, multi 4→6

**Act 2 baseHP changes (~+20-30%):**
All Act 2 commons, elites, mini-bosses, and bosses raised proportionally. See individual enemy entries above.

**Act 2 attack/defend changes (~+25%):**
All Act 2 commons: attack 3→4, multi 2→3, defend 2→3. Elites/mini-bosses: attack 5→6, multi 3→4, defend 5→6, charge 6→7. Bosses: attack 4/5→5/6, multi 3→4, defend 5→6.

**Enrage constants also updated (same session, other agent):**
- `ENRAGE_PHASE1_BONUS`: 1 → 2 (+2 damage per enrage turn, was +1)
- `ENRAGE_PHASE2_BONUS`: 2 → 4 (was 2)
- Shallow startTurn: 12 → 8 (enrage pressure earlier in Act 1)

---

## Phase 8 — Elite Unique Mechanics (2026-04-09)

Four Act 1 elite/mini-boss encounters now have unique encounter mechanics that create novel strategic challenges.

### Librarian — Silence
- **Trigger:** `onEnemyTurnStart` — fires every enemy turn
- **Effect:** Picks a random card type from `['attack', 'shield', 'buff', 'debuff', 'utility', 'wild']` and sets `turnState.lockedCardType`
- **Result:** Player cannot play cards of that type for the upcoming player turn
- **Implementation:** `enemy._silencedCardType` set by callback, synced to `turnState.lockedCardType` in `endPlayerTurn()` after `dispatchEnemyTurnStart`. Cleared at start of next player turn in `endPlayerTurn()`'s per-turn reset block
- **Card play check:** `playCardAction` checks `turnState.lockedCardType` before AP validation; returns `blocked: true` if type matches

### Tutor — Pop Quiz (Wrong Answer Enrage)
- **Trigger:** `onPlayerChargeWrong` — fires on every incorrect Charge
- **Effect:** Sets `enemy._nextAttackDoubled = true`
- **Result:** Next `attack` intent deals ×2 damage. Flag cleared after it fires
- **Implementation:** Handled in `executeEnemyIntent()` attack case — doubles computed damage and clears the flag

### Headmistress — Detention
- **Trigger:** `onEncounterStart` — fires once after the opening hand is dealt
- **Effect:** Returns IDs of the 2 highest-mastery cards in hand + draw pile
- **Result:** Those 2 cards are moved to forgetPile before the encounter begins. Player fights without their strongest cards
- **Implementation:** Dispatched in `encounterBridge.startEncounterForRoom()` before `activeTurnState.set()`. Directly mutates `activeDeck` and syncs back to `turnState.deck`

### Study Group — Phase Simulation
- **HP raised:** 13 → 20 (simulates 3 members at ~6-7 HP each × 6.0× multiplier)
- **Phase transition:** 33% HP threshold (`phaseTransitionAt: 0.33`)
- **Phase 2:** Last member attacks solo — attack 11 (up from 8), fewer support actions
- **`onPhaseTransition`:** Removes 1 Strength stack from group synergy if buffed

---

## Phase 9 — Block-Strip Intents (2026-04-09)

Three Act 1 commons now have `strip_block` debuff intents that counter Fortress/block-stacking builds.

### strip_block Intent Mechanics
- **Intent type:** `debuff` with `statusEffect: { type: 'strip_block', value: N, turns: 0 }`
- **Effect:** Instantly removes up to `N` player block (clamped to current block)
- **Not a persistent status:** Resolved immediately in `endPlayerTurn()` after `executeEnemyIntent()` — never applied via `applyStatusEffect()`
- **Implementation:** `executeEnemyIntent()` sets `blockStripped` on return value; `endPlayerTurn()` reads it and reduces `playerState.shield`

### Block-Strip Enemies
| Enemy | Strip amount | Telegraph |
|---|---|---|
| `page_flutter` | 5 block | "Flutter dive" |
| `bookmark_vine` | 8 block | "Binding grip" |
| `staple_bug` | 10 block | "Pierce defense" |

---

## Balance Testing After Enemy Changes

After enemy stat changes, run `/balance-sim` for win rates, then `/advanced-balance` for tension metrics (HP-at-death, turns-to-outcome, meaningful-choice ratio). The basic sim says "win rate dropped 6%"; advanced balance says whether that's healthy tension or frustrating attrition.
