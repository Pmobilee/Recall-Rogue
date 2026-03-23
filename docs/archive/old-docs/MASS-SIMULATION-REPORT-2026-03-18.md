# Mass Simulation Balance Report — 2026-03-18

**4,443,400 total simulations | 7 analysis modes | HeadlessCombatSimulator v1**

---

## Executive Summary

This report consolidates findings from the largest simulation run in Recall Rogue's development history. Four and a half million simulated runs across 7 analysis modes reveal a game with strong fundamentals but several critical balance failures that must be addressed before wider release.

**The top-line findings:**

- **Phoenix Feather is broken.** A single relic turns a 2% survival rate into 72% at Ascension 10. It is not a relic — it is a cheat code. Cap lethal saves at 1 per run.
- **Ascension 15-20 is an impenetrable wall.** Zero percent survival for all player profiles without relics. Even with 8 optimized relics, only one specific healing build survives at Ascension 20 (77%), while every other build sits at 0-13%.
- **The Sustain God build is orders of magnitude stronger than all alternatives.** Eight healing relics stacked together create near-immortality; diminishing returns on healing must be implemented.
- **Overkill rate is critically low (1%).** Players never feel powerful. Every run is a desperate survival slog. The combo multiplier curve needs a significant buff to create power-spike moments.
- **Two-thirds of relics are marginal.** 24 of 37 relics score C-tier or lower — players picking them up feel no difference. The relic pool needs pruning and buffing.
- **Floor damage scaling is the single highest-leverage parameter.** Halving it (0.04 → 0.02 per floor) has the second-strongest correlation with improved balance of any variable tested.

**Recommended immediate balance changes:**

| Parameter | Current | Recommended |
|-----------|---------|-------------|
| playerStartHP | 100 | **110** |
| floorDamageScalingPerFloor | 0.04 | **0.02** |
| postEncounterHealPct | 0.10 | **0.14** |
| fizzleEffectRatio | 0.20 | **0.15** |
| comboMultipliers | [1, 1.1, 1.2, 1.3, 1.5] | **[1, 1.15, 1.3, 1.5, 2.0]** |
| baseEffectAttack | 10 | **12** |
| baseEffectShield | 8 | **7** |

---

## Simulation Overview

| Mode | Runs | Duration | Throughput |
|------|------|----------|------------|
| Solo Relic Impact | 735,000 | — | ~430/s |
| Deep Analytics | 840,000 | 2,112s | 398/s |
| Fairness | 600,000 | 1,448s | 414/s |
| Builds | 200,000 | — | — |
| Progression | 100,000 | — | — |
| Combos | 1,267,200 | 2,911s | 435/s |
| Parameter Sweep | 601,200 | 1,604s | 375/s |
| **TOTAL** | **4,443,400** | | |

### Player Profiles Tested

| Profile | Accuracy | Notes |
|---------|----------|-------|
| first_timer | 47% | Complete beginner |
| new_domain | 48% | Veteran mechanics, new content |
| developing_newbie | 55% | Learning the ropes |
| regular | 58% | Average engaged player |
| dedicated | 65% | High-investment player |
| scholar | 75% | Expert/completionist |

Ascension levels tested: 0, 5, 10, 15, 20
Difficulty modes: normal, relaxed (+10% accuracy bonus)

---

## Section 1: Control Baselines (No Relics)

Raw survival rates showing the unmodified game difficulty. These establish the baseline all relic and build data is measured against.

### Normal Mode — Survival Rate by Profile and Ascension

| Profile | Asc 0 | Asc 5 | Asc 10 | Asc 15 | Asc 20 |
|---------|-------|-------|--------|--------|--------|
| first_timer (47%) | ~0% | 0% | 0% | 0% | 0% |
| developing_newbie (55%) | ~2% | ~0.5% | 0% | 0% | 0% |
| regular (58%) | 19.9% | 6.7% | 1.8% | 0% | 0% |
| dedicated (65%) | 41.7% | 20.4% | 9.8% | 0% | 0% |
| scholar (75%) | 59.3% | 37.6% | 21.1% | 0% | 0% |

### Relaxed Mode — Survival Rate (Scholar and Dedicated)

| Profile | Asc 0 | Asc 5 | Asc 10 | Asc 15 | Asc 20 |
|---------|-------|-------|--------|--------|--------|
| scholar (75%) | 85.5% | 69.3% | 49.7% | 0.1% | 0% |
| dedicated (65%) | ~65% | ~45% | ~25% | 0% | 0% |

### Key Findings

- **Ascension 15 is a brick wall.** Even a scholar-level player (75% accuracy) drops from 21.1% survival at Asc 10 to 0% at Asc 15 without relics. Relaxed mode only marginally delays this: 0.1% at Asc 15.
- **Ascension 20 is completely unbeatable without relics** for every profile tested, in both difficulty modes.
- **First-timers and developing newbies are functionally excluded from Asc 5+.** A 47% accuracy player has near-zero survival even at Asc 0, which means the onboarding cliff is severe.
- **The gap between regular (58%) and dedicated (65%) is large** — 19.9% vs 41.7% at Asc 0. Seven accuracy points doubles your survival rate, which feels appropriately skill-weighted.

---

## Section 2: Relic Tier List (Solo Impact, 735K Runs)

All 37 combat relics ranked by composite impact score. Score is weighted: 40% survival impact, 30% DPS impact, 30% defense impact. All measurements taken against the regular (58% accuracy) profile baseline.

### S-Tier — Overpowered (Overall Score > 50)

These relics fundamentally change the game. Phoenix Feather in particular needs immediate adjustment.

| Relic | Overall Score | Surv Impact | DPS Impact | Def Impact | Notes |
|-------|--------------|-------------|------------|------------|-------|
| phoenix_feather | +1309 | +3252% | +42% | -13% | Single lethal save turns 2% → 72% survival at Asc 10. Massively overpowered. |
| whetstone | +209 | +370% | +99% | +105% | Best offensive relic. Near-doubles DPS and survival simultaneously. |
| aegis_stone | +180 | +417% | +10% | +33% | Best defensive relic by survival impact. |
| iron_shield | +110 | +228% | +15% | +46% | Strong all-rounder defense. |
| blood_price | +87 | +92% | +61% | +107% | High risk/reward. Huge defense and DPS boost for a cost. |
| swift_boots | +86 | +0% | -1% | +286% | Pure defense through extra draw. No survival impact at Asc 20. |
| combo_ring | +83 | +180% | +22% | +16% | Starting combos at 1 is a huge scaling enabler. |
| vitality_ring | +67 | +163% | +7% | -1% | Pure survival via HP boost. Straightforward and effective. |
| last_breath | +62 | +153% | +5% | -3% | Lethal save, weaker than phoenix_feather but still S-tier. |

### B-Tier — Good (Overall Score 10-25)

Solid relics that meaningfully improve a run but don't define it.

| Relic | Overall Score | Notes |
|-------|--------------|-------|
| herbal_pouch | +23.4 | Healing relic. Solid survival boost, core of the Sustain build. |
| steel_skin | +16.1 | Decent defense boost. |
| volatile_core | +12.7 | Minor survival lift. |
| echo_chamber | +10.3 | Small but positive impact. |

### C-Tier — Marginal (Overall Score 0-10)

24 relics fall in this range. Most provide small defensive boosts via damage reduction but don't meaningfully change survival rates. Players picking up C-tier relics feel no difference.

| Relic | Overall Score | Dominant Effect |
|-------|--------------|----------------|
| quicksilver_quill | +9.6 | Almost all defense |
| plague_flask | +9.2 | Almost all defense |
| thorn_crown | +8.1 | Almost all defense |
| prismatic_shard | +8.1 | Mixed DPS + defense |
| bastions_will | +6.8 | Small survival lift |
| memory_nexus | +5.6 | Marginal |
| crit_lens | +5.5 | Marginal |
| festering_wound | +5.3 | Marginal |
| resonance_crystal | +0.5 | Nearly useless |
| mirror_of_knowledge | +0.3 | Nearly useless |
| insight_prism | +0.2 | Nearly useless |
| *(13 others)* | +0 to +9 | Minimal impact |

### D/F-Tier — Harmful at High Ascension

At Ascension 20, some relics register negative overall scores. This is an artifact of the Asc 20 wall rather than relic failure — when enemies kill in one hit, HP bonuses and lethal saves can't trigger.

| Relic | Asc 20 Score | Reason |
|-------|-------------|--------|
| phoenix_feather | -24.1 | Lethal save can't trigger before instant death |
| vitality_ring | -24.3 | HP bonus meaningless when floor 1 kills instantly |

These relics remain strong at Asc 0-15. The negative scores at Asc 20 signal that Asc 20 scaling itself is the problem.

### Relic Balance Recommendations

- **Phoenix Feather (CRITICAL):** Cap to 1 lethal save per run. Optionally make it consume itself after triggering, preventing stacking with last_breath.
- **C-Tier relics (HIGH):** 24 of 37 relics are marginal. The bottom 10 (resonance_crystal, mirror_of_knowledge, insight_prism, and 7 others) need either significant stat buffs or mechanical redesigns to have distinctive gameplay identity.
- **Wild/Speed relics (MEDIUM):** swift_boots achieves +286% defense through extra draws, but that's not contributing to actual win conditions at high ascension. Verify these relics have engaging gameplay feel even at lower impact levels.

---

## Section 3: Enemy Difficulty Rankings (840K Deep Runs)

### Hardest Enemies — Lowest Defeat Rate

The defeat rate alone doesn't capture difficulty — bosses take many turns and deal large total damage, slowly grinding down player HP across the run.

| Enemy | Category | Encounters | Defeat Rate | Avg Turns | Dmg Dealt | Dmg Taken |
|-------|----------|------------|-------------|-----------|-----------|-----------|
| knowledge_golem | BOSS | 445,967 | 85.7% | 6.85 | 305 | 38 |
| the_curator | BOSS | 445,333 | 85.9% | 6.78 | 305 | 37 |
| shadow_hydra | BOSS | 446,872 | 87.1% | 6.57 | 277 | 34 |
| primordial_wyrm | MINI_BOSS | 310,559 | 88.5% | 3.83 | 142 | 34 |
| tectonic_titan | MINI_BOSS | 310,789 | 89.8% | 3.98 | 152 | 32 |
| magma_core | BOSS | 445,628 | 91.8% | 4.66 | 198 | 26 |
| the_excavator | BOSS | 444,960 | 93.6% | 4.61 | 189 | 27 |

### Easiest Enemies — Highest Defeat Rate

| Enemy | Category | Defeat Rate | Avg Turns | Dmg Taken |
|-------|----------|-------------|-----------|-----------|
| bog_witch | MINI_BOSS | 99.85% | 2.67 | 1.92 |
| biolume_monarch | MINI_BOSS | 99.74% | 3.32 | 2.71 |
| mushroom_sovereign | MINI_BOSS | 99.66% | 2.96 | 3.14 |
| toxic_spore | COMMON | 99.62% | 1.52 | 0.79 |
| sulfur_sprite | COMMON | 99.60% | 2.07 | 0.85 |
| fungal_sprout | COMMON | 99.56% | 1.84 | 0.56 |
| cave_bat | COMMON | 99.49% | 1.79 | 3.14 |

### Key Findings

- **Hardest bosses have 85%+ defeat rates** — the threat isn't losing to them directly, it's the 37-38 damage they deal per encounter that accumulates over the run. A player who survives all three late-game bosses has taken 110+ damage from bosses alone.
- **primordial_wyrm is anomalous.** As a mini-boss it has an 88.5% defeat rate and deals 34 damage per encounter — equal to boss-level damage but in half the turns. It is effectively harder than magma_core and the_excavator despite being a lower-tier enemy.
- **Easy mini-bosses are effectively free wins.** bog_witch (99.85%, 1.92 dmg) and biolume_monarch (99.74%, 2.71 dmg) deal so little damage they might as well not exist. These encounters provide zero tension and could be buffed substantially.
- **Mini-boss difficulty variance is extreme** — primordial_wyrm (88.5%, 34 dmg) vs bog_witch (99.85%, 2 dmg) is a 12-point gap in defeat rate and 17x difference in damage. This range is too wide for enemies that nominally share the same tier.
- **shadow_mimic is the hardest common enemy** (97.78% defeat rate, 5.54 dmg taken). It stands clearly apart from other commons and provides a good "surprise spike" if intentional.

### Enemy Balance Recommendations

- **primordial_wyrm (HIGH):** Reduce damage output. A mini-boss dealing equal damage to late-game bosses at lower ascension is warping run economy.
- **bog_witch, biolume_monarch, mushroom_sovereign (MEDIUM):** Buff to deal 8-12 damage per encounter. Currently these encounters provide no gameplay value.
- **Target mini-boss defeat rate range:** 94-97% (current range: 88.5-99.85%). Compress outliers inward.

---

## Section 4: Floor Difficulty Curve (840K Deep Runs)

How player survival and HP changes across the 24-floor dungeon.

| Floor | Survival Rate | Avg Dmg Dealt | Avg Dmg Taken | Avg HP Left | Dropoff |
|-------|--------------|---------------|---------------|-------------|---------|
| 1 | 81.8% | 126 | 12 | 87 | 18.2% |
| 3 (boss) | 90.3% | 265 | 30 | 96 | 6.7% |
| 6 (boss) | 94.9% | 335 | 27 | 102 | 3.3% |
| 9 (boss) | 94.7% | 404 | 30 | 92 | 3.6% |
| 12 (boss) | 94.5% | 474 | 35 | 92 | 4.0% |
| 15 (boss) | 92.0% | 540 | 39 | 80 | 5.5% |
| 18 (boss) | 91.0% | 608 | 44 | 79 | 6.3% |
| 21 (boss) | 85.4% | 668 | 47 | 62 | 9.8% |
| 24 (boss) | 85.7% | 733 | 49 | 62 | 9.5% |

### Key Findings

- **Floor 1 is the deadliest moment in the entire game.** The 18.2% dropoff on floor 1 is more than double the next-worst floor (floor 21 at 9.8%). Unprepared players die before they can learn mechanics.
- **Boss floors show increasing but manageable dropoff through floor 15** (3.3% → 5.5%). This curve is healthy.
- **Regular floors between bosses show negative dropoff** — players actually gain HP between encounters from post-encounter healing. This confirms the healing system is doing meaningful work in the mid-game.
- **The late-game acceleration is real.** Floors 21-24 show 9.5-9.8% dropoff per boss, nearly tripling the floor 6-12 range. Difficulty scaling is outpacing player capability in the final third.
- **Average HP drains from 87 → 62 across 24 floors** — a 25-HP attrition across the full dungeon. This is a slow squeeze that makes the late game feel desperate even when players are winning.
- **Floors 6-12 are the "sweet spot."** Dropoffs of 3.3-4.0% per boss floor feel challenging without being oppressive.

### Difficulty Curve Recommendations

- **Floor 1 (HIGH):** Weaken floor 1 enemies by 20-30% OR give players a starting 10-HP shield that absorbs the first encounter's damage. The 18.2% floor 1 death rate is a player retention disaster.
- **Late-game scaling (HIGH):** Implement the parameter sweep recommendation to halve floor damage scaling (0.04 → 0.02/floor). This specifically targets the floors 21-24 acceleration without affecting early-game feel.
- **HP attrition (MEDIUM):** Increase post-encounter healing from 10% → 14% to reduce the 87 → 62 HP drain. Players should arrive at late bosses with more HP to work with.

---

## Section 5: Card Type Effectiveness (2.1 Billion Cards Played)

Data aggregated from the deep analytics mode across 840K runs.

| Card Type | Cards Played | Accuracy | Avg Dmg | Avg Shield | Fizzle Rate |
|-----------|-------------|----------|---------|------------|-------------|
| Attack | 1,387,404,360 | 65.3% | 1.97 | 0 | 34.7% |
| Shield | 416,774,128 | 64.3% | 0 | 1.53 | 35.7% |
| Debuff | 146,053,561 | 67.5% | 0 | 0 | 32.5% |
| Buff | 136,447,435 | 63.6% | 0 | 0 | 36.4% |
| Utility | 62,758,261 | 63.8% | 0 | 0 | 36.2% |
| Wild | 13,436,121 | 62.6% | 0.65 | 0.13 | 37.4% |

### Key Findings

- **Attack cards dominate play volume** — 3.3x more played than shield cards, 10x more than buff cards. The meta is deeply offensive.
- **Debuff cards have the highest accuracy (67.5%).** This suggests players (or the AI) play debuff cards selectively when they're most confident in a correct answer. This is good strategic behavior.
- **Wild cards are functionally useless.** They have the lowest accuracy (62.6%), the highest fizzle rate (37.4%), and even when they land, they deal 0.65 damage and 0.13 shield — far below specialized cards. Only 13.4M wild cards were played vs 1.38B attacks.
- **Fizzle rates are uniformly high (32-37%)** across all card types. Roughly one-third of all cards played do nothing. This is the core tension of the game, but the rate may be too high — it means the player is "failing" 1 in 3 plays regardless of skill.
- **Shield value (1.53 per play) is disproportionately low compared to attack damage (1.97).** If shields are meant to be tactically equivalent to attacks, they should deal equivalent mitigation — closer to 2.0.
- **Buff and utility cards show the lowest accuracy of specialized types** (63.6-63.8%) — players are less confident when playing them, possibly because their effects are harder to evaluate strategically.

### Card Balance Recommendations

- **Wild cards (HIGH):** Rework to always produce partial effect even on wrong answers (e.g., 25% of normal effect on fizzle). This would give Wild cards a unique identity — the "safe" card that always does something, even if less.
- **Shield value (MEDIUM):** Increase from 1.53 to ~1.9-2.0 per play to match attack damage output. Currently shields feel like a weak choice compared to attacks.
- **Fizzle penalty (MEDIUM):** Reduce fizzleEffectRatio from 0.20 → 0.15. Getting a wrong answer already costs the player a combo reset and no card effect. The additional 20% penalty-on-fizzle is punitive.

---

## Section 6: Build Archetypes (200K Runs)

Six curated builds tested across all ascension levels. Control baseline included for comparison.

| Build | Relics Used | Asc 0 | Asc 5 | Asc 10 | Asc 15 | Asc 20 | DPS | Dmg Taken |
|-------|------------|-------|-------|--------|--------|--------|-----|-----------|
| Sustain God | 8 heal relics | 100% | 100% | 99.8% | 91.1% | **77.1%** | 37-39 | 11-28 |
| Balanced Best | 8 mixed | 99.8% | 97.9% | 92.3% | 48.0% | 13.3% | 52-57 | 5-9 |
| Iron Fortress | 8 defense | 98.1% | 94.6% | 86.1% | 16.4% | 0% | 45-47 | 5-8 |
| Cursed Gambler | 6 risk | 96.3% | 89.6% | 75.6% | 12.2% | 1.2% | 55-57 | 8-13 |
| Speed Demon | 8 speed (scholar) | 89.2% | 73.9% | 56.5% | 0.9% | 0% | 55-58 | 5-7 |
| Full Aggro | 8 attack | 80.2% | 71.2% | 57.1% | 4.9% | 0% | 77-84 | 5-6 |
| Control (dedicated, no relics) | none | 41.7% | 20.1% | 8.3% | 0% | 0% | — | — |

Sustain God relic set: herbal_pouch, vitality_ring, medic_kit, last_breath, blood_pact, phoenix_feather, renewal_spring, scholars_hat

### Key Findings

- **Sustain God is massively overpowered.** At Ascension 20 where every other build achieves 0-13%, Sustain God achieves 77.1%. This is not a stronger build — it is a different game. The 6x advantage over Balanced Best at Asc 20 indicates the healing stack creates a near-invincibility loop.
- **Full Aggro has the highest DPS (77-84)** but one of the lowest survival rates (80% at Asc 0). Glass cannon viability tops out around Asc 10. The power fantasy exists but doesn't scale.
- **Iron Fortress falls off hard at Asc 15** — 86.1% at Asc 10 collapses to 16.4% at Asc 15. Pure mitigation cannot overcome damage scaling in the late game.
- **Speed Demon (scholar-tier player, 8 speed/combo relics) underperforms Iron Fortress** at every ascension level despite 75% accuracy. Speed/combo relics don't translate to survival as well as raw defense, suggesting the combo payoff curve needs the proposed buff.
- **The meaningful Asc 20 viable builds are exactly one.** This is a diversity failure. A game with 37 relics should have multiple viable Asc 20 strategies.
- **Cursed Gambler (6 risk relics) achieves 1.2% at Asc 20** — tiny but non-zero. With further tuning, the high-variance risk playstyle could be a distinct viable path.

### Build Balance Recommendations

- **Sustain God (CRITICAL):** Implement diminishing returns on stacked healing relics. Suggested: each additional healing relic in the same slot reduces base healing by 15%. Cap total per-encounter healing at 20 HP regardless of relic count.
- **Speed Demon / Combo (HIGH):** Implement the proposed combo multiplier buff [1, 1.15, 1.3, 1.5, 2.0]. This directly benefits the speed archetype and should push it closer to Iron Fortress viability.
- **Full Aggro (MEDIUM):** Increase attack base effect from 10 → 12 (already recommended in sweep). This rewards the glass cannon playstyle with higher DPS upside.

---

## Section 7: Progression Curve (100K Runs, Regular Profile)

How survival rates change as players unlock more relics over a typical account lifetime.

| Stage | Relic Count | Asc 0 | Asc 5 | Asc 10 | Asc 15 | Asc 20 |
|-------|------------|-------|-------|--------|--------|--------|
| Control | 0 | 19.9% | 6.7% | 1.8% | 0% | 0% |
| New Player | 3 (whetstone, iron_buckler, herbal_pouch) | 67.7% | 49.5% | 28.2% | 0.2% | 0% |
| Mid Unlock | 6 (+combo_ring, swift_boots, afterimage) | 99.8% | 99.4% | 89.2% | 49.8% | 0% |
| Full Collection | 8 (top 8 relics) | 97.1% | 91.9% | 79.7% | 26.4% | 0% |

### Key Findings

- **The first 3 relics nearly quadruple survival.** 19.9% → 67.7% at Asc 0 from just whetstone, iron_buckler, and herbal_pouch. This is a powerful and motivating progression hook for new players.
- **Mid Unlock (6 relics) reaches near-immortality at low ascension** — 99.8% at Asc 0, 99.4% at Asc 5. Players who've invested in the game are rewarded significantly.
- **Full Collection (8 relics) paradoxically underperforms Mid Unlock (6 relics)** at every ascension level. The top-8 build includes offensive relics that trade survival for DPS. This is either intentional build diversity or an unintended inversion that misleads players about the value of collecting all relics.
- **Ascension 15 remains a hard wall** even with 6 relics (49.8% survival). Players will hit this wall after investing dozens of hours and find themselves unable to progress without the specific Sustain God build.
- **Ascension 20 remains impossible** for all progression stages outside the Sustain God build (not tested in this mode).

### Progression Recommendations

- **New Player relic selection (LOW):** The whetstone + iron_buckler + herbal_pouch starter trio produces an excellent 3x progression hook. Keep this as the early unlock path.
- **Asc 15 wall (HIGH):** With the recommended parameter changes (lower floor scaling, higher HP), test whether Asc 15 becomes achievable at 6-8 relics for regular-tier players. The current 49.8% at Asc 15 with 6 relics needs to reach ~65-70% to feel fair.
- **Full Collection inversion (MEDIUM):** Investigate whether the 8-relic build being weaker than the 6-relic build is intentional. If not, swap one offensive relic in the "full collection" build for a defensive relic to eliminate the paradox.

---

## Section 8: Fun Factor Metrics

Metrics that measure subjective game feel rather than pure performance.

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Close-call win rate | 16.1% | 8-15% | SLIGHTLY HIGH |
| Comeback win rate | 27.6% | — | GOOD |
| Overkill win rate | 1.0% | 10-20% | CRITICAL — WAY TOO LOW |
| Avg min HP reached | 8.7 | — | Very tense — near-death common |

### Key Findings

- **Comeback rate of 27.6% is excellent.** One in four wins involves recovering from a bad position. Dynamic, memorable runs are the norm rather than the exception. This is a core retention driver.
- **Overkill rate of 1% is critically low.** Players almost never steamroll. In a roguelite, players need to occasionally feel powerful — to enjoy a "victory lap" run where they're genuinely dominant. At 1%, this experience essentially doesn't exist.
- **Close-call wins at 16.1%** are slightly above the 8-15% target. Combined with the 1% overkill rate, this means the game exists almost entirely in the "desperate survival" band. There is very little variance in how tense runs feel.
- **Average minimum HP of 8.7** confirms that most players routinely brush against death. This is exciting in individual moments but if it never resolves into either a dramatic death or a power-surge victory, it creates a fatigue loop — the player is always tense, never triumphant.
- **The experience gap:** Wins feel like narrow escapes (good), losses feel inevitable (acceptable), but power fantasies and steamrolls are essentially absent (bad). The game needs more ceiling, not more floor.

### Fun Factor Recommendations

- **Overkill rate (HIGH):** Implement the combo multiplier buff [1, 1.15, 1.3, 1.5, 2.0]. A max-streak combo should feel like a power surge that genuinely overwhelms enemies. This is the primary lever for creating "feel-good" moments.
- **Close-call rate (MEDIUM):** The 16.1% close-call rate is slightly above target. The HP and healing adjustments recommended elsewhere should naturally bring this down toward 12-13%.
- **Tension variety (MEDIUM):** Consider adding a "Well-Rested" run modifier that occasionally spawns weaker enemy variants — a designed "easy run" that lets players feel dominant and experiment with synergies without grinding against difficulty.

---

## Section 9: Economy Analysis

Gold earned, spent, and distributed across upgrade types.

### Gold Overview

| Metric | Value |
|--------|-------|
| Avg gold earned per run | 2,300 |
| Avg gold spent per run | 1,641 |
| Gold efficiency | 71.4% |
| Avg food purchased per run | 1.06 |
| Avg upgrades per run | 11.7 |

### Upgrade Distribution

| Mechanic | Total Upgrades | Share |
|----------|---------------|-------|
| Strike (attack) | 4,278,935 | 43.5% |
| Block (shield) | 2,965,781 | 30.1% |
| Scout (utility) | 943,970 | 9.6% |
| Empower (buff) | 939,834 | 9.5% |
| Weaken (debuff) | 573,572 | 5.8% |
| Mirror (wild) | 118,215 | 1.2% |

### Key Findings

- **28.6% of earned gold goes unspent.** 659 gold average per run is left behind. This suggests players either die before reaching the late shop, don't find useful shop items, or the shop inventory doesn't match run needs.
- **Only 1.06 food purchased per run.** Food is significantly undervalued or overpriced. With average min HP of 8.7, players clearly need healing — but aren't buying it from shops. Either the price is too high or the healing amount is too low to feel worth it.
- **Strike upgrades dominate at 43.5%** — the AI and presumably players prioritize attack upgrades heavily. This mirrors the card play data showing attacks are played 3.3x more than shields.
- **Wild (Mirror) upgrades are nearly ignored at 1.2%.** This is consistent with wild cards being the weakest card type. Players recognize wild cards as poor investments.
- **Synergies are extremely rare** — avg 0.33 per run, only echo_master detected across 840K runs. The synergy system exists as a mechanic but is not firing meaningfully in practice.

### Economy Recommendations

- **Synergy system (HIGH):** 0.33 synergies per run means most players never see a synergy trigger across an entire run. Either lower activation thresholds, add more 2-relic combos with accessible conditions, or surface synergy UI more prominently so players can build toward them.
- **Food pricing (MEDIUM):** Either reduce food cost by 25-30% or increase food healing by 30-40%. The 1.06 food/run average is too low given player HP pressure.
- **Gold efficiency (MEDIUM):** 28.6% unspent gold indicates a shop inventory or timing problem. Consider: late-shop items that spend accumulated gold (e.g., permanent upgrades, relic rerolls) to capture gold that currently expires on run end.
- **Wild card investment (LOW):** Fixing wild cards mechanically (as recommended in Section 5) should naturally increase Mirror upgrade purchases.

---

## Section 10: Relic Count Scaling

How adding more relics to a run affects performance — averaged across all profiles.

| Relic Count | Survival Rate | Avg Floor Reached | DPS |
|-------------|--------------|-------------------|-----|
| 0 | 9.9% | 8.3 | 20.3 |
| 1 | 14.2% | 11.2 | 28.1 |
| 3 | 22.1% | 15.8 | 41.0 |
| 5 | 25.6% | 16.5 | 42.7 |
| 8 | 64.0% | 18.9 | 45.6 |

### Key Findings

- **The 0→1 relic jump (+4.3% survival)** is meaningful but not dramatic. The first relic gives ~3 extra floors on average.
- **The 1→3 relic jump (+7.9% survival)** shows healthy scaling. Three relics is the "makes the game playable" threshold.
- **The 3→5 relic jump (+3.5% survival)** shows diminishing returns. Two additional relics add less than the first single relic did.
- **The 5→8 relic jump (+38.4% survival)** is massive and non-linear. This 6x-larger jump compared to the 3→5 range indicates specific 8-relic builds have synergistic interactions that aren't proportional to raw relic count.
- **DPS doubles from 0→3 relics** (20.3 → 41.0) then barely grows through 8 relics (41.0 → 45.6). DPS scaling is front-loaded while survival scaling is back-loaded.
- The 5→8 jump is almost certainly explained by the inclusion of lethal-save relics (phoenix_feather, last_breath) which have outsized per-relic survival impact. Sustain God and similar builds crossing a healing-loop threshold at 6-8 relics also contributes.

### Scaling Recommendations

- **The 5-relic plateau (MEDIUM):** Adding a 4th and 5th relic feels unrewarding (+3.5% combined). Consider whether relics 4-5 in typical unlock order are the weakest relics, or whether the curve itself needs adjustment to make each relic feel impactful.
- **High-relic synergy (LOW/WATCH):** The non-linear 5→8 jump is interesting but could be healthy (meaningful late-game power spikes) or problematic (only 8-relic builds are competitive at high ascension). Monitor after Sustain God healing nerf to see if the 8-relic advantage shrinks proportionally.

---

## Section 11: Parameter Sweep — Optimal Balance Values (601K Runs)

Systematic parameter search to find the configuration that best balances survival rates across all profiles and ascension levels.

### Sensitivity Analysis

How much each parameter influences the composite balance score (Pearson correlation coefficient).

| Parameter | Correlation (r) | Direction | Interpretation |
|-----------|----------------|-----------|----------------|
| playerStartHP | -0.546 | Positive | **Most impactful** — higher HP strongly improves balance |
| floorDamageScalingPerFloor | +0.527 | Negative | **Second most impactful** — lower scaling improves balance |
| fizzleEffectRatio | -0.105 | Positive | Moderate — lower fizzle penalty improves experience |
| postEncounterHealPct | -0.098 | Positive | Moderate — more healing helps |
| baseEffectAttack | -0.043 | Positive | Minor |
| baseEffectShield | -0.030 | Positive | Minor |

Note: r values show magnitude of effect. Negative r means the parameter's increase hurts balance; the Direction column clarifies which way to push.

### Recommended Values vs Current

| Parameter | Current | Recommended | Change | Priority |
|-----------|---------|-------------|--------|----------|
| playerStartHP | 100 | **110** | +10 | HIGH |
| floorDamageScalingPerFloor | 0.04 | **0.02** | -50% | CRITICAL |
| postEncounterHealPct | 0.10 | **0.14** | +40% | HIGH |
| fizzleEffectRatio | 0.20 | **0.15** | -25% | MEDIUM |
| baseEffectAttack | 10 | **12** | +20% | MEDIUM |
| baseEffectShield | 8 | **7** | -12.5% | LOW |
| comboMultipliers | [1, 1.1, 1.2, 1.3, 1.5] | **[1, 1.15, 1.3, 1.5, 2.0]** | Higher scaling | HIGH |
| postEncounterHealCap | varies | Keep current {1: 1.0, 2: 0.9, 3: 0.8, 4: 0.65} | — | KEEP |

### Key Findings

- **Floor damage scaling (0.04/floor) is the #1 mechanical problem.** The sweep confirms what the floor curve data showed — late-game difficulty scaling is outpacing player capability. Halving it to 0.02/floor has the second-strongest correlation with improved balance of any variable tested, and it's a simple single-value change.
- **Starting HP of 110** smooths early-game deaths without making late-game trivial. The +10 HP is most impactful on floor 1 where the deadliest dropoffs occur.
- **Combo multipliers should scale more aggressively.** The current curve [1, 1.1, 1.2, 1.3, 1.5] produces a modest peak multiplier. The recommended curve [1, 1.15, 1.3, 1.5, 2.0] creates a meaningful power spike for 5-card knowledge chains — directly supporting the game's core loop of rewarding learning.
- **Fizzle penalty reduction (0.20 → 0.15):** Getting a wrong answer already costs the player a combo reset and zero card effect. The additional 20% damage multiplier feels punitive and discourages risk-taking. 15% maintains tension without crushing new players.
- **Post-encounter healing increase (0.10 → 0.14):** The current 10% heal-on-floor-clear is insufficient to offset the attrition shown in the floor curve data (87 → 62 HP across 24 floors). At 14%, players arrive at late-game bosses with more meaningful HP buffers.
- **Shield base effect decrease (8 → 7):** Minor counterintuitive recommendation — the sweep suggests slightly reducing shield base value because the current shield meta over-incentivizes pure block strategies at mid-game. Combined with the attack buff (10 → 12), this pushes the meta toward more active play.

---

## Section 12: Critical Issues and Recommendations

### CRITICAL — Must Fix Before Wider Release

**1. Phoenix Feather is broken (+1309 overall impact score)**

A single relic that turns 2% survival into 72% at Ascension 10 is not a relic — it is a complete circumvention of the difficulty system. Every other S-tier relic achieves +62 to +209. Phoenix Feather is 6x more powerful than the next-strongest relic.

- **Fix:** Cap lethal saves at 1 per run. Phoenix Feather triggers once, then becomes inert. Optionally, have it physically "break" (animate as cracked) after triggering so the state is clear.
- **Alternative:** Reduce the save to "survive at 5 HP" instead of full health, preventing the relic from providing a second full effective HP bar.

**2. Ascension 15-20 is an impenetrable wall**

Zero percent survival for all profiles without relics at Asc 15. Zero percent at Asc 20 for all builds except Sustain God. This is a brick wall that ends player progression for anyone who didn't luck into the specific healing relic set.

- **Fix:** Implement the parameter sweep recommendations (halve floor damage scaling, increase starting HP). Then retest Asc 15-20 survival. Target: Scholar with 6+ relics should have 40-60% survival at Asc 15.
- **Alternative fix:** Add ascension-specific player bonuses (e.g., at Asc 15, players start with a passive +5 HP regeneration per floor) that partially compensate for the difficulty increase.

**3. Sustain God build is orders of magnitude stronger than all alternatives at high ascension (77% vs 0-13% at Asc 20)**

Eight stacked healing relics create near-immortality. A game with 37 relics should have multiple viable Asc 20 strategies, not one specific healing combination that is 6x better than the runner-up.

- **Fix:** Add diminishing returns to stacked healing relics. Suggested formula: each additional healing relic reduces that relic's base healing by 15% (multiplicative). At 8 healing relics, each relic operates at ~35% of its base healing value, preventing the near-immortality loop while keeping healing builds viable.
- **Also consider:** Cap total healing received per encounter at 20 HP regardless of relic count.

**4. Overkill rate of 1% — players never feel powerful**

With a 10-20% target, the 1% actual overkill rate means the "feel-good power surge" almost never happens. Combined with the 16.1% close-call rate, the game exists almost entirely in "desperate survival mode." Player fatigue is a real risk in longer sessions.

- **Fix:** Implement the proposed combo multiplier buff to [1, 1.15, 1.3, 1.5, 2.0]. A 5-card knowledge chain should genuinely overwhelm enemies, not just slightly out-damage them. This directly rewards the core skill loop of sustained correct answers.

---

### HIGH — Should Fix

**5. 24 of 37 relics are C-tier marginal impact**

Two-thirds of the relic pool barely changes survival rates. Players picking up C-tier relics feel essentially no difference in their run. This undermines the relic system as a progression driver.

- **Fix:** Identify the bottom 10 relics by impact score (resonance_crystal, mirror_of_knowledge, insight_prism, and 7 others near 0). Either buff their stats by 2-3x to reach B-tier or give them unique mechanical identities that create interesting tradeoffs rather than flat stat bonuses.

**6. Floor 1 kills 18.2% of all players — the single deadliest moment in the game**

New players especially die on floor 1 before learning any mechanics. An 18.2% death rate on the very first encounter is a retention disaster that no amount of onboarding UI can fix.

- **Fix Option A:** Reduce floor 1 enemy damage by 30%. Floor 1 enemies should be tutorial encounters, not gatekeepers.
- **Fix Option B:** Give all players a 15-HP starting shield that absorbs the first encounter's damage spike. The shield doesn't carry between encounters — it's purely a buffer for the opening fight.
- **Fix Option C (minimal):** Implement the +10 starting HP recommendation from the sweep. This alone won't solve the 18.2% dropoff but will reduce it meaningfully.

**7. Wild cards, buff cards, and utility cards underperform**

Wild cards (62.6% accuracy, 37.4% fizzle, 0.65 damage per play) are functionally useless. Wild card upgrades represent 1.2% of all purchases — players have independently discovered these cards aren't worth investing in.

- **Fix:** Wild cards should always produce partial effect even on wrong answers. Suggested: 25% of normal effect on fizzle (e.g., a wild attack that would deal 2 damage on a correct answer deals 0.5 damage on a wrong answer). This gives wild cards a unique identity as the "safe" card type.
- **Also:** Review buff and utility card designs. Low accuracy (63.6-63.8%) combined with zero direct combat effect means these cards are risky to play. Add telegraphed payoffs that make the risk/reward clearer.

**8. Synergy system is nearly dormant — avg 0.33 triggers per run**

Only the echo_master synergy was detected across 840K deep analytics runs. 0.33 triggers per run means most players complete entire runs without seeing a single synergy activate. A system that fires less than once per run is effectively not a system.

- **Fix:** Lower synergy activation thresholds. Add more 2-relic combos that require only modest investment to activate. Consider surfacing synergy UI in the relic selection screen ("These two relics work together!") to help players build toward synergies intentionally rather than discovering them by accident.

---

### MEDIUM — Nice to Fix

**9. Food purchases are very low (1.06 per run)**

Players need healing (average min HP of 8.7) but aren't buying food from shops. Either the cost is too high, the healing too low, or players die before reaching shops with gold.

- **Fix:** Reduce food price by 25-30% OR increase healing amount by 30-40%. Target: 1.8-2.2 food purchases per run.

**10. Gold efficiency is 71.4% — 29% of gold goes unspent**

659 gold average goes unused per run. Players either die with gold they couldn't spend or don't find shop items worth buying.

- **Fix:** Add late-game gold sinks (permanent account-level upgrades, relic rerolls, card quality improvements) that capture excess gold before it expires on run end. Alternatively, add a "carry-over gold" mechanic where 25% of unspent gold becomes a starting bonus for the next run.

**11. Late-game difficulty spike at floors 21-24 (9.5-9.8% dropoff per boss floor)**

The final third of the dungeon has a nearly 3x higher dropoff rate than the mid-game. The parameter sweep's recommendation to halve floor damage scaling (0.04 → 0.02) should address this directly.

- **Fix:** This is resolved by the floorDamageScalingPerFloor change. Implement and retest floors 21-24 dropoff — target 5-7% per boss floor.

**12. Mini-boss difficulty variance is extreme**

primordial_wyrm (88.5% defeat rate, 34 damage) vs bog_witch (99.85%, 1.92 damage) represent a 12-point gap in defeat rate and 17x difference in damage dealt. Mini-bosses nominally occupy the same difficulty tier but range from "harder than late bosses" to "functionally free wins."

- **Fix:** Rebalance outliers toward 94-97% defeat rate range. Specific targets:
  - primordial_wyrm: Reduce damage from 34 → 20, reduce encounter turns from 3.83 → 5+ (slower but less punishing)
  - bog_witch, biolume_monarch, mushroom_sovereign: Increase damage from 2-3 → 10-15 per encounter

---

## Appendix: Raw Data File Locations

All simulation output JSON files are stored at:

```
data/playtests/mass-analysis-2026-03-18/
├── solo.json         (205KB — individual relic impact, 37 relics × all profiles × all ascensions)
├── deep.json         (26KB  — per-floor, per-enemy, card effectiveness, 2.1B cards analyzed)
├── fairness.json     (39KB  — cross-profile fairness analysis, 600K runs)
├── builds.json       (34KB  — archetype build performance, 6 builds × 5 ascension levels)
├── progression.json  (16KB  — new player → full collection progression curve)
├── combos.json       (2.3KB — relic pair synergies; note: combo analysis captured baselines only
│                              due to control label mismatch — paired results not produced)
└── sweep.json        (108KB — parameter sweep optimization, 601K runs across parameter grid)
```

**Note on combos.json:** The relic pair synergy analysis (1,267,200 runs) did not produce paired relic results due to a control label mismatch in the simulation harness. Only baseline survival rates were captured. A follow-up analysis with the corrected control labels is recommended to properly characterize 2-relic interaction effects.

---

## Summary Priority Matrix

| Priority | Issue | Recommended Fix | Impact |
|----------|-------|----------------|--------|
| CRITICAL | Phoenix Feather overpowered | Cap to 1 lethal save per run | Relic balance |
| CRITICAL | Asc 15-20 brick wall | Halve floor damage scaling (0.04→0.02) | Progression ceiling |
| CRITICAL | Sustain God build dominance | Diminishing returns on stacked healing | Build diversity |
| CRITICAL | 1% overkill rate | Buff combo multipliers [1, 1.15, 1.3, 1.5, 2.0] | Player feel |
| HIGH | 24/37 relics marginal | Buff/redesign bottom 10 relics | Loot excitement |
| HIGH | Floor 1 kills 18.2% | Weaken floor 1 enemies or add starting shield | New player retention |
| HIGH | Wild/buff/utility cards weak | Wild cards: partial effect on fizzle | Card diversity |
| HIGH | Synergy system dormant | Lower thresholds, add 2-relic combos | Meta depth |
| HIGH | Starting HP too low | 100 → 110 | Overall balance |
| HIGH | Post-encounter healing low | 10% → 14% | Run sustainability |
| MEDIUM | Food underused | Reduce price or increase healing | Economy |
| MEDIUM | Gold efficiency 71.4% | Add late-game gold sinks | Economy |
| MEDIUM | Late-game difficulty spike | Resolved by floor scaling fix above | Difficulty curve |
| MEDIUM | Mini-boss variance extreme | Rebalance outlier mini-bosses | Enemy balance |
| MEDIUM | Fizzle penalty too high | 0.20 → 0.15 | Player feel |

---

*Generated: 2026-03-18 | Total simulations: 4,443,400 | Engine: HeadlessCombatSimulator v1 | Avg throughput: ~430 runs/sec*
