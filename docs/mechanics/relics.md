# Relic System

> **Purpose:** Complete reference for relic catalog, rarities, trigger system, acquisition mechanics, and slot rules.
> **Last verified:** 2026-04-09
> **Source files:** `src/data/relics/index.ts`, `src/data/relics/starters.ts`, `src/data/relics/unlockable.ts`, `src/data/relics/types.ts`, `src/services/relicEffectResolver.ts`, `src/services/relicAcquisitionService.ts`, `src/data/balance.ts`

## Relic Slots

- Default maximum: `MAX_RELIC_SLOTS = 5`
- With Scholar's Gambit: 6 slots (`SCHOLARS_GAMBIT_EXTRA_SLOT = 1`)
- No swap mechanic exists — relics are permanent for the run once acquired
- Sell refund: 40% of rarity-based shop price (`RELIC_SELL_REFUND_PCT = 0.40`)

## Rarities

| Rarity | Regular drop weight | Boss drop weight |
|---|---|---|
| common | 50% | 20% |
| uncommon | 30% | 35% |
| rare | 15% | 30% |
| legendary | 5% | 15% |

`RELIC_RARITY_WEIGHTS` and `RELIC_BOSS_RARITY_WEIGHTS` in `balance.ts`.

## Trigger Types (`RelicTrigger`)

| Trigger | When it fires |
|---|---|
| `permanent` | Passive — always active |
| `on_run_start` | Once when run begins |
| `on_encounter_start` | At start of each combat encounter |
| `on_turn_start` | Each player turn start |
| `on_turn_end` | Each player turn end |
| `on_attack` | When an attack card is played |
| `on_block` | When a block/shield card is played |
| `on_damage_taken` | When player takes damage |
| `on_lethal` | When player would be reduced to 0 HP |
| `on_charge_correct` | After a correct Charge quiz answer |
| `on_charge_wrong` | After a wrong Charge quiz answer |
| `on_chain_complete` | When a Knowledge Chain is completed |
| `on_chain_break` | When a Knowledge Chain is broken |
| `on_encounter_end` | After combat ends |
| `on_kill` | When an enemy is defeated |
| `on_elite_kill` | When an elite enemy is defeated |
| `on_boss_kill` | When a boss is defeated |
| `on_surge_start` | When a Knowledge Surge turn begins |
| `on_floor_advance` | When player descends to next floor |
| `on_exhaust` | When a card is exhausted |
| `on_discard` | When a card is discarded |
| `on_card_play` | When any card is played |
| `on_multi_hit` | During multi-hit attacks |

## Acquisition

### Regular Encounters
5% random drop chance (`RELIC_DROP_CHANCE_REGULAR = 0.05`), drawn via `generateRandomRelicDrop()`.
A pity system forces Uncommon+ if `pityActive`.

### Reward Rooms (Card Reward)
8% chance per floor (`RELIC_BONUS_CHANCE_REWARD_ROOM = 0.08`) to include a bonus relic alongside card choices.
Controlled by `bonusRelicOfferedThisFloor` flag — only one per floor. Implemented in `gameFlowController.ts`.

### Boss Encounters
`generateBossRelicChoices()` presents `RELIC_BOSS_CHOICES = 3` options using boss rarity weights.
Reroll costs 50 gold (`RELIC_REROLL_COST`), max 1 reroll per selection (`RELIC_REROLL_MAX`).

### Mini-Boss Encounters
`generateMiniBossRelicChoices()` presents 3 options using standard rarity weights.

### Shop
Relics appear in the shop at rarity-based gold prices.

### Eligibility (`getEligibleRelicPool`)
- Starter relics (`isStarter: true` or `startsUnlocked: true`): always eligible
- Unlockable relics: eligible when `playerLevel >= relic.unlockLevel`
- Relics with `excludeFromPool: true` are never offered in-run
- Player cannot receive a relic they already hold

## Starter Relics (25 total, all free)

All have `unlockCost: 0` and `startsUnlocked: true`.

### Common Starters (11)

| ID | Effect | Trigger |
|---|---|---|
| `whetstone` | +3 attack damage, -1 block on shields | permanent |
| `iron_shield` | Turn start block = 2 + shields played last turn | on_turn_start |
| `vitality_ring` | +20 max HP | on_run_start |
| `swift_boots` | Draw 6 cards per turn instead of 5 | permanent |
| `gold_magnet` | +30% gold from all sources | permanent |
| `merchants_favor` | +1 card and +1 relic choice in shops | permanent |
| `lucky_coin` | After 3 wrong Charges in encounter: +50% damage on next correct Charge | on_charge_wrong |
| `scavengers_eye` | Exhausting a card draws 1 card from draw pile | on_exhaust |
| `quick_study` | Preview 1 answer after 3+ correct Charges; wrong answers deal +2 self-damage | on_encounter_end |
| `thick_skin` | Start each encounter with 5 block | on_encounter_start |
| `tattered_notebook` | Exhausting a card grants +1 Strength this turn | on_exhaust |
| `battle_scars` | After taking a hit: next attack +3 damage (once/turn) | on_damage_taken |
| `brass_knuckles` | Start each turn with +1 temporary Strength (resets at turn end) | on_turn_start |

### Uncommon Starters (14)

| ID | Effect | Trigger |
|---|---|---|
| `last_breath` | Survive lethal at 1 HP + 8 block (once/encounter) | on_lethal |
| `herbal_pouch` | Apply 1 Poison to all enemies each turn; heal 3 HP after combat | on_turn_start |
| `steel_skin` | -2 damage taken (min 1) | on_damage_taken |
| `tag_magnet` | +30% chance to draw same chain-type cards | permanent |
| `adrenaline_shard` | Charge correct in <3s: refund 1 AP (once/turn) | on_charge_correct |
| `volatile_core` | +50% attack damage; wrong Charge deals 3 self-damage only | permanent |
| `aegis_stone` | Block from shields carries between turns (max 15); at 15 block gain Thorns 2 | on_turn_end |
| `regeneration_orb` | Heal 3 HP if 2+ shield cards played this turn | on_turn_end |
| `plague_flask` | All enemies start combat with 2 Poison | on_encounter_start |
| `memory_nexus` | Every 2 correct Charges per encounter: draw 2 extra next turn (repeats) | on_charge_correct |
| `insight_prism` | Wrong Charge: reveals answer; next same-fact appearance auto-succeeds | on_charge_wrong |
| `reckless_resolve` | Below 40% HP: +50% attack; above 80% HP: -15% attack | permanent |
| `overflow_gem` | 4+ AP spent in a turn: last card played gets +75% effect | on_turn_end |
| `resonance_crystal` | Per chain link beyond 2: draw +1 card at turn end | on_chain_complete |
| `domain_mastery_sigil` | Flow State: +1 AP/turn; Brain Fog: -1 AP/turn | on_turn_start |

### Rare Starters (1)

| ID | Effect | Trigger |
|---|---|---|
| `blood_price` | +1 AP per turn; -3 HP per turn (rarity: rare) | permanent |

## Unlockable Relics (17 total)

All have `isStarter: false`, `startsUnlocked: false`. Eligible once `playerLevel >= unlockLevel`.

### Rare Unlockables (15)

| ID | Effect | Trigger | unlockLevel |
|---|---|---|---|
| `chain_reactor` | Knowledge Chains 2+: 6 splash damage per chain link | on_chain_complete | 1 |
| `quicksilver_quill` | Charge correct <2s: ×1.5 additional multiplier | on_charge_correct | 5 |
| `time_warp` | Surge turns: quiz timer halved, Charge multiplier 5.0×, +1 AP | on_surge_start | 6 |
| `red_fang` | First attack per encounter +30% damage | on_encounter_start | 6 |
| `chronometer` | Quiz timer +3s; all Charge multipliers -15% | permanent | 6 |
| `null_shard` | Chain multipliers locked at 1.0×; all attacks +25% damage | permanent | 7 |
| `soul_jar` | Every 5 correct Charges stores 1 charge; spend to auto-succeed a quiz | on_charge_correct | 7 |
| `hemorrhage_lens` | Multi-hit attacks apply 1 Bleed per subsequent hit | on_multi_hit | 7 |
| `crit_lens` | 25% chance to double final damage on correct Charge | on_charge_correct | 8 |
| `archive_codex` | After combat: +1 flat damage per 10 total mastery levels in deck | on_encounter_end | 8 |
| `chain_forge` | Once/encounter: chain break prevented, card gets current multiplier, chain increments | on_chain_complete | 8 |
| `berserker_s_oath` | -30 max HP at run start; +40% attack damage | on_run_start | 9 |
| `ritual_blade` | First card each turn +50% damage; other cards -15% (rarity: rare) | on_card_play | 7 |
| `thorn_crown` | At 10+ block when attacked: reflect 5 damage | on_damage_taken | 10 |
| `bastions_will` | Charged shield cards: +75% block; Quick Play shields: +25% block | on_charge_correct | 11 |
| `festering_wound` | When enemy has 3+ poison stacks: all attacks +40% damage | permanent | 13 |
| `capacitor` | Unused AP at turn end stores (max 3); next turn gains stored AP | on_turn_end | 14 |
| `double_down` | Once/encounter: Charge same card twice. Both correct: 5×; one correct: 1.5×; both wrong: 0.3× | on_card_play | 15 |
| `scholars_crown` | +40% damage on Review Queue facts; +10% on all other correct Charges | on_charge_correct | 16 |
| `deja_vu` | Turn 1 of each encounter: 1 card from discard appears at -1 AP (level 15+: 2 cards) | on_turn_start | — |

### Legendary Unlockables (2)

| ID | Effect | Trigger | unlockCost | unlockLevel |
|---|---|---|---|---|
| `prismatic_shard` | All chain multipliers +0.5×; 5-chains grant +1 AP | permanent | 75 | 20 |
| `mirror_of_knowledge` | Once/encounter: after correct Charge, replay card at 1.5× (no quiz, no AP) | on_charge_correct | 75 | 22 |

### Cursed / Special Unlockables

| ID | Effect | Curse | unlockCost | unlockLevel |
|---|---|---|---|---|
| `scholars_gambit` | +1 relic slot (max 6) | Wrong Charge deals 1 self-damage | 60 | 20 |
| `phoenix_feather` | Once/run: resurrect at 15% HP; auto-Charge all cards free for 1 turn | — | 60 | 18 |

## Relic Effect Resolver (`relicEffectResolver.ts`)

Effects are resolved via pure functions from a `Set<string>` of held relic IDs. No side effects.

Key resolved contexts:
- `resolveTurnStartEffects()` — block grants (iron_shield: 2 + shieldsPlayedLastTurn), AP bonuses, draw bonuses, poison to all enemies (herbal_pouch), Capacitor release, Deja Vu spawn, `tempStrengthGain` (brass_knuckles: +1 temp Strength each turn start). Context field `shieldsPlayedLastTurn` required for iron_shield dynamic block.
- `resolveDamageTakenEffects()` — flat damage reduction (steel_skin: -1 nerfed from -3), thorns, pity counter. Note: thick_skin no longer increases damage taken (reworked to encounter_start_block, 2026-04-09).
- `resolveEncounterStartEffects()` — hollow_armor starting block (12), gladiator_s_mark temp Strength, plague_flask encounter start poison (2 stacks to all enemies), thick_skin encounter start block (+5).
- `resolveChargeCorrectEffects()` — multiplier bonuses, draw bonuses, speed bonuses.
- `resolveChargeWrongEffects()` — safety nets (lucky_coin), self-damage (volatile_core, scholars_gambit)
- `resolveAttackModifiers()` — percentDamageBonus includes ritual_blade (+50% first card, -15% other cards; Pass 7 2026-04-09). brass_knuckles strengthGain is always 0 (moved to turn start).
- `resolveDebuffAppliedModifiers()` — returns `reflectToEnemy: boolean`; always false now (thick_skin no longer reflects debuffs, 2026-04-09).
- `resolveShieldModifiers()` — worn_shield grants +1 flatBlockBonus (nerfed from +2, Pass 7). hollow_armor: shields work normally; `blockGainHalved` removed (Pass 7). TurnEndEffects.blockDrain = 3 after turn 3.
- `resolveExhaustEffects()` — returns `bonusCardDraw` (exhaustion_engine +2, scavengers_eye +1) and `tempStrengthGain` (tattered_notebook +1 for 1 turn). Caller must apply strength status effect.
- `resolveEncounterEndEffects()` — herbal_pouch heals 3 HP post-combat.
- `getMaxRelicSlots()` — returns 5, or 6 if scholars_gambit held

## 2026-04-09 Balance Pass

**Nerfs:**
- `steel_skin`: flat damage reduction 3 → 1 (was causing trivial early-game clearing)
- `ritual_blade`: first card bonus +100% → +50% (97% win rate, too dominant)
- `phoenix_feather`: already once/run; no change needed (85% win rate explained by the auto-Charge turn)

**Buffs (garbage tier relics):**
- `brass_knuckles`: every-2nd-attack strength → +1 temp Strength at turn start every turn (2.7% win rate)
- `plague_flask`: poison tick/duration bonus → all enemies start with 2 Poison at encounter start
- `thick_skin`: debuff reflect + damage penalty → start each encounter with 5 block
- `worn_shield`: thorns + -20% block → +2 flat block (Pass 7: nerfed to +1 flat block)

## 2026-04-09 Balance Pass 6 (Canary Assist + Relic Rarity/Reworks)

**Canary Assist Reduction (first_timer was 73% win rate at 45% accuracy — assist was too strong):**
- `CANARY_RUN_STRONG_ASSIST_DMG_MULT`: 0.70 → 0.82 (enemy damage reduction -30% → -18%)
- `CANARY_RUN_STRONG_ASSIST_HP_MULT`: 0.75 → 0.85 (enemy HP reduction -25% → -15%)
- `CANARY_RUN_MILD_ASSIST_DMG_MULT`: 0.90 → 0.93 (enemy damage reduction -10% → -7%)
- `CANARY_RUN_MILD_ASSIST_HP_MULT`: 0.95 → 0.96 (enemy HP reduction -5% → -4%)

**Rarity Adjustments:**
- `steel_skin`: common → uncommon (too much value for common slot)
- `herbal_pouch`: common → uncommon (poison + heal was overloaded for common)
- `blood_price`: uncommon → rare (AP+1 swing is run-defining)
- `ritual_blade`: uncommon → rare (first-card double is run-defining)

**Dead Relic Reworks:**
- `hollow_armor`: 20 block + block disabled → 15 block + shield cards halved (`blockGainHalved` flag) → **Pass 7**: 12 starting block, `blockGainHalved` removed, 3 block drain per turn after turn 3
- `mnemonic_scar`: new-fact wrong self-damage 5 → 2 (was deterring use)
- `scholars_gambit`: wrong-charge self-damage 3 → 1 (was deterring use despite +1 slot upside)
- `volatile_core`: enemy damage on wrong charge removed (was punishing player for enemy getting healed indirectly; now just 3 self-damage)


## 2026-04-09 Balance Pass 7 (11 Relics)

### Tier 1 Nerfs (overperformers)

- `ritual_blade`: first card bonus +50% (unchanged), subsequent card penalty -25% → **-15%**
- `blood_price`: HP loss per turn -2 → **-3** ("+1 AP per turn, lose 3 HP per turn")
- `obsidian_dice`: good outcome probability 60% → **50%** (true 50/50 gamble)
- `worn_shield`: flat block bonus +2 → **+1** (on all shield cards)

### Tier 2 Trap Relic Fixes

- `mnemonic_scar`: REWORKED — removed all self-damage. New effect: previously-correct facts get CC+25% damage; all wrong charges draw 1 card. Category changed from `cursed` to `knowledge`. `mnemonicScarDrawBonus` field added to `ChargeWrongEffects`.
- `hollow_armor`: REWORKED — starting block 15 → **12**; `blockGainHalved` removed (shields work normally). New turn-end effect: lose **3 block per turn after turn 3**. `TurnEndEffects.blockDrain` field added; `TurnEndContext.encounterTurnNumber` added.
- `glass_lens`: wrong charge self-damage -3 → **-1**

### Tier 3 Buffs (underperformers)

- `inferno_crown`: trigger condition Burn AND Poison → **Burn OR Poison**; damage bonus +30% → **+20%**
- `chromatic_chain`: chain threshold 3+ → **2+** (to prime next chain)
- `memory_nexus`: correct Charge trigger every 3rd → **every 2nd** (per encounter)
- `scar_tissue`: flat damage per wrong Charge stack +2 → **+3**

### Resolver Changes

- `resolveChargeWrongEffects` return: added `mnemonicScarDrawBonus: number`
- `ChargeWrongEffects` interface: new `mnemonicScarDrawBonus` field
- `ChargeCorrectContext` interface: new `factPreviouslyCorrect?: boolean` field (mnemonic_scar CC+25%)
- `TurnEndEffects` interface: new `blockDrain?: number` field (hollow_armor)
- `TurnEndContext` interface: new `encounterTurnNumber?: number` field (hollow_armor drain)

## Functional Categories

`RelicCategory` values used for UI filtering and build archetype display:
`offensive`, `defensive`, `sustain`, `tactical`, `knowledge`, `economy`, `cursed`, `chain`, `speed`, `burst`, `poison`, `glass_cannon`
