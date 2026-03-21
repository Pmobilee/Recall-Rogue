# Recall Rogue — Relic Design Deep Research Brief

> **Purpose:** Complete reference for the relic system — every existing relic, synergy combo, trigger type, effect resolver hook, and design constraint. Use this to research and design X new relics that are creative, synergistic, and complementary to the existing 42-relic catalogue.

---

## 1. GAME CONTEXT — How Relics Fit In

Recall Rogue is a **card roguelite where every card is a knowledge fact**. Players answer quiz questions to power up their cards (Charge Play = quiz, Quick Play = no quiz). Relics are passive items collected during runs that modify combat, quiz interactions, economy, and card behavior.

**Key mechanics relics interact with:**
- **Quick Play vs Charge Play** — Cards can be played instantly (1 AP, base power) or Charged via quiz (2 AP, ~3x power if correct, 0.7x if wrong)
- **Knowledge Chains** — Playing same-chain-type cards consecutively builds multipliers: 1.0x, 1.3x, 1.7x, 2.2x, 3.0x
- **Combo System** — Consecutive correct answers build multipliers: 1.0x, 1.15x, 1.30x, 1.50x, 1.75x, 2.00x
- **Mastery Levels** — Cards level 0-5 during a run via correct/wrong Charges. Level 5 = auto-play
- **Echo Cards** — Wrong Charge answers spawn ghost cards that can ONLY be Charged (85% chance)
- **Knowledge Surge** — Every few turns, a Surge turn grants bonus effects
- **Speed Bonus** — Answering in first 25% of timer grants 1.5x multiplier
- **Status Effects** — Poison, Regen, Strength, Weakness, Vulnerable, Immunity

---

## 2. RELIC ACQUISITION & ECONOMY

| Parameter | Value |
|-----------|-------|
| **Max Relic Slots** | 5 (6 with Scholar's Gambit) |
| **Drop after regular combat** | 10% chance |
| **Boss/mini-boss reward** | Choose 1 of 3 relics |
| **Boss relic quality** | Weighted toward rare/legendary |
| **Shop relics** | 3 per shop visit |
| **Reroll cost** | 50 gold (max 1 reroll per selection) |
| **Pity timer** | After 4 consecutive Common drops, next is guaranteed Uncommon+ |
| **Sell value** | Common: 15g, Uncommon: 25g, Rare: 35g, Legendary: 50g |

### Shop Prices by Rarity
| Rarity | Price |
|--------|-------|
| Common | 100g |
| Uncommon | 160g |
| Rare | 250g |
| Legendary | 400g |

### Rarity Drop Weights
| Context | Common | Uncommon | Rare | Legendary |
|---------|--------|----------|------|-----------|
| Random drop | 50% | 30% | 15% | 5% |
| Boss reward | 20% | 35% | 30% | 15% |

---

## 3. RELIC ARCHITECTURE — Types, Triggers & Effects

### 3.1 Rarity Tiers (4)
| Tier | Count | Identity |
|------|-------|----------|
| **Common** | 11 | Stat sticks, simple permanent bonuses |
| **Uncommon** | 14 | Conditional effects, build-defining synergies |
| **Rare** | 15 | Powerful build-arounds, unlock via Mastery Coins + level |
| **Legendary** | 2 | Game-changing effects, late-game unlocks |

### 3.2 Categories (12)
| Category | Identity | Current Count |
|----------|----------|---------------|
| `offensive` | Flat damage, attack multipliers | 2 |
| `defensive` | Block, damage reduction, thorns | 4 |
| `sustain` | Healing, lethal saves, resurrection | 4 |
| `tactical` | Draw manipulation, card flow | 2 |
| `knowledge` | Quiz-interaction bonuses | 4 |
| `economy` | Gold, shop, reward manipulation | 4 |
| `cursed` | Power + downside | 2 |
| `chain` | Knowledge Chain multipliers and bonuses | 4 |
| `speed` | Fast-answer rewards | 2 |
| `burst` | AP storage, big-turn enablers | 3 |
| `poison` | Poison tick/duration amplification | 2 |
| `glass_cannon` | High risk / high reward damage | 3 |

### 3.3 Trigger Types (28)
These are the hooks where relic effects fire. The effect resolver has dedicated functions for each.

| Trigger | When It Fires | Used By |
|---------|---------------|---------|
| `permanent` | Always active, no trigger needed | Whetstone, Swift Boots, Gold Magnet, Volatile Core, Reckless Resolve, Plague Flask, Festering Wound, Domain Mastery Sigil, Prismatic Shard |
| `on_run_start` | Once when run begins | Vitality Ring |
| `on_encounter_start` | Start of each combat encounter | Lucky Coin |
| `on_encounter_end` | End of each combat encounter | Herbal Pouch |
| `on_turn_start` | Start of each player turn | Iron Shield, Blood Price (AP gain) |
| `on_turn_end` | End of each player turn | Aegis Stone, Regeneration Orb, Overflow Gem, Capacitor |
| `on_attack` | When player plays an attack card | — |
| `on_block` | When player plays a shield card | — |
| `on_card_play` | When any card is played | Double Down |
| `on_damage_taken` | When player takes damage | Steel Skin, Thorn Crown |
| `on_lethal` | When player would die | Last Breath, Phoenix Feather |
| `on_correct_answer` | Any correct quiz answer | — |
| `on_wrong_answer` | Any wrong quiz answer | — |
| `on_charge_correct` | Correct Charge Play specifically | Combo Ring, Adrenaline Shard, Memory Nexus, Quicksilver Quill, Crit Lens, Bastion's Will, Scholar's Crown, Mirror of Knowledge |
| `on_charge_wrong` | Wrong Charge Play specifically | Insight Prism |
| `on_speed_bonus` | Fast answer triggers speed bonus | — |
| `on_perfect_turn` | All cards played correctly in a turn | — |
| `on_echo_play` | Echo card is played | Echo Lens |
| `on_card_skip` | Card is skipped/not played | — |
| `on_multi_hit` | Multi-hit attack connects | — |
| `on_kill` | Enemy defeated | — |
| `on_boss_kill` | Boss specifically defeated | — |
| `on_floor_advance` | Player moves to next floor | — |
| `on_parry` | Parry card triggers | — |
| `on_overheal` | Overheal card triggers | — |
| `on_chain_complete` | Knowledge Chain of 2+ completes | Resonance Crystal, Chain Reactor, Echo Chamber |
| `on_surge_start` | Knowledge Surge turn begins | Time Warp |

**Note:** Many triggers have 0 relics using them — these are explicitly wired in the resolver as extension points. New relics can use ANY of these triggers without new code.

---

## 4. COMPLETE RELIC CATALOGUE — All 42 Relics

### 4.1 STARTER RELICS — Common (11)

| ID | Name | Trigger | Effect | Category |
|----|------|---------|--------|----------|
| `whetstone` | Whetstone | permanent | All attack cards +2 base damage | offensive |
| `iron_shield` | Iron Shield | on_turn_start | +2 block each turn | defensive |
| `vitality_ring` | Vitality Ring | on_run_start | +20 max HP this run | sustain |
| `herbal_pouch` | Herbal Pouch | on_encounter_end | Heal 8 HP after each combat | sustain |
| `swift_boots` | Swift Boots | permanent | Draw 6 cards/turn instead of 5 | tactical |
| `combo_ring` | Combo Ring | on_charge_correct | First Charged correct/turn grants +1 damage to all attacks that turn | offensive |
| `steel_skin` | Steel Skin | on_damage_taken | -3 damage from all sources (min 1) | defensive |
| `gold_magnet` | Gold Magnet | permanent | +30% gold from all sources | economy |
| `merchants_favor` | Merchant's Favor | permanent | +1 card and +1 relic choice in shops | economy |
| `lucky_coin` | Lucky Coin | on_encounter_start | Start encounter with 1 random buff (Empower, +2 block, +1 AP, or Draw 1) | economy |
| `scavengers_eye` | Scavenger's Eye | permanent | See 4 card choices after combat instead of 3 | economy |

### 4.2 STARTER RELICS — Uncommon (14)

| ID | Name | Trigger | Effect | Category |
|----|------|---------|--------|----------|
| `last_breath` | Last Breath | on_lethal | Once/encounter: survive lethal at 1 HP, gain 8 block | sustain |
| `tag_magnet` | Tag Magnet | permanent | +30% chance to draw same-chain-type cards | chain |
| `adrenaline_shard` | Adrenaline Shard | on_charge_correct | Correct Charge <3s refunds 1 AP (once/turn) | speed |
| `volatile_core` | Volatile Core | permanent | +50% attack damage. Wrong Charge = 3 self-damage + 3 enemy damage | glass_cannon |
| `aegis_stone` | Aegis Stone | on_turn_end | Block carries between turns (max 15). At 15 block = Thorns 2 | defensive |
| `regeneration_orb` | Regeneration Orb | on_turn_end | Heal 3 HP if 2+ shield cards played this turn | defensive |
| `plague_flask` | Plague Flask | permanent | Poison ticks +2 damage. Poison lasts +1 turn | poison |
| `memory_nexus` | Memory Nexus | on_charge_correct | 3 correct Charges in encounter = draw 2 extra next turn | knowledge |
| `insight_prism` | Insight Prism | on_charge_wrong | Wrong Charge reveals correct answer; next same-fact auto-succeeds | knowledge |
| `blood_price` | Blood Price | permanent | +1 AP/turn. Lose 2 HP/turn | cursed |
| `reckless_resolve` | Reckless Resolve | permanent | Below 40% HP: +50% ATK. Above 80% HP: -15% ATK | glass_cannon |
| `overflow_gem` | Overflow Gem | on_turn_end | 4+ AP spent this turn = last card +75% effect | burst |
| `resonance_crystal` | Resonance Crystal | on_chain_complete | Each chain link beyond 2 draws +1 card at end of turn | chain |
| `echo_lens` | Echo Lens | on_echo_play | Echo cards deal full power even on wrong Charge (1.0x always) | tactical |

### 4.3 UNLOCKABLE RELICS — Rare (15)

| ID | Name | Trigger | Unlock Lvl | Effect | Category |
|----|------|---------|-----------|--------|----------|
| `chain_reactor` | Chain Reactor | on_chain_complete | 1 | Chains of 2+ deal 6 splash damage per chain link | chain |
| `echo_chamber` | Echo Chamber | on_chain_complete | 3 | 2+ chain replays first card at 60% power (no quiz, no AP) | chain |
| `quicksilver_quill` | Quicksilver Quill | on_charge_correct | 5 | Charge correct <2s = additional 1.5x multiplier | speed |
| `time_warp` | Time Warp | on_surge_start | 6 | Surge turns: timer halved, Charge multiplier 5.0x, +1 AP | speed |
| `crit_lens` | Crit Lens | on_charge_correct | 8 | 25% chance to DOUBLE final damage on Charged correct | glass_cannon |
| `thorn_crown` | Thorn Crown | on_damage_taken | 10 | 15+ block at turn start = reflect 5 damage per attack received | defensive |
| `bastions_will` | Bastion's Will | on_charge_correct | 11 | Charged shields +75% block. Quick Play shields +25% block | defensive |
| `festering_wound` | Festering Wound | permanent | 13 | Enemy has 3+ poison = all attacks +40% damage | poison |
| `capacitor` | Capacitor | on_turn_end | 14 | Store unused AP (max 3). Release as bonus AP next turn at 1.5x | burst |
| `double_down` | Double Down | on_card_play | 15 | Once/encounter: double-Charge a card. Both correct=5x, one=1.5x, both wrong=0.3x | burst |
| `scholars_crown` | Scholar's Crown | on_charge_correct | 16 | T1 Charge +10%, T2+ Charge +40%, T3 auto-Charge +75% | knowledge |
| `domain_mastery_sigil` | Domain Mastery Sigil | permanent | 18 | 4+ same-domain cards in deck = +30% base damage for that domain | knowledge |
| `phoenix_feather` | Phoenix Feather | on_lethal | 18 | Once/run: resurrect at 15% HP. All cards auto-Charge free for 1 turn | sustain |
| `scholars_gambit` | Scholar's Gambit | permanent | 20 | +1 relic slot (5->6). Wrong Charges deal 3 self-damage | cursed |
| `toxic_bloom` | Toxic Bloom | permanent | 24 | **Phase 2 only.** Poison kill spreads 3 poison to all enemies | poison |

### 4.4 UNLOCKABLE RELICS — Legendary (2)

| ID | Name | Trigger | Unlock Lvl | Effect | Category |
|----|------|---------|-----------|--------|----------|
| `prismatic_shard` | Prismatic Shard | permanent | 20 | All chain multipliers +0.5x. 5-chains grant +1 AP | chain |
| `mirror_of_knowledge` | Mirror of Knowledge | on_charge_correct | 22 | Once/encounter: replay Charged card at 1.5x (no quiz, no AP) | knowledge |

---

## 5. HIDDEN SYNERGY SYSTEM — Multi-Relic Combos

Synergies are **never documented in-game**. Players discover them through play. Subtle relic pulse animations hint at activation. Three discovery tiers:

### 5.1 Tier 1 — Obvious (5-10 runs to discover)
Already work via natural stat stacking; detected for UI feedback.

| Synergy ID | Name | Required Relics | Hidden Bonus |
|------------|------|-----------------|--------------|
| `glass_berserker` | Glass Berserker | glass_cannon + berserker_band | Natural damage stacking |
| `immortal_puncher` | Immortal Puncher | blood_pact + berserker_band | Natural lifesteal + damage |
| `untouchable` | Untouchable | fortress_wall + mirror_shield + stone_wall | Natural block stacking |

### 5.2 Tier 2 — Expert (20-50 runs)
New hidden numeric bonuses not achievable from individual relics.

| Synergy ID | Name | Required Relics | Hidden Bonus |
|------------|------|-----------------|--------------|
| `crescendo_executioner` | Crescendo Executioner | crescendo_blade + executioners_axe | +5% per consecutive correct attack (stacking), Execute flat bonus doubled (+5 -> +10) |
| `perpetual_motion` | Perpetual Motion | blood_price + blood_pact + quicksilver | Blood Price self-damage reduced (2 -> 1), lifesteal doubled (25% -> 50%) |
| `knowledge_engine` | Knowledge Engine | eidetic_memory + domain_mastery + scholars_hat | Scholar's Hat heal increased (3 -> 5 HP per correct) |
| `speed_demon` | Speed Demon | Any 2 of: speed_reader, sharp_eye, speed_charm | Speed bonus threshold widened (25% -> 40%), multiplier boosted (1.5x -> 2.25x) |
| `echo_master` | Echo Master | echo_lens + combo_ring | Combo starts at index 3 (1.50x) instead of index 1 (1.15x) |

### 5.3 Tier 3 — Mastery Secrets (100+ runs)
Deep hidden mechanics requiring specific game-state tracking.

| Synergy ID | Name | Required | Hidden Bonus |
|------------|------|----------|--------------|
| `phoenix_rage` | Phoenix Rage | phoenix_feather + glass_cannon + berserker_band | On resurrect: +50% damage for 5 turns, glass cannon penalty removed for 3 turns |
| `perfect_storm` | Perfect Storm | scholars_hat + memory_palace + domain_mastery | Activates at 10+ consecutive correct answers (massive hidden bonus) |
| `mastery_ascension` | Mastery Ascension | 5+ Tier 3 cards in deck (no relics needed) | +1 flat damage per T3 card (max +8) |

---

## 6. EFFECT RESOLVER — All Wired Hooks

The `relicEffectResolver.ts` has dedicated resolver functions for each game event. Each function checks which relics are held and returns computed bonuses. New relics plug into these existing hooks.

### 6.1 All Effect IDs Currently Implemented

**Offensive:**
- `attack_flat_bonus` — Flat +N damage to all attacks (Whetstone: +2)
- `attack_multiplier_bonus` — +N% attack damage (Volatile Core: +50%)
- `low_hp_attack_bonus` — +N% attack below X% HP (Reckless Resolve: +50% below 40%)
- `high_hp_attack_penalty` — -N% attack above X% HP (Reckless Resolve: -15% above 80%)
- `high_poison_attack_bonus` — +N% attack when enemy has X+ poison (Festering Wound: +40% at 3+)
- `domain_concentration_bonus` — +N% base damage for domain with X+ cards (Domain Mastery Sigil: +30% at 4+)
- `first_charge_turn_damage_bonus` — +N damage for rest of turn on first Charge correct (Combo Ring: +1)
- `crit_chance_on_charge` — N% chance to double final damage on Charge correct (Crit Lens: 25%)

**Defensive:**
- `turn_start_block` — +N block each turn (Iron Shield: +2)
- `flat_damage_reduction` — -N damage from all sources, min 1 (Steel Skin: -3)
- `block_carry` — Block persists between turns, max N (Aegis Stone: max 15)
- `block_cap_thorns` — At max block, gain Thorns N (Aegis Stone: Thorns 2 at 15)
- `high_block_thorns` — Reflect N damage when attacked at X+ block (Thorn Crown: 5 at 15+)
- `charged_shield_bonus` — +N% block on Charged shield cards (Bastion's Will: +75%)
- `quick_shield_bonus` — +N% block on Quick Play shield cards (Bastion's Will: +25%)
- `shield_play_heal` — Heal N HP if X+ shield cards played this turn (Regen Orb: 3 HP at 2+)

**Sustain:**
- `max_hp_bonus` — +N max HP (Vitality Ring: +20)
- `encounter_end_heal` — Heal N HP post-combat (Herbal Pouch: +8)
- `lethal_save_encounter` — Survive lethal at 1 HP, once/encounter (Last Breath)
- `lethal_save_block` — +N block on lethal save (Last Breath: +8)
- `lethal_save_run` — Resurrect at N% HP, once/run (Phoenix Feather: 15%)
- `phoenix_autocharge_turns` — Auto-Charge free for N turns on resurrect (Phoenix Feather: 1)

**Tactical/Draw:**
- `draw_count_bonus` — +N cards drawn per turn (Swift Boots: +1)
- `same_category_draw_bias` — +N% chance to draw same-chain cards (Tag Magnet: 30%)
- `echo_full_power` — Echo cards at 1.0x regardless of quiz result (Echo Lens)

**Knowledge/Quiz:**
- `encounter_charge_draw_bonus` — Draw N extra next turn after X Charge corrects (Memory Nexus: 2 at 3)
- `wrong_charge_reveal_and_autopass` — Wrong Charge reveals answer + auto-succeed next (Insight Prism)
- `tier1_charge_bonus` — +N% power for T1 Charged facts (Scholar's Crown: +10%)
- `tier2_charge_bonus` — +N% power for T2+ Charged facts (Scholar's Crown: +40%)
- `tier3_charge_bonus` — +N% power for T3 auto-Charged facts (Scholar's Crown: +75%)
- `charge_correct_free_replay` — Replay Charged card at N% once/encounter (Mirror of Knowledge: 150%)

**Speed:**
- `fast_charge_ap_refund` — Fast Charge (<Ns) refunds 1 AP once/turn (Adrenaline Shard: <3s)
- `fast_charge_multiplier` — Fast Charge (<Ns) = Nx extra multiplier (Quicksilver Quill: 1.5x at <2s)
- `surge_timer_halved` — Surge turns: quiz timer x0.5 (Time Warp)
- `surge_charge_multiplier_override` — Surge turns: Charge multiplier = N (Time Warp: 5.0x)
- `surge_ap_bonus` — +N AP on surge turns (Time Warp: +1)

**Chain:**
- `chain_splash_damage` — N splash damage per chain link at X+ chains (Chain Reactor: 6 at 2+)
- `chain_echo_replay` — First chain card replays at N% on X+ chain (Echo Chamber: 60% at 2+)
- `chain_draw_bonus` — +N draw per chain link beyond X (Resonance Crystal: +1 beyond 2)
- `chain_multiplier_bonus` — All chain multipliers +N (Prismatic Shard: +0.5)
- `five_chain_ap_bonus` — +N AP on completing 5-chain (Prismatic Shard: +1)

**Burst:**
- `high_ap_spend_bonus` — +N% to last card if X+ AP spent this turn (Overflow Gem: +75% at 4+)
- `unused_ap_store` — Store unused AP, max N (Capacitor: max 3)
- `stored_ap_release` — Release stored AP at Nx rate (Capacitor: 1.5x)
- `double_charge_activate` — Double-Charge card once/encounter (Double Down: 5x/1.5x/0.3x)

**Economy:**
- `currency_multiplier_bonus` — +N% currency from all sources (Gold Magnet: +30%)
- `shop_card_bonus` — +N card choices in shops (Merchant's Favor: +1)
- `shop_relic_bonus` — +N relic choices in shops (Merchant's Favor: +1)
- `random_encounter_buff` — Random buff at encounter start (Lucky Coin)
- `reward_option_bonus` — +N card reward options (Scavenger's Eye: +1)

**Cursed:**
- `ap_bonus_per_turn` — +N AP per turn (Blood Price: +1)
- `hp_loss_per_turn` — -N HP per turn (Blood Price: -2)
- `wrong_charge_self_damage` — Wrong Charge = N self-damage (Volatile Core: 3, Scholar's Gambit: 3)
- `wrong_charge_enemy_damage` — Wrong Charge = N enemy-damage (Volatile Core: 3)
- `relic_slot_bonus` — +N relic slots (Scholar's Gambit: +1)

**Poison:**
- `poison_tick_bonus` — +N damage per poison tick (Plague Flask: +2)
- `poison_duration_bonus` — Poison lasts +N turns (Plague Flask: +1)
- `poison_death_spread` — On poison kill: spread N poison to all enemies (Toxic Bloom: 3, Phase 2)

---

## 7. WHAT MAKES A GREAT RELIC IN THIS GAME

### 7.1 Design Principles

1. **Knowledge interaction is the differentiator.** The best relics reward quiz performance (Charge correct bonuses, speed rewards, streak tracking). Generic "do more damage" relics are less interesting than "answer fast = AP refund."

2. **Build identity matters.** Each relic should make the player think "I should draft differently now." Plague Flask makes you want Hex cards. Aegis Stone makes you want shield cards. Tag Magnet makes you want chain-focused decks.

3. **Hidden synergies create discovery.** The 3-tier synergy system is a major engagement driver. New relics should create NEW hidden synergy combos with existing relics, not just be standalone.

4. **Cursed relics create the best stories.** Blood Price (+1 AP, -2 HP/turn) creates dramatic tension every turn. Scholar's Gambit (+1 slot, wrong hurts) rewards knowledgeable players. More cursed relics with meaningful tradeoffs are always welcome.

5. **Trigger diversity prevents stale gameplay.** 28 triggers exist, many underused. Relics using `on_kill`, `on_boss_kill`, `on_floor_advance`, `on_parry`, `on_overheal`, `on_card_skip`, `on_perfect_turn` would add variety.

6. **Once-per-X limiters prevent degeneracy.** Many relics are "once per turn" or "once per encounter." This is crucial for balance — unlimited triggers on fast-fire effects break the game.

7. **Rarity should match complexity.** Commons = understand in 2 seconds. Uncommons = one conditional. Rares = build-around. Legendaries = game-warping.

### 7.2 Balance Guardrails

- **Common relics** should be simple stat bonuses worth ~5-10% power increase
- **Uncommon relics** should be worth ~15-25% power increase with a condition
- **Rare relics** should be worth ~30-50% but require build commitment or have a downside
- **Legendary relics** should be worth ~50-100% but reshape how you play
- **Never more than +2 AP/turn** from relics (Blood Price gives +1, that's already strong)
- **Never more than +2 draw/turn** from relics (Swift Boots gives +1)
- **Lethal saves must be limited** — once/encounter (Last Breath) or once/run (Phoenix Feather)
- **Gold generation relics** should be percentage-based, not flat, to scale with progression
- **Self-damage relics** should deal 2-5 HP, never more (player has 100-120 max HP)
- **Block carry** should have a cap (Aegis Stone caps at 15) — uncapped carry breaks the game

### 7.3 Red Lines

- No relics that remove the quiz entirely (undermines core loop)
- No relics that make Quick Play strictly superior to Charge (Charge must always be rewarded)
- No relics that stack with themselves (each relic is unique per run)
- No relics with 4+ effects (readability on mobile)
- No relics that require memorizing complex state across encounters
- No relics that are strictly better versions of existing relics (sidegrade, never upgrade)
- No relics that are auto-pick regardless of build (every relic should have a build where it's bad)

---

## 8. IDENTIFIED GAPS & OPPORTUNITIES

### 8.1 Underused Triggers (0 relics currently)

| Trigger | Opportunity |
|---------|-------------|
| `on_attack` | Relic that does something EACH time an attack card is played (not just once/turn) |
| `on_block` | Relic that rewards frequent shield card plays |
| `on_correct_answer` | Global correct-answer bonus (not Charge-specific) |
| `on_wrong_answer` | Relic that softens the blow of wrong answers |
| `on_speed_bonus` | Relic specifically for speed bonus moments |
| `on_perfect_turn` | Bonus for turns where EVERY played card was correct |
| `on_card_skip` | Reward for NOT playing a card |
| `on_multi_hit` | Bonus when multi-hit cards connect |
| `on_kill` | Bonus on enemy defeat |
| `on_boss_kill` | Powerful one-time per-boss bonus |
| `on_floor_advance` | Between-floor bonuses |
| `on_parry` | Reward for using Parry cards |
| `on_overheal` | Reward for using Overheal cards |

### 8.2 Missing Build Archetypes

| Archetype | Gap | Idea Direction |
|-----------|-----|----------------|
| **Exhaust** | No relic rewards exhausting cards | "When a card is exhausted, gain 3 block" or "Deal 2 damage per exhausted card" |
| **Big Hand** | No relic rewards having many cards in hand | "+1 damage per card in hand when attacking" |
| **Discard** | No relic interacts with discard pile size | "At 10+ discard pile, all attacks +20%" |
| **Heal Tank** | Only Herbal Pouch heals post-combat | Relics for in-combat healing triggers |
| **AP Hoarder** | Only Capacitor stores AP | More "save AP for big turns" relics |
| **Domain Specialist** | Only Domain Mastery Sigil | Relics for mono-domain decks |
| **Wrong-Answer Conversion** | Only Insight Prism helps with wrong answers | Relics that BENEFIT from wrong answers |
| **Card Removal** | No relic interacts with deck thinning | "Each time you remove a card, gain +2 max HP" |
| **Status Spreader** | Only Toxic Bloom (Phase 2) | Relics that spread/amplify status effects |
| **Turn Counter** | No relic cares about turn number | "After turn 5, gain +2 damage per turn" |

### 8.3 Category Imbalances

| Category | Current Count | Ideal | Notes |
|----------|--------------|-------|-------|
| Economy | 4 | 4-5 | Adequate |
| Defensive | 4 | 5-6 | Could use 1-2 more |
| Knowledge | 4 | 5-6 | Core differentiator, deserves more |
| Chain | 4 | 4-5 | Well-supported but more variety welcome |
| Sustain | 4 | 4-5 | Adequate |
| Offensive | 2 | 3-4 | **Under-served** — needs more attack relics |
| Burst | 3 | 3-4 | OK |
| Glass Cannon | 3 | 3-4 | OK |
| Speed | 2 | 3-4 | **Under-served** — unique to this game, should be expanded |
| Poison | 2 | 3-4 | **Under-served** — needs 1-2 more |
| Cursed | 2 | 3-4 | **Under-served** — most interesting category, needs more |
| Tactical | 2 | 3-4 | **Under-served** |

---

## 9. RESEARCH DIRECTIVES FOR THE DEEP RESEARCH AGENT

### 9.1 Games to Study for Relic/Artifact Design

**Card Roguelites:**
- **Slay the Spire** — 180+ relics across 4 characters. Study: boss relics with downsides, class-specific relics, "on pick up" vs "passive" vs "triggered." Note their energy relics (Lantern, Happy Flower, Ice Cream) and how they create AP/energy economy decisions. The STS relic system is the gold standard.
- **Slay the Spire 2** — ~200+ relics at launch. Study: how they evolved the formula, new trigger types, multi-character synergies, and what they added that STS1 was missing.
- **Monster Train** — Artifact system. Study: champion-specific vs universal artifacts, artifacts that modify spell behavior, and "clan synergy" artifacts.
- **Balatro** — Joker system (effectively relics). Study: how 150 jokers create infinite build variety from simple poker mechanics. The "negative" joker slot concept. Joker ordering mattering.
- **Inscryption** — Sigil system (card-attached relics). Study: how sigils combo, the "totem" system that applies sigils to card types.
- **Vault of the Void** — Void stone system. Study: how void/purge mechanics interact with relics.
- **Across the Obelisk** — Perks as relics. Study: party-wide vs individual buffs, healing vs damage tradeoffs.
- **Ring of Pain** — Equipment relics. Study: slot limitations creating meaningful choices.
- **Chrono Ark** — Character-specific relics. Study: how relics interact with specific character kits.
- **Roguebook** — Embellishment system. Study: dual-hero relic design, positional bonuses.

**RPG Roguelites with Artifact Systems:**
- **Hades / Hades 2** — Boon system. Study: god-specific boons, duo boons (hidden combos), boon rarity tiers, "exchange" boons that replace existing ones.
- **Risk of Rain 2** — 100+ items. Study: stacking items, "on-kill" proc chains, lunar items (cursed), equipment (active relics).
- **Enter the Gungeon** — Passive items + synergies. Study: gun + item combos, how hidden synergies create discovery moments.
- **Dead Cells** — Mutation system. Study: build-defining mutations, mutations that change playstyle.
- **Binding of Isaac** — 700+ items. Study: item synergy depth, transformation sets, and how absurd item combos create memorable runs.

**Knowledge/Quiz Integration:**
- No existing game has quiz-powered relics, so study how **confidence mechanics** work in gambling games (poker tells, Wits & Wagers betting). How can relics reward CONFIDENCE in knowledge?

### 9.2 Specific Relic Mechanics to Research and Adapt

1. **Boss Relics with Downsides (STS)** — Runic Dome (no enemy intents), Philosopher's Stone (enemies +1 strength), Coffee Dripper (can't rest). These create the hardest and most rewarding choices. Our cursed category needs more of this.

2. **Energy/AP Manipulation** — STS: Lantern (+1 energy turn 1), Happy Flower (+1 energy every 3 turns), Ice Cream (unspent energy carries over). How can we create more AP manipulation that isn't just "+1 AP"?

3. **Proc Chains (Risk of Rain 2)** — Items that trigger other items. "On kill, gain 3 block" + "When gaining block, deal 1 damage" = infinite combo potential. How far can our trigger system support chaining?

4. **Duo Boons (Hades)** — Two-god combos that create entirely new effects. Our hidden synergy system already does this but only has 10 combos. How many more can we add?

5. **Negative/Cursed Items (Binding of Isaac, STS)** — Items you might WANT to pick up for their hidden benefits despite obvious downsides. Bob's Brain, Cursed Key, Ectoplasm.

6. **Transformation Sets (Binding of Isaac)** — Collect 3+ items from a theme = transform into a powered-up form. Could we have "collect 3 poison relics = transform into Plague Doctor" with a mega-bonus?

7. **Conditional Scaling (STS Shuriken/Kunai)** — "Every 3rd attack played, gain 1 strength." Relics that count actions and provide periodic bonuses.

8. **Build-Around Anchors (Balatro Jokers)** — Jokers like "Blueprint" (copy adjacent joker) that define entire strategies. Our Legendaries should be this impactful.

9. **Anti-Synergy as Design (STS Snecko Eye)** — Items that seem terrible but enable degenerate strategies for skilled players. Snecko Eye randomizes costs but gives +2 draw. What's our equivalent?

10. **Meta-Progression Relics** — Items that get stronger across multiple runs or reward long-term goals. Could tie into our mastery/FSRS system.

### 9.3 Knowledge-Specific Relic Concepts (Unique to This Game)

1. **Confidence Amplifier** — Before seeing the quiz, pre-commit to a multiplier (1x/2x/3x). Higher commitment = bigger reward/risk. No other game can do this.

2. **Domain Resonance Set** — A set of domain-specific relics (one per knowledge domain) that gain bonus effects when your deck concentrates in that domain.

3. **Wrong-Answer Arsenal** — A relic that CONVERTS wrong answers into a resource. "Each wrong answer charges this relic. At 5 charges, your next card deals 3x damage." Anti-knowledge becomes power.

4. **Memory Palace Expansion** — A relic that grows stronger the more UNIQUE facts you've correctly answered in a run. Rewards breadth of knowledge.

5. **Echo Resonator** — A relic that makes Echo cards more powerful instead of just playable. "Echo cards gain +50% power" or "Echo correct = double FSRS bonus."

6. **Speed Cascade** — A relic where consecutive fast answers (<3s) build a stacking speed multiplier that persists for the encounter.

7. **Chain Forge** — A relic that lets you "wildcard" one chain link per encounter (any card counts as matching the chain).

8. **Quiz Modifier Relic** — A relic that changes quiz parameters: fewer options (easier), more time, hint revealed, etc. — at the cost of reduced Charge multiplier.

9. **Mastery Accelerator** — A relic that grants +1 mastery level to ALL cards in hand when you get a 5-chain. Rapid mastery progression for chain builders.

10. **Streak Insurance** — A relic that preserves your combo count once per encounter when you answer wrong. Protects the flow state.

---

## 10. DELIVERABLE FORMAT

For each new relic, provide:

```
### Relic Name
- **ID:** snake_case_id
- **Rarity:** common/uncommon/rare/legendary
- **Category:** offensive/defensive/sustain/tactical/knowledge/economy/cursed/chain/speed/burst/poison/glass_cannon (or propose a new one)
- **Trigger:** [from the 28 available triggers, or propose a new one]
- **Effects:**
  - effectId: description (value)
  - [additional effects if multi-effect]
- **Description (max 20 words):** [what appears in the UI]
- **Flavor Text (1-2 sentences):** [lore/atmosphere]
- **Visual Description:** [for pixel art sprite generation]
- **Unlock Level:** [0 = starter, 1-24 = level-gated]
- **Cursed?** [yes/no, if yes describe downside]
- **Design Intent:** [why this relic exists, what build it enables, what decision it creates]
- **Synergizes With:** [existing relics, cards, and mechanics it combos with]
- **Hidden Synergy Potential:** [what NEW multi-relic combo could this enable?]
- **Inspired By:** [reference game/mechanic if applicable]
- **Balance Notes:** [potential degenerate interactions to watch, suggested limiters]
```

---

## 11. EVALUATION CRITERIA

Rate each relic design against:

1. **Build Identity (1-5):** Does picking this relic make you draft differently?
2. **Synergy Depth (1-5):** How many existing relics/cards does it interact with?
3. **Knowledge Integration (1-5):** Does it reward or interact with quiz performance?
4. **Decision Quality (1-5):** Would you sometimes SKIP this relic? (Auto-picks = bad design)
5. **Discovery Potential (1-5):** Does it create hidden combos or emergent strategies?
6. **Readability (1-5):** Can you understand it in under 5 seconds on a phone?
7. **Archetype Enablement (1-5):** Does it create or strengthen an underserved build?
8. **Fun/Story Factor (1-5):** Will players remember runs where they had this relic?

Aim for average 4+ across all criteria.

---

## 12. QUANTITY & MIX

Suggest **15-25 new relics** distributed as:
- 3-4 Commons (simple stat bonuses or straightforward triggers)
- 5-7 Uncommons (conditional effects, build nudges)
- 5-8 Rares (build-defining, unlock-gated)
- 2-3 Legendaries (game-warping, late unlock)
- 3-5 Cursed (across any rarity — power + meaningful downside)

Include at least:
- 3 relics using currently unused triggers (on_kill, on_perfect_turn, on_wrong_answer, etc.)
- 3 relics that interact with the Knowledge Chain system
- 2 relics that interact with the Echo mechanic
- 3 relics that create NEW hidden synergy combos with existing relics
- 2 "anti-synergy" relics (seem bad but enable degenerate strategies)
- 2 relics that interact with the quiz speed/timer
- 1 relic that creates an entirely new build archetype

Also propose **5 new hidden synergy combos** using a mix of existing + new relics, following the 3-tier discovery system.

---

*This brief is the complete reference. Treat it as source of truth and design relics that feel native to the Recall Rogue system while pushing creative boundaries informed by the best relic/artifact design in the roguelite genre.*
