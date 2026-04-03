# Enemy System

> **Purpose:** Complete reference for the enemy roster, categories, scaling formulas, special behaviors, and encounter selection.
> **Last verified:** 2026-04-03
> **Source files:** `src/data/enemies.ts`, `src/services/enemyManager.ts`, `src/data/balance.ts`, `src/services/ascension.ts`

## Enemy Categories

| Category | Description | HP Range (base) |
|---|---|---|
| `common` | Standard combat nodes. Weighted random from act pool. | 8–16 (Act 1); 8–24 overall |
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
- Floors 1–6: `FLOOR_DAMAGE_SCALE_MID = 1.2`
- Floors 7+: `1.0 + (floor - 6) × FLOOR_DAMAGE_SCALING_PER_FLOOR` (0.06 per floor above 6)

### Per-Turn Damage Caps (`ENEMY_TURN_DAMAGE_CAP`)
Charged attacks with `bypassDamageCap: true` skip these caps.

| Segment | Floors | Cap | Rationale |
|---|---|---|---|
| 1 | 1–6 | 10 | 10% of 100 HP/turn — creates real tension (raised from 6, 2026-04-03) |
| 2 | 7–12 | 16 | 16% of 100 HP/turn (raised from 12, 2026-04-03) |
| 3 | 13–18 | 22 | Raised from 18 (2026-04-03) |
| 4 | 19–24 | 32 | Raised from 28 (2026-04-03) |
| endless | 25+ | none | — |

### Ascension and Aura Scaling
- Ascension level 2+: `enemyDamageMultiplier = 1.10`
- `enemyHpMultiplier = 1.0` (no global HP mult; difficulty comes from elite design)
- High ascension: `miniBossTierAttacks` flag upgrades mini-boss intent pools to boss-tier attacks
- Brain Fog aura: all enemy attacks deal ×1.2 damage

---

## 2026-04-03 Comprehensive Rebalance

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

## Act 2 Base Stats (2026-04-03 rebalance)

Act 2 commons: baseHP 8–13. Attack values raised from 2–3 to 4–6. Defend raised from 1–2 to 5–6.

### Deep Caverns Commons
| Enemy | Base HP | Atk | Notes |
|---|---|---|---|
| `crib_sheet` | 8 | 4 / multi 4×3 | Mirrors wrong Charge |
| `citation_needed` | 12 | 5 | Block-stealer on wrong Charge |
| `crambot` | 10 | 5 / defend 5 | chargeResistant |
| `all_nighter` | 9 | 5 / 4 | Weakness debuffer |
| `spark_note` | 9 | 5 / 4 | Poison |
| `watchdog` | 8 | multi 4×3 / 4 | chargeResistant |
| `red_herring` | 12 | 5 | Multi-debuffer |
| `anxiety_tick` | 12 | 5 | Self-healer |
| `trick_question` | 10 | 5 / 4 | Wrong Charge heals it |
| `dropout` | 12 | 5 / defend 6 | chargeResistant |
| `brain_fog` | 12 | 5 | Mastery eroder |
| `thesis_dragon` | 8 | multi 4×3 / 5 | chainVulnerable |
| `burnout` | 10 | 5 / 4 | Poison |
| `grade_curve` | 11 | 5 / defend 5 | Grows with correct Charges |

### The Abyss Commons
| Enemy | Base HP | Atk | Notes |
|---|---|---|---|
| `writers_block` | 9 | multi 4×4 / 5 | chainVulnerable |
| `information_overload` | 10 | 5 / 4 | Poison |
| `rote_memory` | 13 | 5 / defend 6 | chargeResistant |
| `outdated_fact` | 8 | multi 4×3 / 5 | chainVulnerable |
| `hidden_gem` | 12 | 5 / defend 6 | chargeResistant |
| `rushing_student` | 10 | multi 4×3 / 5 | chainVulnerable |
| `echo_chamber` | 8 | 5 / multi 4×3 | — |
| `blank_spot` | 11 | 5 / defend 6 | Gains 8 block on wrong Charge |
| `burnout_phantom` | 10 | 5 / 4 | Vulnerable debuffer |
| `prismatic_jelly` | 13 | 5 | Weakness + Vulnerable |
| `ember_skeleton` | 11 | 5 / multi 4×3 | chainVulnerable |

### Act 2 Elites
| Enemy | Base HP | Phase | Notes |
|---|---|---|---|
| `deadline_serpent` | 18 | 50% HP | Ph1: atk 6, multi 4×2. Ph2: atk 6, multi 4×3, charge 7 |
| `standardized_test` | 22 | — | defend 7, charge 7, atk 6 |
| `emeritus` | 22 | 50% HP | Ph1: defend 7, atk 6. Ph2: multi 4×3, charge 7 |
| `student_debt` | 16 | 40% HP | Ph1: atk 6, multi 4×3. Ph2: atk 6, multi 4×4 |
| `publish_or_perish` | 22 | — | Immune to natural_sciences; atk 6 |

### Act 2 Mini-Bosses
| Enemy | Base HP | Notes |
|---|---|---|
| `tenure_guardian` | 16 | Gains Str on no Charge; atk 6, defend 7 |
| `proctor` | 18 | Seismic Slam charge 7; defend 7, atk 6 |
| `harsh_grader` | 16 | Poison stacker; multi 4×3, atk 6 |
| `textbook` | 18 | Hardcover armor; charge 7, defend 7, atk 6 |
| `imposter_syndrome` | 16 | multi 4×3, atk 6 |
| `pressure_cooker` | 16 | atk 6, defend 7 |
| `grade_dragon` | 18 | Fire + Poison; atk 6/5 |
| `comparison_trap` | 14 | 3-hit phantom copies; multi 4×3, atk 5 |
| `perfectionist` | 20 | defend 7, charge 7, atk 6 |
| `hydra_problem` | 18 | multi 4×3, defend 7, atk 6 |
| `ivory_tower` | 16 | multi 4×3, atk 6 |
| `helicopter_parent` | 20 | multi 4×3, defend 7, atk 6 |

### Act 2 Bosses
| Enemy | Base HP | Phase | Notes |
|---|---|---|---|
| `algorithm` | 18 | 50% HP | Ph1: atk 5, defend 6, heal 5. Ph2: atk 6, multi 4×4, heal 6 |
| `curriculum` | 22 | 50% HP | Ph1: atk 5, defend 6, multi 4×3, heal 5. Ph2: QP=0; atk 6, defend 7, multi 4×4, heal 4 |
| `group_project` | 22 | 50% HP | Ph1: atk 5, multi 4×3. Ph2: multi 4×2, multi 4×4, atk 6 |
| `rabbit_hole` | 24 | — | atk 6, multi 4×3, defend 6 |

---

## Act 3 Base Stats (2026-04-03 rebalance)

Act 3 commons: baseHP 8–12. Attack values raised from 2–3 to 5–6. Defend raised from 1–2 to 6–8.

### The Archive Commons
| Enemy | Base HP | Atk | Notes |
|---|---|---|---|
| `thesis_djinn` | 9 | 5 / 5 | chargeResistant |
| `gut_feeling` | 9 | 5 / multi 4×3 / 5 | — |
| `bright_idea` | 8 | 5 / 5 | Weakness debuffer |
| `sacred_text` | 11 | 5 / defend 6 | chargeResistant |
| `devils_advocate` | 9 | 5 | Poison + self-buff |
| `institution` | 12 | 5 / defend 6 / charge 6 | chargeResistant |
| `rosetta_slab` | 9 | 5 / defend 6 | Weakness |
| `moth_of_enlightenment` | 8 | 5 / 5 | Vulnerable |
| `hyperlink` | 8 | multi 4×3 / 5 | Poison |
| `unknown_unknown` | 9 | 5 | Weakness + Vulnerable |
| `fake_news` | 9 | 5 / multi 4×3 / defend 6 | chargeResistant |

### Act 3 Elites
| Enemy | Base HP | Notes |
|---|---|---|
| `dunning_kruger` | 12 | Flatlines chain multipliers at 1.0×; atk 6, defend 7 |
| `singularity` | 12 | QP deals 30% damage; atk 6, defend 7 |

### Act 3 Mini-Bosses
| Enemy | Base HP | Notes |
|---|---|---|
| `first_question` | 14 | Phase 2 at 50%; atk 6, multi 4×3, charge 8 |
| `dean` | 14 | Gains Str on no Charge; atk 6, defend 7 |
| `dissertation` | 16 | defend 8, charge 8, atk 6 |
| `eureka` | 13 | Self-healer + debuffer; atk 6 |
| `paradigm_shift` | 16 | atk 6, charge 8, multi 4×3 |
| `ancient_tongue` | 14 | Gains Str on no Charge; defend 8, atk 6 |
| `lost_thesis` | 13 | atk 6, defend 7 |

### Act 3 Bosses
| Enemy | Base HP | Phase | Notes |
|---|---|---|---|
| `omnibus` | 24 | 50% HP | Ph1: atk 5/6, defend 6, charge 8. Ph2: atk 6, multi 5×3, charge 8 |
| `final_lesson` | 24 | 33% HP | Ph1: atk 6, multi 5×4. Ph2: atk 7, multi 5×4. Quiz phases at 66%+33% |

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
| `crib_sheet` | 8 | standard | `onPlayerChargeWrong`: reflects card's base damage to player |
| `citation_needed` | 12 | standard | `onPlayerChargeWrong`: steals up to 5 block, heals enemy that amount. **Heal overshoot WAI**: heal intent (+5) and block-steal (+up to 5) are independent — both can fire in the same turn window for up to +10 HP total. **UX gap**: no floating text on block-steal; planned fix via ui-agent. |
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
