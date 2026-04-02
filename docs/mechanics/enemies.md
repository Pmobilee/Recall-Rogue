# Enemy System

> **Purpose:** Complete reference for the enemy roster, categories, scaling formulas, special behaviors, and encounter selection.
> **Last verified:** 2026-04-02
> **Source files:** `src/data/enemies.ts`, `src/services/enemyManager.ts`, `src/data/balance.ts`, `src/services/ascension.ts`

## Enemy Categories

| Category | Description | HP Range (base) |
|---|---|---|
| `common` | Standard combat nodes. Weighted random from act pool. | 25–40 (Act 1); 4–40 overall |
| `elite` | Elite nodes. More HP, phase transitions. | 7–12 |
| `mini_boss` | Gate encounters mid-act. | 6–9 |
| `boss` | Act-ending encounters. Two phases, high HP. | 11–19 |

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

| Segment | Floors | Cap |
|---|---|---|
| 1 | 1–6 | 6 |
| 2 | 7–12 | 12 |
| 3 | 13–18 | 18 |
| 4 | 19–24 | 28 |
| endless | 25+ | none |

### Ascension and Aura Scaling
- Ascension level 2+: `enemyDamageMultiplier = 1.10`
- `enemyHpMultiplier = 1.0` (no global HP mult; difficulty comes from elite design)
- High ascension: `miniBossBossTierAttacks` flag upgrades mini-boss intent pools to boss-tier attacks
- Brain Fog aura: all enemy attacks deal ×1.2 damage

### Act 1 Base Stats (2026-04-02 rebalance)
Act 1 commons were rebalanced from HP 7-9 to HP 25-40 and attack values 2-4 to 4-7.
Rationale: player deals 8-20 damage/turn, so 7-9 HP enemies died in 1-2 turns. 25-40 HP targets 4-7 turn combats.

| Enemy | Base HP | Attack intent value | Effective floor 1 damage (×1.2, cap 6) | Notes |
|---|---|---|---|---|
| `page_flutter` | 30 | 5 / 5 | 6 / 6 | Defend 4 |
| `thesis_construct` | 28 | 4 (atk) / 6 (charge) | 5 / cap-bypass | Defend 5; multi 2×2 kept |
| `mold_puff` | 27 | 5 | 6 | Primarily a debuffer |
| `ink_slug` | 32 | 5 | 6 | Defend 3; slow poisoner |
| `bookmark_vine` | 28 | 4 (single) | 5 | Multi 2×3 kept; chainVulnerable |
| `staple_bug` | 35 | 6 (snap) / 3×2 (chittering) | cap / cap | Defend 5; chargeResistant; highest-threat common |
| `margin_gremlin` | 30 | 5 / 4 | 6 / 5 | Self-buffs Strength |
| `index_weaver` | 28 | 3 per hit × 3 (barrage) | cap | Multi 3×3; chainVulnerable |
| `overdue_golem` | 40 | 4 | 5 | Heal 9/turn; tankiest common |
| `pop_quiz` | 27 | 4 | 5 | Quiz-reactive; stuns on correct Charge |
| `eraser_worm` | 25 | 4 (single) | 5 | Multi 2×4 kept; rare; chainVulnerable |

`thesis_construct`'s charge uses `bypassDamageCap: true` so the 6-base attack exceeds the floor 1 cap.
Status effect values (poison, weakness, vulnerable) kept at 1-2 per application — already impactful without scaling.

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

## Notable Enemies by Special Mechanic

### Common Enemies

| ID | base HP | Rarity | Special mechanic |
|---|---|---|---|
| `page_flutter` | 30 | standard | Can self-buff Strength 1 for 2 turns |
| `thesis_construct` | 28 | standard | `chargeResistant` — Quick Play deals 50% damage |
| `mold_puff` | 27 | standard | Stacks Poison 2 for 3 turns each attack |
| `crib_sheet` | 4 | standard | `onPlayerChargeWrong`: reflects card's base damage to player |
| `citation_needed` | 7 | standard | `onPlayerChargeWrong`: steals up to 5 block, heals enemy that amount. **Heal overshoot WAI**: heal intent (+5) and block-steal (+up to 5) are independent — both can fire in the same turn window for up to +10 HP total. **UX gap**: no floating text on block-steal; planned fix via ui-agent. |
| `pop_quiz` | 27 | uncommon | `onPlayerChargeCorrect`: stuns enemy next turn; `onPlayerNoCharge`: +1 permanent `enrageBonusDamage` |
| `eraser_worm` | 25 | rare | `chainVulnerable` — chain attacks deal +50% damage |
| `bookmark_vine` | 28 | uncommon | `chainVulnerable`; multi-hit 3×vine lash |
| `margin_gremlin` | 30 | uncommon | Self-buffs Strength 1 for 2 turns; fast repeated jabs |
| `index_weaver` | 28 | standard | `chainVulnerable`; multi-hit 3×3 fang barrage (3 per hit) + Poison 2×3 turns |
| `overdue_golem` | 40 | standard | Heals 9 HP per turn from bog absorption |
| `ink_slug` | 32 | standard | Stacks Poison 2 per attack; slow attacker |
| `staple_bug` | 35 | standard | `chargeResistant`; heavy Mandible snap (6) + 2-hit Chittering strike (3 per hit) |

### Elite Enemies

| ID | base HP | Special mechanic |
|---|---|---|
| `librarian` | 12 | Phase 2 at 40% HP — gains enraged smash + 3-hit rending claws |
| `bookwyrm` | 7 | **Deprecated** (not in ACT_ENEMY_POOLS); phase 2 at 50% |
| `peer_reviewer` | 7 | **Deprecated**; `onPlayerNoCharge` gains +3 permanent Strength (999 turns) |

### Mini-Boss Enemies

| ID | base HP | Special mechanic |
|---|---|---|
| `plagiarist` | 7 | `onEnemyTurnStart`: from turn 4 onward, gains +5 `enrageBonusDamage` every enemy turn |
| `tenure_guardian` | 8 | `onPlayerNoCharge`: gains +1 permanent Strength |
| `proctor` | 9 | `onPlayerNoCharge`: gains +1 Strength; telegraphs 5-damage Seismic Slam charge |
| `grade_dragon` | 8 | Fire breath + Poison 2×2 turns |
| `comparison_trap` | 6 | 3-hit phantom copies + vulnerable debuff |
| `textbook` | — | `hardcoverArmor: 16`; reduces Quick Play damage; -4 per correct Charge, +2 per wrong; breaking opens full damage |

### Boss Enemies

| ID | base HP | Phase trigger | Special mechanic |
|---|---|---|---|
| `final_exam` | 11 | 40% HP | Phase 2: 4-base Overdrive slam, 6-damage charged burst (`bypassDamageCap`) |
| `burning_deadline` | 11 | 40% HP | Phase 2: Volcanic blast (4 base) + Poison 4×3 rain |
| `algorithm` | 12 | 50% HP | Quiz phase at 50% HP (5 questions); heals 8–10 HP per turn |
| `curriculum` | 14 | 50% HP | `onPhaseTransition`: `_quickPlayDamageMultiplierOverride = 0` + +2 `enrageBonusDamage`; only Charge deals damage |
| `group_project` | 16 | 50% HP | Phase 2: 2-hit dual strike, 4-hit fang barrage, Poison 4×3 |
| `rabbit_hole` | 19 | — | Debuffs hand with vulnerable and weakness each turn; no phase transition |
| `omnibus` | 17 | 50% HP | Phase 2: 4-base attacks, 3-hit page storm, +3 Strength buff; charges 6-damage Tome Avalanche |
| `final_lesson` | 17 | 33% HP | Quiz phases at 66% HP (5q) and 33% HP (8q, 4s rapid-fire); `onPlayerChargeWrong`: +2 permanent Strength |

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
