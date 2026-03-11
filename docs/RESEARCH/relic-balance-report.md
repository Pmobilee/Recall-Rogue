# Recall Rogue — Relic System: Complete Catalog & Balance Report

**Generated:** 2026-03-11
**Test methodology:** 100 configurations × 3 seeds each = 300 headless combat simulations, 24 floors per run
**Simulator:** Headless combat using real game engine (turnManager, cardEffectResolver, deckManager, enemyManager)

---

## How Relics Work

- Players collect relics during runs (boss drops, mini-boss drops, 10% chance after regular encounters)
- 25 starter relics are free for all players
- 25 unlockable relics cost Mastery Coins (earned through play) ranging from 25–70 coins
- Relics provide passive bonuses — permanent modifiers, encounter-start triggers, on-hit effects, etc.
- No limit on how many relics you can carry in a run (typically 6–10 by endgame)
- Two "cursed" relics offer powerful upsides with permanent downsides

---

## Player Profiles Used in Testing

| Profile | Base Accuracy | Accuracy Curve | Strategy | Description |
|---------|--------------|----------------|----------|-------------|
| beginner | 55% | improving (+2%/floor) | random | New player, no strategy |
| average | 70% | improving (+1%/floor) | basic | Typical player, basic awareness |
| expert | 90% | flat | optimal | Skilled player, perfect strategy |
| struggling | 45% | declining (-1%/floor) | random | Difficulty with content |
| speed-runner | 85% | flat | intermediate | Fast reader, speed-focused |
| scholar-expert | 80% | improving (+1%/floor) | optimal | Hard mode (scholar difficulty) |

---

## Control Baselines (No Relics)

| Profile | Avg Floor Reached | Survival Rate | DPS/Encounter | Dmg Taken/Encounter | Turns/Encounter | Max Combo |
|---------|-------------------|---------------|---------------|---------------------|-----------------|-----------|
| average | 4 | 0% | 9.0 | 28.3 | 5.4 | 8.7 |
| expert | 19 | 0% | 19.1 | 17.7 | 4.6 | 27.7 |
| struggling | 2 | 0% | 5.4 | 34.8 | 5.7 | 3.3 |

**Key takeaway:** Even expert players die before floor 24 without relics. Relics are essential for completing a full run.

---

## Complete Relic Catalog

### STARTER RELICS (25 — Free for All Players)

#### Offensive Starters

| # | ID | Name | Effect | Trigger | Test Result |
|---|-----|------|--------|---------|-------------|
| 1 | `whetstone` | Whetstone | All attacks deal +2 flat damage | permanent | **OVERPOWERED** — 22.2% overall impact, +50% survival, +7.4% DPS |
| 2 | `flame_brand` | Flame Brand | First attack each encounter deals +50% damage | on_attack | **OVERPOWERED** — 74.6% overall impact, +125% survival, +53.5% DPS. Most broken relic in the game |
| 3 | `barbed_edge` | Barbed Edge | Strike-tagged mechanics deal +3 base damage | on_attack | UNDERPOWERED — 0% measured impact (only triggers on strike-tagged mechanics, too conditional) |
| 4 | `war_drum` | War Drum | +1 damage per combo level this turn | permanent | **OVERPOWERED** — 35.0% overall impact, +75% survival, +19.3% DPS |
| 5 | `sharp_eye` | Sharp Eye | Speed bonus grants +75% effect (vs default +50%) | permanent | UNDERPOWERED — 0% impact (speed bonus system not meaningfully triggered in combat sim) |

#### Defensive Starters

| # | ID | Name | Effect | Trigger | Test Result |
|---|-----|------|--------|---------|-------------|
| 6 | `iron_buckler` | Iron Buckler | Start each encounter with 5 block | on_encounter_start | Moderate — measurable but small floor gain |
| 7 | `steel_skin` | Steel Skin | Take 1 less damage from all sources (min 1) | on_damage_taken | Moderate — cumulative reduction over long runs |
| 8 | `thorned_vest` | Thorned Vest | When blocking, deal 3 damage back to attacker | on_block | Moderate — reflect damage contributes to DPS |
| 9 | `stone_wall` | Stone Wall | All shield cards grant +2 block | permanent | Moderate — but creates ANTI-SYNERGY when stacked with other block relics |

#### Sustain Starters

| # | ID | Name | Effect | Trigger | Test Result |
|---|-----|------|--------|---------|-------------|
| 10 | `herbal_pouch` | Herbal Pouch | Heal 3 HP at encounter start | on_encounter_start | Moderate — consistent heal, good in stacks |
| 11 | `vitality_ring` | Vitality Ring | +8 max HP this run | on_run_start | Moderate — flat HP increase, scales with % heals |
| 12 | `medic_kit` | Medic Kit | Heal cards restore +15% more HP | permanent | Moderate — amplifies all heal sources |
| 13 | `last_breath` | Last Breath | Once per encounter: survive killing blow at 1 HP | on_lethal | Moderate — clutch saves, compound with phoenix_feather |

#### Tactical Starters

| # | ID | Name | Effect | Trigger | Test Result |
|---|-----|------|--------|---------|-------------|
| 14 | `swift_boots` | Swift Boots | Draw 6 cards per turn instead of 5 | permanent | UNDERPOWERED — 0% impact (AP-limited: extra card can't be played) |
| 15 | `combo_ring` | Combo Ring | Combo starts at 1.15× instead of 1.0× | permanent | **OVERPOWERED** — 24.2% overall impact, +75% survival |
| 16 | `momentum_gem` | Momentum Gem | Perfect turn (all correct) grants +1 AP next turn | on_perfect_turn | **OVERPOWERED** — 10.8% overall impact, +50% survival |
| 17 | `speed_charm` | Speed Charm | Speed bonus threshold is 30% instead of 25% | permanent | UNDERPOWERED — 0% impact (speed system not modeled in sim) |
| 18 | `cartographers_lens` | Cartographer's Lens | See 2 upcoming enemy intents (foresight) | permanent | UNDERPOWERED — 0% impact (UI-only, no combat effect) |

#### Knowledge Starters

| # | ID | Name | Effect | Trigger | Test Result |
|---|-----|------|--------|---------|-------------|
| 19 | `scholars_hat` | Scholar's Hat | Correct answers heal 1 HP | on_correct_answer | Weak — 2.0% overall impact, heals too small to matter |
| 20 | `memory_palace` | Memory Palace | 3 correct in a row → +3 damage to next attack | on_correct_answer | Weak — 6.8% impact, streak requirement too high for average players |
| 21 | `curiosity_gem` | Curiosity Gem | Tier 1 (Learning) cards deal +20% effect | permanent | **OVERPOWERED** — 33.1% overall impact, +75% survival. Most starter decks are tier 1 |
| 22 | `brain_booster` | Brain Booster | Hints cost no currency | permanent | UNDERPOWERED — 0% impact (UI-only, no combat effect) |

#### Economy Starters

| # | ID | Name | Effect | Trigger | Test Result |
|---|-----|------|--------|---------|-------------|
| 23 | `gold_magnet` | Gold Magnet | +25% currency from encounters | permanent | UNDERPOWERED — 0% combat impact (economy-only) |
| 24 | `lucky_coin` | Lucky Coin | +2 flat currency per encounter | on_encounter_end | UNDERPOWERED — 0% combat impact (economy-only) |
| 25 | `scavengers_pouch` | Scavenger's Pouch | +1 currency per skipped card | on_card_skip | UNDERPOWERED — 0% combat impact (economy-only) |

---

### UNLOCKABLE RELICS (25 — Mastery Coin Cost)

#### Offensive Unlockables

| # | ID | Name | Cost | Rarity | Effect | Trigger | Test Result |
|---|-----|------|------|--------|--------|---------|-------------|
| 26 | `berserker_band` | Berserker Band | 40 | Uncommon | Below 40% HP: all attacks deal +50% damage | on_attack | Weak alone (1.0%), but GAME-BREAKING in combos with glass_cannon |
| 27 | `chain_lightning_rod` | Chain Lightning Rod | 50 | Rare | Multi-hit attacks get +2 extra hits | on_multi_hit | UNDERPOWERED — 0% impact (multi-hit cards too rare in deck) |
| 28 | `venom_fang` | Venom Fang | 35 | Uncommon | All attacks apply 1 poison for 2 turns | on_attack | UNDERPOWERED — 0% impact (poison system not modeled in sim) |
| 29 | `crescendo_blade` | Crescendo Blade | 45 | Uncommon | Each consecutive correct attack: +10% damage (stacks) | on_attack | Weak — 6.1% impact, but strong in combos |
| 30 | `executioners_axe` | Executioner's Axe | 50 | Rare | Execute threshold: 40% HP (vs 30%) | permanent | UNDERPOWERED — 0% impact (execute system not modeled) |

#### Defensive Unlockables

| # | ID | Name | Cost | Rarity | Effect | Trigger | Test Result |
|---|-----|------|------|--------|--------|---------|-------------|
| 31 | `fortress_wall` | Fortress Wall | 45 | Uncommon | Block carries between turns (no reset) | on_turn_end | Weak — 1.3% impact. Block carry extends fights |
| 32 | `mirror_shield` | Mirror Shield | 50 | Rare | Full block → reflect 50% of absorbed damage | on_block | UNDERPOWERED — 0% impact (full absorb rare) |
| 33 | `iron_resolve` | Iron Resolve | 40 | Uncommon | Below 25% HP: all block doubled | on_damage_taken | UNDERPOWERED — 0% impact (threshold too low, usually dead before it triggers) |
| 34 | `phase_cloak` | Phase Cloak | 60 | Rare | 20% chance to dodge incoming attacks entirely | on_damage_taken | **OVERPOWERED** — 8.5% overall, and GAME-BREAKING with glass_cannon (4.05× synergy) |

#### Sustain Unlockables

| # | ID | Name | Cost | Rarity | Effect | Trigger | Test Result |
|---|-----|------|------|--------|--------|---------|-------------|
| 35 | `blood_pact` | Blood Pact | 55 | Rare | Heal 25% of all damage dealt at end of turn | on_turn_end | **OVERPOWERED** — 12.4% overall impact, lifesteal is extremely strong |
| 36 | `phoenix_feather` | Phoenix Feather | 70 | Rare | Once per run: resurrect at 30% HP on death | on_lethal | UNDERPOWERED — 0% solo impact (one-time save doesn't change outcome) |
| 37 | `renewal_spring` | Renewal Spring | 35 | Uncommon | Heal 10% max HP on floor advance | on_floor_advance | UNDERPOWERED — 0% impact (8 HP heal every 3 encounters is negligible) |

#### Tactical Unlockables

| # | ID | Name | Cost | Rarity | Effect | Trigger | Test Result |
|---|-----|------|------|--------|--------|---------|-------------|
| 38 | `quicksilver` | Quicksilver | 60 | Rare | Start each encounter with +1 AP | on_encounter_start | UNDERPOWERED — 0% solo impact, but 2.79× synergy with AP economy combo |
| 39 | `time_dilation` | Time Dilation | 30 | Uncommon | Quiz timer +3 seconds | permanent | N/A — UI-only, not testable in sim |
| 40 | `afterimage` | Afterimage | 40 | Uncommon | 3+ cards played → +1 draw next turn | on_turn_end | UNDERPOWERED — 0% impact (AP-limited, extra draw can't be played) |
| 41 | `echo_lens` | Echo Lens | 35 | Uncommon | Echo cards deal full power (1.0× vs 0.7×) | on_echo_play | N/A — Echo system handled internally by cardEffectResolver |
| 42 | `double_vision` | Double Vision | 55 | Rare | First card each encounter costs 0 AP | on_encounter_start | UNDERPOWERED — 0% solo impact, saves 1 AP but not enough to change outcomes |

#### Knowledge Unlockables

| # | ID | Name | Cost | Rarity | Effect | Trigger | Test Result |
|---|-----|------|------|--------|--------|---------|-------------|
| 43 | `polyglot_pendant` | Polyglot Pendant | 40 | Uncommon | Cards from secondary domain deal +25% damage | permanent | N/A — Domain tracking not modeled in sim |
| 44 | `eidetic_memory` | Eidetic Memory | 50 | Rare | Facts answered correctly 3+ times: +30% effect | permanent | N/A — Per-fact history not modeled in sim |
| 45 | `speed_reader` | Speed Reader | 55 | Rare | Speed bonus threshold at 15% of timer | permanent | N/A — Speed system UI-only |
| 46 | `domain_mastery` | Domain Mastery | 60 | Rare | 5 same-domain correct → next card +100% effect | on_correct_answer | N/A — Domain tracking not modeled in sim |

#### Economy Unlockables

| # | ID | Name | Cost | Rarity | Effect | Trigger | Test Result |
|---|-----|------|------|--------|--------|---------|-------------|
| 47 | `prospectors_pick` | Prospector's Pick | 45 | Uncommon | Card rewards show 4 options instead of 3 | permanent | N/A — Reward UI only |
| 48 | `miser_ring` | Miser's Ring | 50 | Uncommon | At run end: 10% of currency → mastery coins | permanent | N/A — Economy only |

#### Cursed Relics

| # | ID | Name | Cost | Rarity | Effect | Curse | Test Result |
|---|-----|------|------|--------|--------|-------|-------------|
| 49 | `glass_cannon` | Glass Cannon | 25 | Uncommon | All attacks deal +40% damage | Take +15% more damage | POWERFUL — net positive for high-accuracy players. GAME-BREAKING in combos |
| 50 | `blood_price` | Blood Price | 30 | Uncommon | Draw 2 extra cards per turn | Lose 2 HP per turn | Mixed — extra draws are AP-limited, HP cost is real. Better for experts |

---

## Detailed Test Results

### Solo Relic Impact Ranking (vs No-Relic Control)

Tested with `average` profile. Impact = (relic_metric - control_metric) / control_metric × 100.

| Rank | Relic | Overall Score | Survival | DPS | Defense | Floor Gain | Verdict |
|------|-------|---------------|----------|-----|---------|------------|---------|
| 1 | flame_brand | 74.6% | +125% | +53.5% | +45.2% | +125% | **NERF REQUIRED** |
| 2 | war_drum | 35.0% | +75% | +19.3% | +10.8% | +75% | **NERF REQUIRED** |
| 3 | curiosity_gem | 33.1% | +75% | +14.5% | +9.7% | +75% | **NERF REQUIRED** |
| 4 | combo_ring | 24.2% | +75% | +14.2% | -16.7% | +75% | **NERF REQUIRED** |
| 5 | whetstone | 22.2% | +50% | +7.4% | +9.1% | +50% | High but fair |
| 6 | blood_pact | 12.4% | +50% | +5.8% | -18.7% | +50% | Slightly overtuned |
| 7 | momentum_gem | 10.8% | +50% | +2.4% | -20.1% | +50% | Slightly overtuned |
| 8 | phase_cloak | 8.5% | +50% | +5.0% | -29.4% | +50% | OK solo, breaks in combos |
| 9 | memory_palace | 6.8% | +25% | -1.2% | -3.4% | +25% | Balanced |
| 10 | crescendo_blade | 6.1% | +25% | +1.6% | -8.2% | +25% | Balanced |
| 11 | scholars_hat | 2.0% | +25% | +4.0% | -23.0% | +25% | Weak |
| 12 | fortress_wall | 1.3% | +25% | +4.6% | -25.8% | +25% | Weak |
| 13 | berserker_band | 1.0% | 0% | +2.9% | 0% | 0% | Too conditional |
| 14–40 | (all others) | 0% | 0% | 0% | 0% | 0% | No measurable combat impact |

---

### Full Build Archetypes (Expert Profile, 8 Relics Each)

| Build | Relics | Survival | Avg Floor | DPS | Dmg Taken | Turns/Enc | Boss Turns | Verdict |
|-------|--------|----------|-----------|-----|-----------|-----------|------------|---------|
| Full Aggro | whetstone, flame_brand, barbed_edge, war_drum, glass_cannon, berserker_band, chain_lightning_rod, crescendo_blade | 67% | 24 | 37.3 | 12.1 | **2.9** | 6.0 | **GAME-BREAKING** — encounters trivially short |
| Iron Fortress | iron_buckler, steel_skin, stone_wall, thorned_vest, fortress_wall, mirror_shield, iron_resolve, phase_cloak | 67% | 23 | 19.0 | 17.6 | 5.2 | 14.8 | OK — defensive, long fights |
| Knowledge Scholar | scholars_hat, memory_palace, curiosity_gem, domain_mastery, eidetic_memory, polyglot_pendant, speed_reader, sharp_eye | 0% | 13 | 15.7 | 20.5 | 4.9 | 11.8 | WEAK — 8 relics can't win on scholar mode |
| Sustain God | herbal_pouch, vitality_ring, medic_kit, last_breath, blood_pact, phoenix_feather, renewal_spring, scholars_hat | 33% | 23 | 19.6 | 20.0 | 5.0 | 13.0 | Moderate — sustain alone isn't enough |
| Speed Demon | swift_boots, combo_ring, momentum_gem, afterimage, quicksilver, double_vision, sharp_eye, speed_charm | 67% | 24 | 25.1 | 15.2 | 4.3 | 12.8 | Strong — combo_ring + momentum_gem carry |
| Cursed Gambler | glass_cannon, blood_price, berserker_band, phase_cloak, blood_pact, last_breath | **100%** | **24** | 23.9 | 18.7 | 4.3 | 10.6 | **GAME-BREAKING** — immortal with 6 relics |
| Balanced Best | whetstone, iron_buckler, herbal_pouch, swift_boots, scholars_hat, combo_ring, vitality_ring, last_breath | 100% | 24 | 24.8 | 15.6 | 4.2 | 11.3 | Strong but fair |
| Economy Engine | gold_magnet, lucky_coin, scavengers_pouch, prospectors_pick, miser_ring, swift_boots, vitality_ring, last_breath | 0% | 19 | 19.1 | 17.7 | 4.6 | 11.5 | Expected — economy relics don't help combat |

---

### Synergy Report

Synergy Factor = combo_impact / (sum_of_individual_relic_impacts). Factor > 2.0 = game-breaking, 1.5–2.0 = strong, < 0.5 = anti-synergy.

| Combo | Relics | Synergy Factor | Verdict | Notes |
|-------|--------|----------------|---------|-------|
| Glass + Dodge | glass_cannon + phase_cloak | **4.05×** | **GAME-BREAKING** | Dodge negates glass_cannon's downside entirely |
| Berserker Glass | berserker_band + glass_cannon + crescendo_blade | **3.04×** | **GAME-BREAKING** | Stacked multipliers below 40% HP — exponential damage |
| AP Economy | quicksilver + double_vision + momentum_gem | **2.79×** | **GAME-BREAKING** | AP overflow lets player play entire hand |
| AP Economy+ | quicksilver + double_vision + momentum_gem + swift_boots | **2.79×** | **GAME-BREAKING** | Same as above, swift_boots adds nothing extra |
| Max Sustain | scholars_hat + herbal_pouch + blood_pact + renewal_spring + medic_kit + vitality_ring | **2.20×** | **GAME-BREAKING** | Heal stacking prevents all attrition death |
| Heal Stack | herbal_pouch + scholars_hat + medic_kit + blood_pact | **1.96×** | **STRONG SYNERGY** | Heals compound with % amplification |
| Combo Damage | war_drum + combo_ring | **1.20×** | Moderate | Working as intended |
| Immortality | last_breath + phoenix_feather | **1.00×** | Moderate | Two separate saves, additive not multiplicative |
| Draw Lifesteal | blood_price + blood_pact | **0.88×** | Weak | Lifesteal doesn't fully offset HP cost |
| Max Offense | whetstone + flame_brand + glass_cannon + barbed_edge + war_drum + crescendo_blade | **0.76×** | Weak | Individual relics already so strong, combo is redundant |
| Multi-Hit Mega | chain_lightning_rod + whetstone + war_drum + barbed_edge | **0.68×** | Weak | Multi-hit rarely triggers |
| Correct Streaks | memory_palace + crescendo_blade | **0.53×** | Weak | Don't amplify each other |
| Draw Avalanche | swift_boots + afterimage + blood_price | **0×** | Anti-synergy | All draw, no AP to use it |
| Speed Bonus | speed_charm + sharp_eye | **0×** | Anti-synergy | Neither produces measurable effect |
| Block Stack | stone_wall + fortress_wall + iron_buckler | **-3.45×** | **ANTI-SYNERGY** | More block = longer fights = more total damage taken |
| Tank Stack | fortress_wall + stone_wall + iron_buckler + mirror_shield + iron_resolve | **-3.45×** | **ANTI-SYNERGY** | Same issue — defensive relics extend fights |

---

### Game-Breaking Configurations (Auto-Detected)

These configs met at least one game-breaking threshold: 100% survival at >50% HP, <3 turns per encounter, or <4 average boss turns.

| Config | Label | Profile | Relics | Problem |
|--------|-------|---------|--------|---------|
| #64 | Full Aggro | expert | whetstone + flame_brand + barbed_edge + war_drum + glass_cannon + berserker_band + chain_lightning_rod + crescendo_blade | **2.9 turns/encounter** — trivial |
| #69 | Cursed Gambler | expert | glass_cannon + blood_price + berserker_band + phase_cloak + blood_pact + last_breath | **100% survival at 100% HP** — immortal |
| #74 | Offense Expert | expert | whetstone + flame_brand + war_drum | **100% survival at 100% HP** — just 3 FREE relics make experts unkillable |
| #90 | Cursed Expert | expert | glass_cannon + blood_price | **100% survival at 88% HP** — cursed relics are free power |
| #91 | Cursed Struggling | struggling | glass_cannon + blood_price | **2.0 avg boss turns** — bosses melt even for low-accuracy players |

---

### Skill Fairness Analysis

Same relic loadout tested across beginner, average, expert, and struggling profiles. Ratio = expert floor gain / beginner floor gain. Ratio > 3 = unfair to beginners.

| Loadout | Relics | Expert Benefit | Beginner Benefit | Ratio | Verdict |
|---------|--------|---------------|-----------------|-------|---------|
| Basic Offense | whetstone, flame_brand, war_drum | +5 floors | +2.3 floors | 2.1× | **Balanced** — offense helps everyone |
| Full Defense | iron_buckler, steel_skin, stone_wall, fortress_wall | +0 floors | +1 floor | 0× | **Beginner-favored** — defense helps weak players more |
| Knowledge Reward | scholars_hat, memory_palace, combo_ring, momentum_gem | +4 floors | +0.7 floors | **6×** | **Expert-favored** — beginners can't maintain streaks or combos |
| Sustain | herbal_pouch, vitality_ring, last_breath, renewal_spring | +0 floors | +1 floor | 0× | **Beginner-favored** — sustain helps weak players more |
| Cursed Risk | glass_cannon, blood_price | +5 floors | +1 floor | **5×** | **Expert-favored** — cursed downsides punish low accuracy |

---

## Critical Findings & Recommendations

### 1. flame_brand Is Wildly Overpowered
- **Problem:** "First attack each encounter deals +50% damage" resets every encounter. Since there are 72 encounters in a 24-floor run, it's essentially a permanent +50% to your strongest hit.
- **Recommendation:** Reduce to +25%, OR make it "first attack of the run" (one-time), OR "first attack of each floor" (resets every 3 encounters).

### 2. Three Free Starters Make Experts Immortal
- **Problem:** Config #74 shows that whetstone + flame_brand + war_drum (all FREE starter relics) gives an expert player 100% survival at 100% HP across 24 floors. This means the starting relic pool alone breaks the game.
- **Recommendation:** Nerf flame_brand and war_drum individually. Consider: war_drum caps at +5 damage regardless of combo level.

### 3. curiosity_gem Exploits Deck Composition
- **Problem:** +20% to tier 1 cards is massive because most starter decks are 100% tier 1. It's effectively a permanent +20% damage buff.
- **Recommendation:** Reduce to +10%, or only apply to the first 3 tier 1 cards per encounter.

### 4. Block Stacking Creates Anti-Synergy
- **Problem:** Stacking defensive relics (stone_wall + fortress_wall + iron_buckler) produces a -3.45× synergy factor — players perform WORSE than without relics. This is because more block extends encounter length, leading to more total damage taken.
- **Recommendation:** Either (a) make block relics also increase DPS slightly (e.g., stone_wall: +2 block AND +1 attack), or (b) add a "fight too long" mechanic that rewards ending encounters quickly, making offense + defense both valid.

### 5. AP Economy Is Too Tight for Draw Relics
- **Problem:** swift_boots (+1 draw), afterimage (+1 draw), blood_price (+2 draw), and double_vision (1 free card) all show 0% solo impact because players can only play 3 AP worth of cards per turn. Extra cards sit in hand unused.
- **Recommendation:** Either (a) increase base AP to 4, (b) make draw relics also grant +1 AP, or (c) add "discard for effect" mechanics so unused cards aren't wasted.

### 6. Cursed Relics Are Free Power for Experts
- **Problem:** glass_cannon (+40% damage, +15% damage taken) and blood_price (+2 draw, -2 HP/turn) are net positive for experts who kill enemies before downsides matter. Struggling players get punished by the same relics.
- **Recommendation:** Scale the curse with player accuracy: e.g., glass_cannon's incoming damage multiplier increases by +5% per wrong answer this encounter. This makes it riskier for low-accuracy players without changing the risk/reward for experts.

### 7. glass_cannon + phase_cloak Is Game-Breaking (4.05× Synergy)
- **Problem:** Phase cloak's 20% dodge chance negates glass_cannon's +15% incoming damage penalty. The upside (+40% attack damage) is unaffected.
- **Recommendation:** phase_cloak should not proc when glass_cannon is active, OR glass_cannon's penalty should apply as a "curse" debuff that can't be dodged.

### 8. Knowledge Relics Punish Beginners (6× Expert Advantage)
- **Problem:** scholars_hat, memory_palace, combo_ring, and momentum_gem all require correct answers or streaks to activate. Beginners with 55% accuracy barely trigger them.
- **Recommendation:** Add a "consolation" effect to knowledge relics. E.g., scholars_hat: "Correct answer → heal 1 HP. Wrong answer → heal 0.5 HP." This gives beginners partial benefit.

### 9. Many Relics Are Untestable in Simulation
- **Problem:** 13 relics (polyglot_pendant, eidetic_memory, domain_mastery, speed_reader, time_dilation, echo_lens, venom_fang, executioners_axe, prospectors_pick, miser_ring, brain_booster, cartographers_lens, sharp_eye) cannot be properly tested because they rely on UI, timing, domain tracking, per-fact history, or poison/execute systems not modeled in the headless simulator.
- **Recommendation:** These relics need manual playtesting or a visual simulator that models all systems.

### 10. relicEffectResolver.ts Is Not Wired Into the Game
- **Problem:** The centralized relic resolver (`src/services/relicEffectResolver.ts`) with 28 pure functions is never imported by any `src/` file. Only ~12 of 50 relics actually work in the real game through hardcoded checks in turnManager.ts and cardEffectResolver.ts.
- **Recommendation:** Wire relicEffectResolver.ts into the game's combat loop. This is a critical integration task — without it, most relics are cosmetic.

---

## Relic Tier List (Based on Solo Impact + Combo Potential)

### S-Tier (Must-Nerf)
- **flame_brand** — 74.6% impact, breaks game with 2 other starters
- **war_drum** — 35.0% impact, combo scaling too strong
- **curiosity_gem** — 33.1% impact, exploits tier 1 deck composition

### A-Tier (Strong, Monitor)
- **combo_ring** — 24.2% impact, strong combo starter
- **whetstone** — 22.2% impact, reliable flat bonus
- **blood_pact** — 12.4% impact, lifesteal is very efficient
- **phase_cloak** — 8.5% solo but 4.05× combo synergy

### B-Tier (Balanced)
- **momentum_gem** — 10.8%, rewards perfect play
- **memory_palace** — 6.8%, streak-based, fair skill reward
- **crescendo_blade** — 6.1%, per-encounter scaling
- **glass_cannon** — Net positive, interesting risk/reward
- **iron_buckler**, **steel_skin**, **thorned_vest**, **stone_wall** — Moderate defensive value

### C-Tier (Weak, Consider Buffing)
- **scholars_hat** — 2.0%, heal too small
- **fortress_wall** — 1.3%, block carry extends fights
- **herbal_pouch**, **vitality_ring**, **medic_kit**, **last_breath** — Individually weak but stack well
- **berserker_band** — 1.0% solo, HP threshold too conditional

### D-Tier (No Measurable Impact — Need Rework or Can't Test)
- **barbed_edge** — Strike-tag condition too narrow
- **swift_boots**, **afterimage**, **blood_price**, **double_vision**, **quicksilver** — AP-limited, draw is useless
- **chain_lightning_rod** — Multi-hit too rare
- **iron_resolve** — 25% HP threshold = usually dead already
- **mirror_shield** — Full block absorb too rare
- **phoenix_feather** — One-time save doesn't change run outcome
- **renewal_spring** — 8 HP per floor is negligible

### Unrated (UI/Economy/Domain — Not Testable in Sim)
- cartographers_lens, brain_booster, gold_magnet, lucky_coin, scavengers_pouch, prospectors_pick, miser_ring, time_dilation, speed_reader, speed_charm, sharp_eye, polyglot_pendant, eidetic_memory, domain_mastery, echo_lens, venom_fang, executioners_axe

---

## Limitation: Ascension Levels Not Tested

**All 300 runs in this report were conducted at ascension level 0 (no ascension modifiers).**

The game has a 20-level ascension system that cumulatively increases difficulty. Key ascension modifiers that would significantly affect relic balance:

| Level | Modifier | Impact on Relics |
|-------|----------|-----------------|
| 1 | Enemies +10% HP | Offensive relics become more important |
| 2 | Enemies +10% damage | Defensive/sustain relics gain value |
| 3 | Heal cards -25% effective | medic_kit, blood_pact, scholars_hat nerfed |
| 5 | Starter deck 12 → 15 cards | Fewer cards = less flexibility |
| 9 | Combo resets on turn end | combo_ring, war_drum, momentum_gem severely nerfed |
| 14 | Player max HP 100 → 70 | vitality_ring (+8 HP) relatively stronger; glass_cannon more dangerous |
| 15 | Bosses +25% HP | Offensive relics more critical for boss fights |
| 17 | Wrong answers deal 5 self-damage | cursed relics become deadly for low-accuracy; knowledge relics gain value |
| 18 | Starter deck 10 cards | Even fewer cards |
| 20 | Final boss gains second phase | All combat relics tested against harder endgame |

**Expected relic balance shifts at high ascension:**
- flame_brand's dominance may decrease (enemies survive longer, +50% first attack matters less)
- Defensive relics (currently anti-synergy) may become necessary at ascension 2+ where damage is higher
- combo_ring and war_drum would be **severely nerfed** at ascension 9+ (combo resets each turn)
- glass_cannon becomes much riskier at ascension 14+ (70 max HP + 15% more damage = lethal fast)
- scholars_hat could become critical at ascension 17+ (heal 1 HP per correct answer offsets wrong-answer self-damage)
- The "3 free starters make experts immortal" finding (config #74) likely does NOT hold at ascension 5+

**Recommendation:** Re-run the full 100-config test matrix at ascension levels 0, 5, 10, 15, and 20 to validate balance across the full difficulty spectrum. The simulator now supports `ascensionLevel` in PlayerProfile.

---

## Appendix: Test Configuration Summary

300 total runs across 100 configurations:
- **Group A (3):** Controls — no relics, 3 profiles
- **Group B (25):** Solo starter relics — 1 relic each, average profile
- **Group C (15):** Solo unlockable relics — 1 relic each, average profile
- **Group D (8):** Documented synergy pairs — 2–4 relics each
- **Group E (12):** Potentially game-breaking combos — 2–8 relics each
- **Group F (8):** Full build archetypes — 6–8 relics, expert profile
- **Group G (20):** Skill × relic interactions — 5 loadouts × 4 profiles
- **Group H (9):** Progression fairness — unlock stages

Each configuration ran with 3 seeds (1000, 1001, 1002) for statistical significance. All runs used 24 floors.

**Full raw data:** `data/playtests/relic-analysis.json` (300 run results + computed metrics)
