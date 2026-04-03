# Enemy System

> **Purpose:** Complete reference for the enemy roster, categories, scaling formulas, special behaviors, and encounter selection.
> **Last verified:** 2026-04-03 (balance pass #3)
> **Source files:** `src/data/enemies.ts`, `src/services/enemyManager.ts`, `src/data/balance.ts`, `src/services/ascension.ts`

## Enemy Categories

| Category | Description | HP Range (base) |
|---|---|---|
| `common` | Standard combat nodes. Weighted random from act pool. | 5–16 (Act 1); 5–24 overall |
| `elite` | Elite nodes. More HP, phase transitions. | 12–22 |
| `mini_boss` | Gate encounters mid-act. | 13–22 |
| `boss` | Act-ending encounters. Two phases, high HP. | 18–25 |

## HP and Damage Scaling

HP formula (in `createEnemy`):
```
scaledHP = round(baseHP × ENEMY_BASE_HP_MULTIPLIER × getFloorScaling(floor) × hpMultiplier × difficultyVariance)
```
- `ENEMY_BASE_HP_MULTIPLIER = 4.0` (applied to all enemies)
- `getFloorScaling(floor) = 1.0 + (floor - 1) × 0.10` — +10% HP per floor
- `difficultyVariance`: 0.8–1.2 for common enemies

Damage formula (in `executeEnemyIntent`):
```
damage = round((intent.value + enrageBonusDamage) × strengthModifier × getFloorDamageScaling(floor))
```
- Floors 1–6: `FLOOR_DAMAGE_SCALE_MID = 1.0` (reduced from 1.2 in balance pass #2, 2026-04-03)
- Floors 7+: `1.0 + (floor - 6) × FLOOR_DAMAGE_SCALING_PER_FLOOR` (0.06 per floor above 6)

### Per-Turn Damage Caps (`ENEMY_TURN_DAMAGE_CAP`)
Charged attacks with `bypassDamageCap: true` skip these caps.

| Segment | Floors | Cap | Rationale |
|---|---|---|---|
| 1 | 1–6 | 8 | 8% of 100 HP/turn — raised from 6 (pass #1), scaled back from 10 (pass #2), kept at 8 (pass #3) |
| 2 | 7–12 | 12 | Original value — reverted from 14 (pass #2) in pass #3; Act 2/3 common HP reduction makes lower cap sufficient |
| 3 | 13–18 | 18 | Original value — reverted from 20 (pass #2) in pass #3 |
| 4 | 19–24 | 28 | Original value — reverted from 30 (pass #2) in pass #3 |
| endless | 25+ | none | — |

### Ascension and Aura Scaling
- Ascension level 2+: `enemyDamageMultiplier = 1.10`
- `enemyHpMultiplier = 1.0` (no global HP mult; difficulty comes from elite design)
- High ascension: `miniBossTierAttacks` flag upgrades mini-boss intent pools to boss-tier attacks
- Brain Fog aura: all enemy attacks deal ×1.2 damage

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

Mini-boss/elite/boss HP and attack values from pass #2 are intentional and remain in place.

---

## Act 1 Base Stats (2026-04-03 rebalance)

Act 1 commons reduced from HP 25–40 to HP 10–16. Attack values raised from 4–6 to 6–8 to compensate. Damage cap raised 6→10 so attacks feel meaningful.

| Enemy | Base HP | Attack intent value | Notes |
|---|---|---|---|
| `page_flutter` | 12 | 7 / 7 | Defend 7 |
| `thesis_construct` | 13 | 6 (atk) / 8 (charge) | Defend 8; multi 3×2; chargeResistant |
| `mold_puff` | 10 | 6 | Primarily a debuffer |
| `ink_slug` | 14 | 7 | Defend 6; slow poisoner |
| `bookmark_vine` | 11 | 6 (single) / 3×3 | chainVulnerable |
| `staple_bug` | 16 | 8 (snap) / 4×2 | Defend 8; chargeResistant |
| `margin_gremlin` | 12 | 7 / 6 | Self-buffs Strength |
| `index_weaver` | 11 | 4 per hit × 3 | Multi 4×3; chainVulnerable |
| `overdue_golem` | 15 | 6 | Heal 5/turn (reduced from 9); tankiest common |
| `pop_quiz` | 11 | 6 | Quiz-reactive |
| `eraser_worm` | 10 | 6 (single) / 3×4 | chainVulnerable; rare |

`thesis_construct`'s charge uses `bypassDamageCap: true` so the 8-base attack exceeds the floor 1 cap.
Status effect values (poison, weakness, vulnerable) kept at 1–2 per application — already impactful.

### Act 1 Elite
| Enemy | Base HP | Phase | Notes |
|---|---|---|---|
| `librarian` | 22 | 40% HP | Phase 1: attack 4, defend 5, charge 7. Phase 2: attack 5, multi 3×3, charge 7 |

### Act 1 Mini-Bosses
| Enemy | Base HP | Special |
|---|---|---|
| `plagiarist` | 18 | Enrages +5 dmg/turn from turn 4 |
| `card_catalogue` | 20 | Healer + multi-hit |
| `headmistress` | 20 | Heavy defender + charge 7 |
| `tutor` | 16 | Debuffer + healer |
| `study_group` | 22 | Poison + strength |

### Act 1 Bosses
| Enemy | Base HP | Phase | Notes |
|---|---|---|---|
| `final_exam` | 25 | 40% HP | Ph1: atk 5, multi 4×4, defend 6. Ph2: atk 7, multi 4×3, defend 6, charge 8 |
| `burning_deadline` | 25 | 40% HP | Ph1: atk 5×2. Ph2: atk 7, multi 4×4 |

---

## Act 2 Base Stats (2026-04-03 rebalance — pass #3 values)

Act 2 commons: baseHP 5–8 (Deep Caverns), 5–8 (The Abyss). Attack values 3 (reduced from 3–4 in pass #2). Multi per-hit 2. Defend 2–3.

### Deep Caverns Commons
| Enemy | Base HP | Atk | Notes |
|---|---|---|---|
| `crib_sheet` | 5 | 3 / multi 2×3 | Mirrors wrong Charge |
| `citation_needed` | 8 | 3 / defend 2 | Block-stealer on wrong Charge |
| `crambot` | 6 | 3 / defend 2 | chargeResistant |
| `all_nighter` | 6 | 3 / 3 | Weakness debuffer |
| `spark_note` | 6 | 3 / 3 | Poison |
| `watchdog` | 5 | multi 2×3 / 3 | chargeResistant |
| `red_herring` | 8 | 3 | Multi-debuffer |
| `anxiety_tick` | 8 | 3 | Self-healer |
| `trick_question` | 6 | 3 / 3 | Wrong Charge heals it |
| `dropout` | 8 | 3 / defend 2 | chargeResistant |
| `brain_fog` | 8 | 3 | Mastery eroder |
| `thesis_dragon` | 5 | multi 2×3 / 3 | chainVulnerable |
| `burnout` | 6 | 3 / 3 | Poison |
| `grade_curve` | 8 | 3 / defend 2 | Grows with correct Charges |

### The Abyss Commons
| Enemy | Base HP | Atk | Notes |
|---|---|---|---|
| `writers_block` | 5 | multi 2×4 / 3 | chainVulnerable |
| `information_overload` | 6 | 3 / 3 | Poison |
| `rote_memory` | 8 | 3 / defend 3 | chargeResistant |
| `outdated_fact` | 5 | multi 2×3 / 3 | chainVulnerable |
| `hidden_gem` | 8 | 3 / defend 3 | chargeResistant |
| `rushing_student` | 6 | multi 2×3 / 3 | chainVulnerable |
| `echo_chamber` | 5 | 3 / multi 2×3 | — |
| `blank_spot` | 7 | 3 / defend 3 | Gains 8 block on wrong Charge |
| `burnout_phantom` | 6 | 3 / 3 | Vulnerable debuffer |
| `prismatic_jelly` | 8 | 3 | Weakness + Vulnerable |
| `ember_skeleton` | 7 | 3 / multi 2×3 | chainVulnerable |

### Act 2 Elites
| Enemy | Base HP | Phase | Notes |
|---|---|---|---|
| `deadline_serpent` | 18 | 50% HP | Ph1: atk 5, multi 3×2. Ph2: atk 5, multi 3×3, charge 6 |
| `standardized_test` | 22 | — | defend 6, charge 6, atk 5 |
| `emeritus` | 22 | 50% HP | Ph1: defend 6, atk 5. Ph2: multi 3×3, charge 6 |
| `student_debt` | 16 | 40% HP | Ph1: atk 5, multi 3×3. Ph2: atk 5, multi 3×4 |
| `publish_or_perish` | 22 | — | Immune to natural_sciences; atk 5 |

### Act 2 Mini-Bosses
| Enemy | Base HP | Notes |
|---|---|---|
| `tenure_guardian` | 16 | Gains Str on no Charge; atk 5, defend 5 |
| `proctor` | 18 | Seismic Slam charge 6; defend 5, atk 5 |
| `harsh_grader` | 16 | Poison stacker; multi 3×3, atk 5 |
| `textbook` | 18 | Hardcover armor; charge 6, defend 5, atk 5 |
| `imposter_syndrome` | 16 | multi 3×3, atk 5 |
| `pressure_cooker` | 16 | atk 5, defend 5 |
| `grade_dragon` | 18 | Fire + Poison; atk 5/4 |
| `comparison_trap` | 14 | 3-hit phantom copies; multi 3×3, atk 4 |
| `perfectionist` | 20 | defend 5, charge 6, atk 5 |
| `hydra_problem` | 18 | multi 3×3, defend 5, atk 5 |
| `ivory_tower` | 16 | multi 3×3, atk 5 |
| `helicopter_parent` | 20 | multi 3×3, defend 5, atk 5 |

### Act 2 Bosses
| Enemy | Base HP | Phase | Notes |
|---|---|---|---|
| `algorithm` | 18 | 50% HP | Ph1: atk 4, defend 5, heal 5. Ph2: atk 5, multi 3×4, heal 6 |
| `curriculum` | 22 | 50% HP | Ph1: atk 4, defend 5, multi 3×3, heal 5. Ph2: QP=0; atk 5, defend 5, multi 3×4, heal 4 |
| `group_project` | 22 | 50% HP | Ph1: atk 4, multi 3×3. Ph2: multi 3×2, multi 3×4, atk 5 |
| `rabbit_hole` | 24 | — | atk 4, multi 3×3, defend 5 |

---

## Act 3 Base Stats (2026-04-03 rebalance — pass #3 values)

Act 3 commons: baseHP 6–9. Attack values 3 (reduced from 3–4 in pass #2). Multi per-hit 2. Defend 3.

### The Archive Commons
| Enemy | Base HP | Atk | Notes |
|---|---|---|---|
| `thesis_djinn` | 7 | 3 / 3 | chargeResistant |
| `gut_feeling` | 7 | 3 / multi 2×3 / 3 | — |
| `bright_idea` | 7 | 3 / 3 | Weakness debuffer |
| `sacred_text` | 8 | 3 / defend 3 | chargeResistant |
| `devils_advocate` | 7 | 3 | Poison + self-buff |
| `institution` | 9 | 3 / defend 3 / charge 5 | chargeResistant |
| `rosetta_slab` | 7 | 3 / defend 3 | Weakness |
| `moth_of_enlightenment` | 6 | 3 / 3 | Vulnerable |
| `hyperlink` | 6 | multi 2×3 / 3 | Poison |
| `unknown_unknown` | 7 | 3 | Weakness + Vulnerable |
| `fake_news` | 7 | 3 / multi 2×3 / defend 3 | chargeResistant |

### Act 3 Elites
| Enemy | Base HP | Notes |
|---|---|---|
| `dunning_kruger` | 12 | Flatlines chain multipliers at 1.0×; atk 5/4, defend 6 |
| `singularity` | 12 | QP deals 30% damage; atk 5/4, defend 6 |

### Act 3 Mini-Bosses
| Enemy | Base HP | Notes |
|---|---|---|
| `first_question` | 14 | Phase 2 at 50%; atk 5, multi 3×3, charge 7. Ph2: atk 5, multi 3×4 |
| `dean` | 14 | Gains Str on no Charge; atk 5, defend 6 |
| `dissertation` | 16 | defend 7, charge 7, atk 5 |
| `eureka` | 13 | Self-healer + debuffer; atk 5 |
| `paradigm_shift` | 16 | atk 5, charge 7, multi 3×3 |
| `ancient_tongue` | 14 | Gains Str on no Charge; defend 7, atk 5 |
| `lost_thesis` | 13 | atk 5, defend 6 |

### Act 3 Bosses
| Enemy | Base HP | Phase | Notes |
|---|---|---|---|
| `omnibus` | 24 | 50% HP | Ph1: atk 4/5, defend 5, charge 7. Ph2: atk 5, multi 4×3, charge 7 |
| `final_lesson` | 24 | 33% HP | Ph1: atk 5, multi 4×4. Ph2: atk 6, multi 4×4. Quiz phases at 66%+33% |

---

## Act Enemy Pools (`ACT_ENEMY_POOLS`)

Enemy selection uses `getEnemiesForNode(act, nodeType)` which maps to `ACT_ENEMY_POOLS`.

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
| `page_flutter` | 12 | standard | Can self-buff Strength 1 for 2 turns |
| `thesis_construct` | 13 | standard | `chargeResistant` — Quick Play deals 50% damage |
| `mold_puff` | 10 | standard | Stacks Poison 2 for 3 turns each attack |
| `crib_sheet` | 5 | standard | `onPlayerChargeWrong`: reflects card's base damage to player |
| `citation_needed` | 8 | standard | `onPlayerChargeWrong`: steals up to 5 block, heals enemy that amount. **Heal overshoot WAI**: heal intent (+5) and block-steal (+up to 5) are independent — both can fire in the same turn window for up to +10 HP total. **UX gap**: no floating text on block-steal; planned fix via ui-agent. |
| `pop_quiz` | 11 | uncommon | `onPlayerChargeCorrect`: stuns enemy next turn; `onPlayerNoCharge`: +1 permanent `enrageBonusDamage` |
| `eraser_worm` | 10 | rare | `chainVulnerable` — chain attacks deal +50% damage |
| `bookmark_vine` | 11 | uncommon | `chainVulnerable`; multi-hit 3×vine lash |
| `margin_gremlin` | 12 | uncommon | Self-buffs Strength 1 for 2 turns; fast repeated jabs |
| `index_weaver` | 11 | standard | `chainVulnerable`; multi-hit 4×3 fang barrage + Poison 2×3 turns |
| `overdue_golem` | 15 | standard | Heals 5 HP per turn (reduced from 9, 2026-04-03) |
| `ink_slug` | 14 | standard | Stacks Poison 2 per attack; slow attacker |
| `staple_bug` | 16 | standard | `chargeResistant`; Mandible snap (8) + 2-hit Chittering strike (4 per hit) |

### Elite Enemies

| ID | base HP | Special mechanic |
|---|---|---|
| `librarian` | 22 | Phase 2 at 40% HP — gains enraged smash + 3-hit rending claws |
| `bookwyrm` | 7 | **Deprecated** (not in ACT_ENEMY_POOLS); phase 2 at 50% |
| `peer_reviewer` | 7 | **Deprecated**; `onPlayerNoCharge` gains +3 permanent Strength (999 turns) |

### Mini-Boss Enemies

| ID | base HP | Special mechanic |
|---|---|---|
| `plagiarist` | 18 | `onEnemyTurnStart`: from turn 4 onward, gains +5 `enrageBonusDamage` every enemy turn |
| `tenure_guardian` | 16 | `onPlayerNoCharge`: gains +1 permanent Strength |
| `proctor` | 18 | `onPlayerNoCharge`: gains +1 Strength; telegraphs 7-damage Seismic Slam charge |
| `grade_dragon` | 18 | Fire breath + Poison 2×2 turns |
| `comparison_trap` | 14 | 3-hit phantom copies + vulnerable debuff |
| `textbook` | 18 | `hardcoverArmor: 16`; reduces Quick Play damage; -4 per correct Charge, +2 per wrong; breaking opens full damage |

### Boss Enemies

| ID | base HP | Phase trigger | Special mechanic |
|---|---|---|---|
| `final_exam` | 25 | 40% HP | Phase 2: 7-base Overdrive slam, 8-damage charged burst (`bypassDamageCap`) |
| `burning_deadline` | 25 | 40% HP | Phase 2: Volcanic blast (7 base) + Poison 4×3 rain |
| `algorithm` | 18 | 50% HP | Quiz phase at 50% HP (5 questions); heals 5–6 HP per turn |
| `curriculum` | 22 | 50% HP | `onPhaseTransition`: `_quickPlayDamageMultiplierOverride = 0` + +2 `enrageBonusDamage`; only Charge deals damage |
| `group_project` | 22 | 50% HP | Phase 2: 2-hit dual strike, 4-hit fang barrage, Poison 4×3 |
| `rabbit_hole` | 24 | — | Debuffs hand with vulnerable and weakness each turn; no phase transition |
| `omnibus` | 24 | 50% HP | Phase 2: 6-base attacks, 5-hit page storm, +3 Strength buff; charges 8-damage Tome Avalanche |
| `final_lesson` | 24 | 33% HP | Quiz phases at 66% HP (5q) and 33% HP (8q, 4s rapid-fire); `onPlayerChargeWrong`: +2 permanent Strength |

---

## Intent System

Enemies telegraph next action via `EnemyIntent.telegraph`. Selected by `weightedRandomIntent()` (weighted random).

| Type | Effect |
|---|---|
| `attack` | `round(value × strengthMod × floorDamageScaling)` damage |
| `multi_attack` | Above × `hitCount` hits |
| `defend` | Adds `value` to enemy block (resets at enemy turn start) |
| `buff` | Applies status effect to self (e.g., Strength) |
| `debuff` | Applies status effect to player |
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

`chainMultiplierOverride` (used by The Nullifier): forces all Knowledge Chain multipliers to a fixed value while the enemy is alive.

## Balance Testing After Enemy Changes

After enemy stat changes, run `/balance-sim` for win rates, then `/advanced-balance` for tension metrics (HP-at-death, turns-to-outcome, meaningful-choice ratio). The basic sim says "win rate dropped 6%"; advanced balance says whether that's healthy tension or frustrating attrition.
