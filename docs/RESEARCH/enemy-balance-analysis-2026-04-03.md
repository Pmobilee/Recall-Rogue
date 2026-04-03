# Enemy Balance Overhaul — Comprehensive Analysis (2026-04-03)

## Executive Summary

Act 1 commons are absurdly tanky (100-160 effective HP) due to a recent rebalance that set baseHP 25-40
on top of the 4.0x HP multiplier. Meanwhile mini-bosses (36-42 HP) are weaker than commons, bosses
barely exceed commons, and Act 2/3 enemies deal pathetic damage (2-3 base). This document models the
full player power curve and proposes a complete enemy stat rebalance.

---

## 1. Current System Mechanics

### HP Formula
```
scaledHP = round(baseHP * 4.0 * getFloorScaling(floor) * hpMultiplier * difficultyVariance)
```

### Floor HP Scaling (per segment)
| Floor | Segment | Rate | Scaling |
|-------|---------|------|---------|
| 1 | 1 | 0.10 | 1.00 |
| 3 | 1 | 0.10 | 1.20 |
| 6 | 1 | 0.10 | 1.50 |
| 8 | 2 | 0.25 | 2.75 |
| 9 | 2 | 0.25 | 3.00 |
| 12 | 2 | 0.25 | 3.75 |
| 13 | 3 | 0.60 | 8.20 |
| 16 | 3 | 0.60 | 10.0 |
| 18 | 3 | 0.60 | 11.2 |
| 21 | 4 | 0.80 | 17.0 |
| 24 | 4 | 0.80 | 19.4 |

### Damage Formula
```
damage = round((intent.value + enrageBonusDamage) * strengthMod * floorDamageScaling)
```
- Floors 1-6: scale = 1.2
- Floors 7+: scale = 1.2 + (floor-6) * 0.06

### Current Damage Caps (per turn)
| Segment | Cap |
|---------|-----|
| 1 | 6 |
| 2 | 12 |
| 3 | 18 |
| 4 | 28 |

---

## 2. Player Power Curve Model

### Starting Deck
5 Strike (QP 4), 4 Block (QP 5), 1 Foresight (draw 2). 3 AP/turn, hand of 5.

### Key Multipliers
- **CHARGE_AP_SURCHARGE = 0** (charging is free!)
- **CC multiplier = 1.75x** (applied to quickPlayValue + masteryBonus)
- **Mastery bonus** = perLevelDelta * level (strike: 1.2/level)
- **Chain multipliers** = [1.0, 1.2, 1.5, 2.0, 2.5, 3.5]
- **Surge** = every 4th turn, 1.5x CC bonus

### Strike Damage at Various Mastery Levels
| Mastery | QP | CC (correct) | CC + Chain 3 |
|---------|----|-----------|-----------|
| 0 | 4 | 7.0 | 14.0 |
| 1 | 4 | 9.1 | 18.2 |
| 2 | 4 | 11.2 | 22.4 |
| 3 | 4 | 13.3 | 26.6 |
| 4 | 4 | 15.4 | 30.8 |
| 5 | 4 | 17.5 | 35.0 |

### Estimated Damage Per Turn (3 AP, realistic play mix)
| Floor | Mastery | Play Style | Dmg/Turn |
|-------|---------|------------|----------|
| 1-2 | 0 | QP focused (3 strikes) | 12 |
| 1-2 | 0 | Mixed (1CC + 2QP) | 15 |
| 1-2 | 0 | All CC correct | 21 |
| 3-4 | 1 | Mixed CC/QP | 20-25 |
| 5-6 | 2 | CC + early chains | 28-38 |
| 7-8 | 2-3 | CC + chains | 32-48 |
| 9-10 | 3 | CC + chain 2 | 40-60 |
| 11-12 | 3-4 | CC + chain 2-3 | 50-70 |
| 13-15 | 4 | CC + chain 3 | 60-90 |
| 16-18 | 4-5 | CC + chain 3-4 | 80-130 |
| 19-21 | 5 | CC + chain 4-5 | 100-180 |
| 22-24 | 5 | CC + chain 5 + relics | 130-200+ |

---

## 3. Current Problems (Specific Numbers)

### Problem 1: Act 1 Commons are Unkillable
| Enemy | baseHP | Effective HP (floor 1) | Turns to Kill (QP) | Turns to Kill (CC) |
|-------|--------|----------------------|--------------------|--------------------|
| page_flutter | 30 | **120** | 10 | 5.7 |
| overdue_golem | 40 | **160** (+heal 9/t) | 26+ (net 3/t) | 7.6 |
| staple_bug | 35 | **140** | 11.7 | 6.7 |
| Average | 30 | **120** | **10** | **5.7** |

**Target: 3-4 turns.** Currently 3-10x too long.

### Problem 2: Mini-Bosses are Weaker Than Commons
| Enemy | baseHP | Eff HP (floor 5) | Compare to Common |
|-------|--------|------------------|-------------------|
| plagiarist (mini-boss) | 7 | **39** | Page Flutter: **120** |
| card_catalogue (mini-boss) | 8 | **45** | Overdue Golem: **160** |
| tutor (mini-boss) | 6 | **34** | Staple Bug: **140** |

Mini-bosses have **1/3 to 1/4** the HP of commons they're supposed to be harder than.

### Problem 3: Bosses Barely Exceed Commons
| Enemy | baseHP | Eff HP (floor 8) | Compare to Floor 1 Common |
|-------|--------|------------------|---------------------------|
| final_exam (boss) | 11 | **121** | page_flutter: **120** |
| burning_deadline (boss) | 11 | **121** | overdue_golem: **160** |

Act 1 bosses have the SAME HP as floor 1 commons.

### Problem 4: Act 2/3 Enemy Damage is Pathetic
| Enemy | Attack Base | Scaled (floor 9) | vs 100 HP Player |
|-------|------------|------------------|------------------|
| crambot | 2 | 2.8 → 3 | 3% per hit |
| spark_note | 2 | 2.8 → 3 | 3% per hit |
| thesis_dragon | 2×3 hits | 2.8×3 → 9 | 9% per multi |

With player having 100 HP, 3 damage per hit means 33 turns to kill the player. No tension.

### Problem 5: Enemy Block is Meaningless
Act 2/3 enemies block 1-2 damage. Player does 35-65/turn. Block absorbs 1-5% of incoming damage.

---

## 4. Reference: Slay the Spire Design Principles

- **Common enemies die in 2-3 turns** (44-56 HP, player deals ~18-25/turn)
- **Elites die in 5-8 turns** (65-110 HP with special mechanics)
- **Bosses die in 10-15 turns** (250-800 HP with phases)
- **Enemy damage per hit = 8-15%** of player HP in Act 1
- **Each fight costs 15-30% of player HP** — resource drain across the act
- **Power growth is gradual** — player damage roughly doubles per act, enemy HP triples
- **Block is meaningful** — enemies block 20-40% of player damage when defending

### Key Design Rules
1. **3-5 turn common fights** — short enough to stay exciting, long enough for decisions
2. **Bosses/elites must be clearly harder than commons** — HP, damage, and mechanics
3. **Enemy damage creates tension** — if enemies can't threaten the player, combat is a chore
4. **Block should delay kills by 1-2 turns** — not trivially ignorable
5. **Healing enemies require charging to overcome** — good incentive alignment for our game

---

## 5. Proposed Rebalance

### Design Targets (turns to kill)
| Category | Target Turns | Player Dmg/Turn (est) | Target Eff HP |
|----------|-------------|----------------------|---------------|
| Act 1 common | 3-4 | 14-18 | 42-72 |
| Act 1 elite | 5-7 | 18-25 | 90-175 |
| Act 1 mini-boss | 5-7 | 18-25 | 90-175 |
| Act 1 boss | 8-12 | 22-35 | 176-420 |
| Act 2 common | 3-5 | 40-55 | 120-275 |
| Act 2 elite | 5-7 | 45-60 | 225-420 |
| Act 2 mini-boss | 5-7 | 45-60 | 225-420 |
| Act 2 boss | 8-12 | 55-75 | 440-900 |
| Act 3 common | 3-5 | 80-130 | 240-650 |
| Act 3 mini-boss | 5-8 | 90-150 | 450-1200 |
| Act 3 boss | 10-14 | 100-180 | 1000-2520 |

### 5a. Proposed baseHP Changes

#### Act 1 Commons (baseHP 25-40 → 10-16)
| Enemy | Old | New | Eff HP (F1) | Rationale |
|-------|-----|-----|-------------|-----------|
| page_flutter | 30 | 12 | 48 | Standard, fast |
| thesis_construct | 28 | 13 | 52 | chargeResistant: slightly more HP |
| mold_puff | 27 | 10 | 40 | Glass debuffer — kill fast or die to poison |
| ink_slug | 32 | 14 | 56 | Tanky poisoner |
| bookmark_vine | 28 | 11 | 44 | chainVulnerable: burstable |
| staple_bug | 35 | 16 | 64 | Toughest common: chargeResistant |
| margin_gremlin | 30 | 12 | 48 | Str buffer, moderate |
| index_weaver | 28 | 11 | 44 | chainVulnerable, multi-hit |
| overdue_golem | 40 | 15 | 60 | Healer, needs time to heal (reduce heal 9→5) |
| pop_quiz | 27 | 11 | 44 | Quiz-reactive |
| eraser_worm | 25 | 10 | 40 | Rare, chainVulnerable |

#### Act 1 Elite (baseHP 12 → 22)
| Enemy | Old | New | Eff HP (F4) | Rationale |
|-------|-----|-----|-------------|-----------|
| librarian | 12 | 22 | 114 | Phase 2 at 40% adds effective time |

#### Act 1 Mini-Bosses (baseHP 6-8 → 16-22)
| Enemy | Old | New | Eff HP (F5) | Rationale |
|-------|-----|-----|-------------|-----------|
| plagiarist | 7 | 18 | 101 | Enrage mechanic, time pressure |
| card_catalogue | 8 | 20 | 112 | Standard mini-boss |
| headmistress | 8 | 20 | 112 | Standard |
| tutor | 6 | 16 | 90 | Lighter mini-boss |
| study_group | 8 | 22 | 123 | Multi-phase feel |

#### Act 1 Bosses (baseHP 11 → 25)
| Enemy | Old | New | Eff HP (F8) | Rationale |
|-------|-----|-----|-------------|-----------|
| final_exam | 11 | 25 | 275 | Phase 2 at 40% |
| burning_deadline | 11 | 25 | 275 | Poison pressure |

#### Act 2 Commons — deep_caverns (baseHP 4-7 → 8-12)
| Enemy | Old | New | Eff HP (F9) | Rationale |
|-------|-----|-----|-------------|-----------|
| crib_sheet | 4 | 8 | 96 | Glass mirror |
| citation_needed | 7 | 12 | 144 | Healer/stealer |
| crambot | 5 | 10 | 120 | chargeResistant |
| all_nighter | 5 | 9 | 108 | Weakness debuffer |
| spark_note | 5 | 9 | 108 | Poison |
| watchdog | 4 | 8 | 96 | Glass multi-hit |
| red_herring | 7 | 12 | 144 | Tanky debuffer |
| anxiety_tick | 7 | 12 | 144 | Self-healer |
| trick_question | 5 | 10 | 120 | Quiz-reactive |
| dropout | 7 | 12 | 144 | chargeResistant |
| brain_fog | 7 | 12 | 144 | Mastery eroder |
| thesis_dragon | 4 | 8 | 96 | Glass multi |
| burnout | 5 | 10 | 120 | Standard |
| grade_curve | 7 | 11 | 132 | Mid |

#### Act 2 Commons — the_abyss (baseHP 4-7 → 8-13)
| Enemy | Old | New | Eff HP (F10) | Rationale |
|-------|-----|-----|-------------|-----------|
| writers_block | 4 | 9 | 117 | Glass |
| information_overload | 5 | 10 | 130 | Standard |
| rote_memory | 7 | 13 | 169 | Tanky |
| outdated_fact | 4 | 8 | 104 | Glass |
| hidden_gem | 7 | 12 | 156 | Tanky |
| rushing_student | 5 | 10 | 130 | Standard |
| echo_chamber | 4 | 8 | 104 | Glass |
| blank_spot | 6 | 11 | 143 | Mid |
| burnout_phantom | 5 | 10 | 130 | Standard |
| prismatic_jelly | 7 | 13 | 169 | Tanky |
| ember_skeleton | 6 | 11 | 143 | Mid |

#### Act 2 Elites (baseHP 7-12 → 16-22)
| Enemy | Old | New | Eff HP (F10) | Rationale |
|-------|-----|-----|-------------|-----------|
| deadline_serpent | 7 | 18 | 234 | Phase 2 |
| standardized_test | 12 | 22 | 286 | Tanky |
| emeritus | 12 | 22 | 286 | Tanky |
| student_debt | 7 | 16 | 208 | Glass elite |
| publish_or_perish | 12 | 22 | 286 | Tanky |

#### Act 2 Mini-Bosses (baseHP 6-9 → 14-20)
| Enemy | Old | New | Eff HP (F11) | Rationale |
|-------|-----|-----|-------------|-----------|
| tenure_guardian | 8 | 16 | 224 | Str on no-charge |
| proctor | 9 | 18 | 252 | Seismic slam |
| harsh_grader | 8 | 16 | 224 | Standard |
| textbook | 8 | 18 | 252 | Hardcover armor |
| imposter_syndrome | 8 | 16 | 224 | Standard |
| pressure_cooker | 8 | 16 | 224 | Standard |
| grade_dragon | 8 | 18 | 252 | Fire+poison |
| comparison_trap | 6 | 14 | 196 | Lighter |
| perfectionist | 9 | 20 | 280 | Tough |
| hydra_problem | 8 | 18 | 252 | Multi-head |
| ivory_tower | 8 | 16 | 224 | Standard |
| helicopter_parent | 9 | 20 | 280 | Tough |

#### Act 2 Bosses (baseHP 12-19 → 18-24)
| Enemy | Old | New | Eff HP (F14) | Rationale |
|-------|-----|-----|-------------|-----------|
| algorithm | 12 | 18 | 634 | Quiz phase + heals |
| curriculum | 14 | 22 | 774 | Phase 2 QP immunity |
| group_project | 16 | 22 | 774 | Phase 2 multi-hit |
| rabbit_hole | 19 | 24 | 845 | No phase, tanky |

#### Act 3 Commons (baseHP 5-8 → 8-12)
| Enemy | Old | New | Eff HP (F18) | Rationale |
|-------|-----|-----|-------------|-----------|
| thesis_djinn | 6 | 9 | 403 | Standard |
| gut_feeling | 6 | 9 | 403 | Standard |
| bright_idea | 6 | 8 | 358 | Light |
| sacred_text | 7 | 11 | 493 | Tanky |
| devils_advocate | 6 | 9 | 403 | Standard |
| institution | 8 | 12 | 538 | Tankiest |
| rosetta_slab | 6 | 9 | 403 | Standard |
| moth_of_enlightenment | 5 | 8 | 358 | Light |
| hyperlink | 5 | 8 | 358 | Light |
| unknown_unknown | 6 | 9 | 403 | Standard |
| fake_news | 6 | 9 | 403 | Standard |

#### Act 3 Elites (baseHP 9 → 12)
| Enemy | Old | New | Eff HP (F19) | Rationale |
|-------|-----|-----|-------------|-----------|
| dunning_kruger | 9 | 12 | 739 | Standard |
| singularity | 9 | 12 | 739 | Standard |

#### Act 3 Mini-Bosses (baseHP 8-11 → 13-16)
| Enemy | Old | New | Eff HP (F20) | Rationale |
|-------|-----|-----|-------------|-----------|
| first_question | 9 | 14 | 907 | Standard |
| dean | 9 | 14 | 907 | Phase 2 |
| dissertation | 11 | 16 | 1037 | Toughest |
| eureka | 9 | 13 | 843 | Lighter |
| paradigm_shift | 11 | 16 | 1037 | Tough |
| ancient_tongue | 9 | 14 | 907 | Standard |
| lost_thesis | 8 | 13 | 843 | Standard |

#### Act 3 Bosses (baseHP 17 → 24)
| Enemy | Old | New | Eff HP (F23) | Rationale |
|-------|-----|-----|-------------|-----------|
| omnibus | 17 | 24 | 1786 | Phase 2 |
| final_lesson | 17 | 24 | 1786 | Quiz phases |

### 5b. Proposed Attack Value Changes

#### Segment 1 Damage Cap: 6 → 10
Allows enemies to deal meaningful damage. 10/turn vs 100 HP = 10% per turn, creating real tension.

#### Segment 2 Damage Cap: 12 → 16
Matches increased player power. 16 vs 100 HP = 16% per turn.

#### Act 1 Commons: raise attack bases from 4-6 to 6-8
| Enemy | Old Attack | New Attack | Scaled (F1) |
|-------|-----------|-----------|-------------|
| page_flutter | 5/5 | 7/7 | 8/8 |
| thesis_construct | 4/6(charge) | 6/8(charge) | 7/10 |
| mold_puff | 5 | 6 | 7 |
| ink_slug | 5 | 7 | 8 |
| bookmark_vine | 4/2×3 | 6/3×3 | 7/4×3=12(cap10) |
| staple_bug | 6/3×2 | 8/4×2 | 10/5×2=10 |
| margin_gremlin | 5/4 | 7/6 | 8/7 |
| index_weaver | 3×3 | 4×3 | 5×3=15(cap10) |
| overdue_golem | 4 | 6 | 7 |
| pop_quiz | 4 | 6 | 7 |
| eraser_worm | 4/2×4 | 6/3×4 | 7/4×4=16(cap10) |

#### Act 1 Block Values: raise from 4-5 to 6-10
| Enemy | Old Block | New Block |
|-------|----------|----------|
| page_flutter | 4 | 7 |
| thesis_construct | 5 | 8 |
| ink_slug | 3 | 6 |
| staple_bug | 5 | 8 |
| dropout | 2 | 6 |

#### Act 2/3 Commons: raise attack bases from 2-3 to 4-7
These enemies currently deal 2-3 base damage which scales to only 3-6 in their floor range.
New values of 4-7 produce 6-12 scaled damage — much more meaningful.

#### Act 2/3 Block Values: raise from 1-2 to 4-8
Currently 1-2 block is invisible against 35-65 player damage.
4-8 block absorbs 6-23% of damage — forces an extra turn occasionally.

### 5c. Overdue Golem Heal Reduction
- Old: heal 9/turn
- New: heal 5/turn
- At 60 HP with QP (12/turn): net 7/turn → 8.6 turns. Still incentivizes charging.
- At 60 HP with CC (21/turn): net 16/turn → 3.8 turns. Good.

### 5d. Floor Damage Scale Adjustment
FLOOR_DAMAGE_SCALE_MID stays at 1.2 (works for Act 1).
No change to FLOOR_DAMAGE_SCALING_PER_FLOOR (0.06).

---

## 6. Expected Outcomes

### Act 1 Combat Feel
- Commons: 3-4 turns QP, 2-3 turns with good CC. Player takes 20-40 damage per fight.
- Mini-bosses: 5-7 turns. Special mechanics create urgency. Player takes 40-60 damage.
- Bosses: 8-12 turns with phase transitions. Player takes 60-90 damage.

### Act 2 Combat Feel
- Commons: 3-4 turns with CC. QP-only would take 5-7 turns — incentivizes charging.
- Elites/mini-bosses: 5-7 turns. Mechanics and higher damage create pressure.
- Bosses: 8-12 turns. Phase transitions + quiz phases create peak moments.

### Act 3 Combat Feel
- Commons: 3-5 turns. Floor scaling produces high HP but player has full build.
- Bosses: 10-14 turns. Epic final encounters with multiple phases.

### Category Hierarchy (MUST hold at every floor)
**Commons < Elites ≤ Mini-Bosses < Bosses**
This was broken — now fixed by giving mini-bosses/bosses proportionally higher baseHP.

---

## 7. Implementation — 4-Iteration Cycle

The rebalance required 4 iterations to converge:

| Iter | Change | Scholar | Dedicated | Regular | Issue |
|------|--------|---------|-----------|---------|-------|
| 0 | Baseline | 97% | 78% | 23% | Act 1 HP absurd |
| 1 | Full stat rebalance | 71% | 13% | 0% | Act 2/3 HP + dmg too aggressive |
| 2 | Scale back Act 2/3 attacks | 72% | 27% | 1% | HP still too high |
| 3 | Revert Act 2/3 common HP | 77% | 27% | 1% | Boss/elite HP too high |
| **4** | **Moderate boss/elite HP** | **89%** | **56%** | **6%** | **Converged** |

### Final Values Applied
- **Act 1 commons baseHP**: 10-16 (from 25-40)
- **Act 1 elite**: 16 (from 12), mini-bosses: 11-15 (from 6-9), bosses: 18 (from 11)
- **Act 2/3 commons**: +1 from original (modest increase)
- **Act 2/3 elite/mini-boss/boss**: moderate increases maintaining hierarchy
- **Act 1 attacks**: 6-8 base (from 4-6), block: 6-8 (from 4-5)
- **Act 2/3 commons attacks**: 3 base (from 2)
- **ENEMY_TURN_DAMAGE_CAP seg 1**: 8 (from 6)
- **FLOOR_DAMAGE_SCALE_MID**: 1.0 (from 1.2)

### Lessons Learned
1. **ENEMY_BASE_HP_MULTIPLIER = 4.0** makes small baseHP changes have outsized effects
2. **Segment 3 floor scaling cliff** (0.25→0.60/floor) creates a 2.2x HP jump between floor 12 and 13
3. **Zero post-encounter healing** means attrition across the run is the real killer, not individual fights
4. **Mid-tier profiles (55-62% quiz accuracy)** get minimal benefit from charging — CC damage barely exceeds QP
5. **Boss fights are the bottleneck** — a too-tanky boss can cost more HP than a player has
6. **Always iterate with the sim** — theoretical models missed the compounding attrition effect

---

## 8. Final Results (4-Iteration Cycle)

### Iteration Summary

| Pass | Key Changes | Outcome |
|------|-------------|---------|
| Pass #1 | Act 1 commons HP halved (25–40 → 10–16). Act 1 elite/mini-boss/boss HP scaled up to proper hierarchy. Act 1 attacks raised 4–6 → 6–8. Act 2/3 common HP doubled (4–7 → 8–12). Act 2/3 attacks raised 2–3 → 4–7. Seg 1 cap 6→10. | Over-tuned: dedicated dropped 78→13%, regular 23→0%. Act 2/3 DPS tripled. |
| Pass #2 | `FLOOR_DAMAGE_SCALE_MID` 1.2→1.0. Caps rolled back (10→8, 16→14, 22→20, 32→30). Act 2/3 common attacks reduced to 3–4. Mini-boss/elite/boss attacks modestly reduced. | HP problem persisted — doubled Act 2/3 commons created long attrition fights. |
| Pass #3 | Act 2 and Act 3 **commons only** — HP reverted to near-original (+1 vs original). Commons attacks rolled back to 3. Damage caps seg 2/3/4 reverted to 12/18/28. Boss/elite/mini-boss HP unchanged. | Over-corrected elite/boss HP: Act 1 boss at 275 HP when players deal 13–25/turn — 11–21 turn fights. |
| Pass #4 | Act 1 elite/mini-boss/boss HP reduced to moderate increases (hierarchy maintained, fights reasonable). Act 1 boss attack values reduced (5→3 ph1, 7→5 ph2) to cut attrition. Act 2/3 boss/mini-boss/elite HP trimmed. | Final state — shipped. |

### Final Sim Results (500 runs per profile)

| Profile | Before | After |
|---------|--------|-------|
| scholar | 97% | 89% |
| dedicated | 78% | 56% |
| casual_learner | 26% | 9% |
| regular | 23% | 6% |
| gamer | 8% | 1% |
| first_timer | 0% | 0% |

### Final baseHP Values (as shipped)

| Category | Enemy | Final baseHP | Eff HP (reference floor) |
|----------|-------|-------------|--------------------------|
| Act 1 common | page_flutter | 12 | 48 (floor 1) |
| Act 1 common | thesis_construct | 13 | 52 |
| Act 1 common | mold_puff | 10 | 40 |
| Act 1 common | ink_slug | 14 | 56 |
| Act 1 common | bookmark_vine | 11 | 44 |
| Act 1 common | staple_bug | 16 | 64 |
| Act 1 common | margin_gremlin | 12 | 48 |
| Act 1 common | index_weaver | 11 | 44 |
| Act 1 common | overdue_golem | 15 | 60 |
| Act 1 common | pop_quiz | 11 | 44 |
| Act 1 common | eraser_worm | 10 | 40 |
| Act 1 elite | librarian | 16 | ~128 (floor 4) |
| Act 1 mini-boss | plagiarist | 12 | ~101 (floor 5) |
| Act 1 mini-boss | card_catalogue | 14 | ~118 (floor 5) |
| Act 1 mini-boss | headmistress | 14 | ~118 (floor 5) |
| Act 1 mini-boss | tutor | 11 | ~93 (floor 5) |
| Act 1 mini-boss | study_group | 15 | ~126 (floor 5) |
| Act 1 boss | final_exam | 18 | ~198 (floor 8) |
| Act 1 boss | burning_deadline | 18 | ~198 (floor 8) |
| Act 2 common | crib_sheet | 5 | ~60 (floor 9) |
| Act 2 common | citation_needed | 8 | ~96 (floor 9) |
| Act 2 elite | deadline_serpent | 14 | ~182 (floor 10) |
| Act 2 boss | algorithm | 14 | ~493 (floor 14) |
| Act 3 common | thesis_djinn | 7 | ~314 (floor 18) |
| Act 3 elite | dunning_kruger | 10 | ~616 (floor 19) |
| Act 3 mini-boss | dissertation | 13 | ~842 (floor 20) |
| Act 3 boss | omnibus | 20 | ~1488 (floor 23) |

### Final Balance Constants

| Constant | Old | New |
|----------|-----|-----|
| `FLOOR_DAMAGE_SCALE_MID` | 1.2 | 1.0 |
| `ENEMY_TURN_DAMAGE_CAP` seg 1 | 6 | 8 |
| `ENEMY_TURN_DAMAGE_CAP` seg 2 | 12 | 12 (unchanged) |
| `ENEMY_TURN_DAMAGE_CAP` seg 3 | 18 | 18 (unchanged) |
| `ENEMY_TURN_DAMAGE_CAP` seg 4 | 28 | 28 (unchanged) |
| overdue_golem heal/turn | 9 | 5 |

### Lessons Learned

1. **HP multiplier amplifies small baseHP changes dramatically.** Act 1 commons at `baseHP * 4.0` means changing baseHP by 5 changes effective HP by 20. Always compute effective HP before tuning, not baseHP in isolation.

2. **Act 2/3 floor scaling is very steep.** Floor 9 has `getFloorScaling(9) = 3.0` — so doubling baseHP doubled fight duration, then floor scaling doubled damage taken per fight. The combined effect of longer fights and higher damage per fight made mid-tier profiles hit a wall instantly.

3. **No-healing meta makes attrition the killer.** With `POST_ENCOUNTER_HEAL_PCT = 0`, accumulated HP loss across 20+ common fights per run is the real difficulty lever — not any single fight. Lowering common HP and keeping Act 2/3 commons at near-original values respects this. Raising Act 2/3 common HP doubles the run-level attrition tax, not just the per-fight difficulty.

4. **Boss/elite HP changes need conservative increments.** A boss at baseHP 25 feels like a 10-turn fight at first glance; at floor 8 with `getFloorScaling(8) = 1.7` and `ENEMY_BASE_HP_MULTIPLIER = 4.0`, it's actually 170 HP — 11–21 turns for mid-tier players who deal 8–15/turn. Use the effective HP formula before committing to any baseHP change.

5. **Segment 1 damage cap at 8 (not 10) is correct.** 10 allowed boss charge attacks to hit for cap-busting values that made Phase 2 transitions immediately lethal. 8/turn creates tension without one-shots.
