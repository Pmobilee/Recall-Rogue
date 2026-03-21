# AR-211: New Relics — All 36 Expansion Relics

**Status:** Pending
**Phase:** 4 (Relics) — runs in parallel with Phase 2-3 card work after Phase 1 complete
**Prerequisite:** AR-203 (Burn/Bleed status effects) must be complete before Batch B/C relics that reference Burn/Bleed.
**Depends on:** Phase 0 Cursed Card system (AR-202) for `scar_tissue`. Burn/Bleed (AR-203) for `bleedstone`, `ember_core`, `hemorrhage_lens`, `inferno_crown`, `volatile_manuscript`. Inscription system (AR-204) not required for any relic.
**Source of truth:** `docs/RESEARCH/EXPANSION_FINAL_PRODUCTION.md` Part 7 §7A–§7E and Appendix F.

---

## Overview

Implements all 36 new relics across 5 rarity tiers. After this AR, the relic catalogue grows from 41 to 77 (Echo Chamber was already removed).

**Relic counts by tier:**
- Common (5): Quick Study, Thick Skin, Tattered Notebook, Battle Scars, Brass Knuckles
- Uncommon (12): Pocket Watch, Chain Link Charm, Worn Shield, Bleedstone, Ember Core, Gambler's Token, Thoughtform, Scar Tissue, Surge Capacitor, Obsidian Dice, Living Grimoire, Gladiator's Mark
- Rare (15): Red Fang, Chronometer, Soul Jar, Null Shard, Hemorrhage Lens, Archive Codex, Berserker's Oath, Chain Forge, Deja Vu, Inferno Crown, Mind Palace, Entropy Engine, Bloodstone Pendant, Chromatic Chain, Dragon's Heart
- Legendary (4): Omniscience, Paradox Engine, Akashic Record, Singularity
- Cursed (2, subset of above): Paradox Engine (Legendary), Volatile Manuscript (Rare)

New triggers required: `on_elite_kill` (Dragon's Heart). Already-present triggers used by new relics: `on_encounter_end`, `permanent`, `on_charge_correct`, `on_attack`, `on_turn_start`, `on_chain_complete`, `on_block`, `on_multi_hit`, `on_charge_wrong`, `on_perfect_turn`, `on_surge_start`, `on_encounter_start`, `on_run_start`, `on_damage_taken`, `on_boss_kill`.

---

## Files Affected

### Data
- `src/data/relics/starters.ts` — add 5 Common + 12 Uncommon relics
- `src/data/relics/unlockable.ts` — add 15 Rare + 4 Legendary + 1 Cursed Rare (Volatile Manuscript)
- `src/data/relics/types.ts` — add `on_elite_kill` to `RelicTrigger` union
- `src/data/balance.ts` — add relic-specific constants (see per-TODO list)

### Logic
- `src/services/relicEffectResolver.ts` — add handler functions/branches for all 36 new relic effectIds
- `src/game/scenes/CombatScene.ts` (or equivalent elite/boss kill hook) — fire `on_elite_kill` trigger on elite enemy death; `on_boss_kill` already exists, verify it grants Dragon's Heart rewards
- `src/ui/components/ChargeButton.svelte` (or equivalent) — add GUARANTEED button state for Soul Jar

### State
- `src/game/state/runState.ts` (or equivalent) — add `soulJarCharges: number`, `mindPalaceStreak: number`, `mindPalaceWrongBuffer: number`, `chromaticChainPrimed: boolean`, `chainForgeUsedThisEncounter: boolean`, `dejaVuUsedThisEncounter: boolean`, `omniscienceCorrectThisTurn: number` tracking fields

### Tests
- `src/services/__tests__/relicEffectResolver.new-relics.test.ts` — new test file covering all 36 relics

### Registry
- `data/inspection-registry.json` — add all 36 new relic IDs to `relics` table

---

## Confirmed Interaction Rulings (Appendix F — Implement Exactly)

These rulings apply to new relics and must NOT be interpreted differently:

| Ruling | Decision |
|--------|----------|
| Null Shard + Chain Lightning | Chain length floors at 1; Chain Lightning works as basic 8-damage attack |
| Chain Forge "continues" | Chain-breaking card gets current chain multiplier, chain count increments; once per encounter |
| Chromatic Chain carry | Carries across turns — completing a 3+ chain makes NEXT turn's chain start at 2 |
| Volatile Manuscript self-Burn | Works identically to enemy Burn — enemy hits trigger player's Burn stacks on player |
| Burn triggers through block | Burn bonus is added to attack damage; block absorbs combined total |
| Bleed triggers on Poison ticks | NO — Bleed only triggers on card-play damage |

---

## Implementation Batches

Batches are sized for parallel workers. Each worker handles data definitions + resolver handlers + tests for their batch.

---

## Batch A — Common Relics (5)

**Worker: Haiku (mechanical, straightforward)**
**Prerequisite:** None. These have no Burn/Bleed/Cursed dependencies.

### TODO A.1 — Add Common relic data definitions

**Files:** `src/data/relics/starters.ts`

**What:** Append 5 new Common relic entries to `STARTER_RELICS`. All have `isStarter: true`, `startsUnlocked: true`, `unlockCost: 0`, `unlockLevel: 0`.

```
quick_study       | on_encounter_end  | After combat, if 3+ Charges correct, see quiz answer for 1 random deck fact (3s) | knowledge
thick_skin        | permanent         | First debuff each encounter has duration reduced by 1 turn | defensive
tattered_notebook | on_charge_correct | +5 gold on first correct Charge per encounter | economy
battle_scars      | on_damage_taken   | Next attack deals +3 damage after taking a hit (once/turn) | offensive
brass_knuckles    | on_attack         | Every 3rd attack card played deals +6 bonus damage | offensive
```

Follow the exact `RelicDefinition` shape from `src/data/relics/types.ts`. Use `effects[]` with `effectId` (snake_case), `description`, and `value`. Add appropriate `icon` emoji and `visualDescription` RPG pixel-art description.

**Acceptance:** `STARTER_RELICS` gains 5 entries. TypeScript strict mode passes (`npm run typecheck`). Each entry has exactly the fields in `RelicDefinition`. `unlockLevel: 0`.

---

### TODO A.2 — Add Common relic resolver handlers

**Files:** `src/services/relicEffectResolver.ts`

**What:** Add handler code for all 5 Common relic effectIds. Follow the existing handler pattern (pure functions, `relicIds.has(...)` checks):

- **`quick_study`** (`on_encounter_end`): Add to `resolveEncounterEndEffects`. If `chargesCorrectThisEncounter >= 3`, set `showFactHintForSeconds: 3` in return object. Caller handles selecting which fact to preview and displaying it for 3s.
- **`thick_skin`** (`permanent`): Add to a new `resolveDebuffAppliedModifiers(relicIds, context)` function. If `context.isFirstDebuffThisEncounter`, reduce debuff duration by 1 (minimum 1 turn remaining). Return `{ durationReduction: number }`.
- **`tattered_notebook`** (`on_charge_correct`): Add to `resolveChargeCorrectEffects`. If `context.isFirstChargeCorrectThisEncounter`, add `goldBonus: 5` to return object (additive with any existing gold bonus field, or add field).
- **`battle_scars`** (`on_damage_taken`): Add to `resolveDamageTakenEffects`. If not `context.battleScarsUsedThisTurn`, set `nextAttackFlatBonus: 3` in return object. Caller sets `battleScarsUsedThisTurn = true` after granting the bonus.
- **`brass_knuckles`** (`on_attack`): Add to `resolveAttackModifiers`. If `context.attackCountThisEncounter % 3 === 0 && context.attackCountThisEncounter > 0`, add `flatDamageBonus += 6`.

Add any required new context fields to the relevant context interfaces.

**Acceptance:** All 5 relics handled. TypeScript compiles. No existing tests broken.

---

### TODO A.3 — Unit tests for Common relics

**Files:** `src/services/__tests__/relicEffectResolver.new-relics.test.ts` (create)

**What:** Create a new test file. Add `describe` blocks for each Common relic:

- `quick_study`: fires when `chargesCorrectThisEncounter >= 3`, does NOT fire at 2
- `thick_skin`: reduces first debuff duration by 1, does NOT fire on 2nd debuff
- `tattered_notebook`: grants +5 gold on first correct Charge, does NOT grant on 2nd
- `battle_scars`: grants nextAttackFlatBonus=3 once per turn, not twice
- `brass_knuckles`: grants +6 on 3rd, 6th, 9th attack; not on 1st, 2nd

**Acceptance:** All tests pass (`npx vitest run`). Test file uses the same import style as `relicEffectResolver.v2.test.ts`.

---

### TODO A.4 — Update inspection registry for Common relics

**Files:** `data/inspection-registry.json`

**What:** Add 5 entries to the `relics` table. Each entry:
```json
{
  "id": "quick_study",
  "name": "Quick Study",
  "status": "active",
  "rarity": "common",
  "trigger": "on_encounter_end",
  "lastChangedDate": "2026-03-21",
  "mechanicInspectionDate": "not_checked",
  "visualInspectionDate_portraitMobile": "not_checked",
  "visualInspectionDate_landscapeMobile": "not_checked",
  "visualInspectionDate_landscapePC": "not_checked",
  "uxReviewDate": "not_checked"
}
```
Repeat pattern for all 5 Common relics.

**Acceptance:** Registry parses as valid JSON. Count in `relics` table increases by 5.

---

## Batch B — Uncommon Relics (12)

**Worker: Sonnet (some require Burn/Bleed/Cursed awareness)**
**Prerequisite:** AR-202 (Cursed Card system) for `scar_tissue`. AR-203 (Burn/Bleed) for `bleedstone` and `ember_core`.

### TODO B.1 — Add Uncommon relic data definitions

**Files:** `src/data/relics/starters.ts`

**What:** Append 12 new Uncommon relic entries to `STARTER_RELICS`. All Uncommons are `isStarter: true`, `startsUnlocked: true`, `unlockCost: 0`. Unlock levels from the schedule:

```
pocket_watch      | unlockLevel: 1  | on_turn_start      | +1 draw on turns 1 and 5 of each encounter | tactical
chain_link_charm  | unlockLevel: 1  | on_chain_complete  | +5 gold per chain link in completed chain | economy
worn_shield       | unlockLevel: 2  | on_block           | Every 2nd shield card played gains +3 block | defensive
bleedstone        | unlockLevel: 2  | permanent          | Bleed applied by you +2 stacks. Bleed decay 1 slower. | poison
gladiator_s_mark  | unlockLevel: 2  | on_encounter_start | Start each encounter with +1 Strength for 3 turns | offensive
ember_core        | unlockLevel: 3  | permanent          | Burn applied by you +2 extra stacks. Enemy with 5+ Burn: +20% damage. | offensive
gambler_s_token   | unlockLevel: 3  | on_charge_wrong    | Wrong Charge = +3 gold | economy
thoughtform       | unlockLevel: 4  | on_perfect_turn    | +1 permanent Strength when ALL cards in turn Charged correctly | offensive
scar_tissue       | unlockLevel: 4  | permanent          | Cards with cursed facts deal 0.85× QP instead of 0.7× | defensive
living_grimoire   | unlockLevel: 4  | on_encounter_end   | If 3+ Charges correct in encounter, heal 3 HP | sustain
surge_capacitor   | unlockLevel: 5  | on_surge_start     | On Surge turns: +1 AP and draw 2 extra cards | burst
obsidian_dice     | unlockLevel: 5  | on_charge_correct  | 60% chance: +50% Charge multiplier. 40% chance: -25% Charge multiplier. | glass_cannon
```

Note on `gambler_s_token`: use that exact ID (apostrophe → underscore). Same for `gladiator_s_mark`.

**Acceptance:** 12 new entries in `STARTER_RELICS`. `npm run typecheck` passes. All `unlockLevel` values match the schedule above.

---

### TODO B.2 — Add Uncommon relic resolver handlers

**Files:** `src/services/relicEffectResolver.ts`

**What:** Add handler code for all 12 Uncommon effectIds:

- **`pocket_watch`** (`on_turn_start`): In `resolveTurnStartEffects`, if `context.turnNumberThisEncounter === 1 || context.turnNumberThisEncounter === 5`, add `bonusDrawCount += 1`.
- **`chain_link_charm`** (`on_chain_complete`): In `resolveChainCompleteEffects`, add `goldBonus: context.chainLength * 5` (where `chainLength` is the number of links completed, passed as context).
- **`worn_shield`** (`on_block`): Add to `resolveShieldModifiers`. If `context.shieldCardPlayCountThisEncounter % 2 === 0 && context.shieldCardPlayCountThisEncounter > 0`, add `flatBlockBonus += 3`.
- **`bleedstone`** (`permanent`): Add to a `resolveBleedModifiers(relicIds)` function (or wherever Bleed application is calculated). Return `{ extraBleedStacks: 2, slowerDecay: true }`. Caller: when applying Bleed, add 2; when decaying, skip 1 decay (decay by 0 instead of 1, once per turn).
- **`gladiator_s_mark`** (`on_encounter_start`): In `resolveEncounterStartEffects`, add `tempStrengthBonus: { amount: 1, durationTurns: 3 }` if relic held.
- **`ember_core`** (`permanent`): Add to `resolveAttackModifiers`. Add `percentDamageBonus += 0.20` when `context.enemyBurnStacks >= 5`. Add to burn application logic: when applying Burn, add `+2` extra stacks if `ember_core` held.
- **`gambler_s_token`** (`on_charge_wrong`): In `resolveChargeWrongEffects`, add `goldBonus: 3` to return object.
- **`thoughtform`** (`on_perfect_turn`): Add to `resolvePerfectTurnEffects(relicIds)` (or create it). If `context.allCardsChargedCorrectly`, return `{ permanentStrengthGain: 1 }`. Caller applies this to persistent run strength.
- **`scar_tissue`** (`permanent`): Add to wherever the cursed card QP multiplier is applied (likely `cardEffectResolver.ts` or `resolveQuickPlayModifiers`). If `relicIds.has('scar_tissue')` AND card is cursed, use `0.85` instead of `0.7` for QP multiplier. Does NOT change CW multiplier.
- **`living_grimoire`** (`on_encounter_end`): In `resolveEncounterEndEffects`, if `chargesCorrectThisEncounter >= 3`, add `healAmount: 3` to return.
- **`surge_capacitor`** (`on_surge_start`): In `resolveSurgeStartEffects`, add `bonusAP += 1` and `bonusDrawCount += 2` to return object.
- **`obsidian_dice`** (`on_charge_correct`): In `resolveChargeCorrectEffects`, if relic held, roll `Math.random()`: `< 0.60` → `extraMultiplier *= 1.5`; else → `extraMultiplier *= 0.75`. Apply AFTER other multiplier effects (multiplicative).

Add required context fields to affected interfaces.

**Acceptance:** All 12 handled. Compiles. Existing tests pass.

---

### TODO B.3 — Unit tests for Uncommon relics

**Files:** `src/services/__tests__/relicEffectResolver.new-relics.test.ts`

**What:** Add `describe` blocks for each Uncommon relic in the existing test file:

- `pocket_watch`: fires on turn 1, fires on turn 5, does NOT fire on turn 2
- `chain_link_charm`: 3-link chain = +15 gold, 5-link chain = +25 gold
- `worn_shield`: 2nd shield card +3 block, 4th shield card +3 block, 1st and 3rd card no bonus
- `bleedstone`: returns `extraBleedStacks: 2` and `slowerDecay: true`
- `gladiator_s_mark`: returns `tempStrengthBonus { amount: 1, durationTurns: 3 }` on encounter start
- `ember_core`: +20% damage when `enemyBurnStacks >= 5`, not at 4; `+2` extra Burn stacks on apply
- `gambler_s_token`: returns `goldBonus: 3` on wrong Charge
- `thoughtform`: returns `permanentStrengthGain: 1` when all cards Charged correctly
- `scar_tissue`: cursed card uses 0.85× QP (not 0.70×); non-cursed card unaffected
- `living_grimoire`: heals 3 when `chargesCorrectThisEncounter >= 3`, not at 2
- `surge_capacitor`: returns `bonusAP: 1, bonusDrawCount: 2` on surge start
- `obsidian_dice`: with seeded Math.random (mock), verify 1.5× branch and 0.75× branch

**Acceptance:** All tests pass (`npx vitest run`). Mock `Math.random` for obsidian_dice tests to make them deterministic.

---

### TODO B.4 — Update inspection registry for Uncommon relics

**Files:** `data/inspection-registry.json`

**What:** Add 12 entries to the `relics` table using the same schema as TODO A.4. Set `rarity: "uncommon"` and correct `trigger` and `lastChangedDate: "2026-03-21"`.

**Acceptance:** Registry parses as valid JSON. Count in `relics` table increases by 12 more.

---

## Batch C — Rare Relics (15)

**Worker: Sonnet (complex state, special UI, new trigger)**
**Prerequisite:** AR-203 (Burn/Bleed) for Hemorrhage Lens and Inferno Crown. AR-202 (Cursed) not required for any Rare.

### TODO C.1 — Add `on_elite_kill` trigger type

**Files:** `src/data/relics/types.ts`

**What:** Add `'on_elite_kill'` to the `RelicTrigger` union type. Dragon's Heart uses `on_elite_kill` and `on_boss_kill` (already present). Since `trigger` is a single string field, Dragon's Heart should use `trigger: 'on_elite_kill'` and have its boss kill effect handled via a separate `effectId` that the resolver also checks on `on_boss_kill` dispatch. Alternatively, use `trigger: 'permanent'` and resolve both via context flags. The cleanest approach: give Dragon's Heart `trigger: 'on_elite_kill'` for the primary dispatch and handle `on_boss_kill` as an additional resolver hook.

**Acceptance:** `RelicTrigger` includes `'on_elite_kill'`. TypeScript compiles.

---

### TODO C.2 — Add Rare relic data definitions

**Files:** `src/data/relics/unlockable.ts`

**What:** Append 15 new Rare relic entries to `UNLOCKABLE_RELICS`. All Rares have `rarity: 'rare'`, `isStarter: false`, `startsUnlocked: false`, `unlockCost: 55`. Unlock levels from schedule:

```
red_fang            | unlockLevel: 6  | on_encounter_start | First attack each encounter +30% damage | offensive
chronometer         | unlockLevel: 6  | permanent          | All quiz timers +3s. All Charge multipliers -15%. | knowledge
soul_jar            | unlockLevel: 7  | on_charge_correct  | 1 charge per 5 correct Charges. CHARGE button shows GUARANTEED. Tap to auto-succeed quiz. | knowledge
null_shard          | unlockLevel: 7  | permanent          | Chain multipliers = 1.0×. All attacks +25% base damage. | offensive
hemorrhage_lens     | unlockLevel: 7  | on_multi_hit       | Multi-Hit attacks apply 1 Bleed per hit. Triggers on subsequent hits only. | poison
archive_codex       | unlockLevel: 8  | on_encounter_end   | +1 damage per 10 total mastery levels across deck. | knowledge
berserker_s_oath    | unlockLevel: 9  | on_run_start       | -30 max HP. All attacks +40% damage. | glass_cannon
chain_forge         | unlockLevel: 8  | on_chain_complete  | Once/encounter: card that would break chain continues instead, gets current multiplier, chain increments. | chain
deja_vu             | unlockLevel: 9  | on_turn_start      | Turn 1 of encounter: add 1 card from discard to hand at -1 AP cost. Fact = previously-correct this run. Level 15+: 2 cards. | knowledge
inferno_crown       | unlockLevel: 10 | permanent          | Enemy has BOTH Burn and Poison: all your damage +30%. | offensive
mind_palace         | unlockLevel: 10 | permanent          | Track consecutive correct Charges across run. Forgiveness: 1 wrong per 10 freezes (not resets). At 10/20/30 streak: +3/+6/+10 to all effects. | knowledge
entropy_engine      | unlockLevel: 9  | on_turn_end        | Played 3+ different card types this turn: deal 5 damage + gain 5 block. | tactical
bloodstone_pendant  | unlockLevel: 11 | on_damage_taken    | Take damage → gain 1 Fury stack. Each Fury = +1 damage to next attack, consumed on attack. | glass_cannon
chromatic_chain     | unlockLevel: 11 | on_chain_complete  | Once/encounter: completing 3+ chain makes NEXT chain start at 2. Carries across turns. | chain
dragon_s_heart      | unlockLevel: 12 | on_elite_kill      | Elite kill: +5 max HP + heal 30%. Boss kill: +15 max HP + full heal + random Legendary relic. Passive: +2 damage always. | offensive
```

Dragon's Heart `curseDescription` is empty (it is NOT cursed). Include `effects[]` with distinct `effectId`s for each sub-effect (e.g., `dragon_elite_kill_hp`, `dragon_elite_kill_heal`, `dragon_boss_kill_hp`, `dragon_boss_kill_full_heal`, `dragon_boss_kill_legendary`, `dragon_passive_damage`).

**Acceptance:** 15 entries added to `UNLOCKABLE_RELICS`. Compiles. Dragon's Heart has NO `curseDescription`.

---

### TODO C.3 — Add Rare relic resolver handlers

**Files:** `src/services/relicEffectResolver.ts`

**What:** Add handlers for all 15 Rare effectIds. Implement carefully — several require new context fields or new state fields.

**red_fang:**
In `resolveEncounterStartEffects`, add `firstAttackDamageBonus: 0.30` if held. Caller applies as percent bonus to the first attack of each encounter.

**chronometer:**
In `resolvePermanentEffects` (or create it), add:
- `extraQuizTimerMs: 3000` (caller adds to quiz timer duration)
- `chargeMultiplierPenalty: 0.15` (caller subtracts from all Charge multipliers — applied at final multiplier calc step, additive with other multiplier effects)

**soul_jar:**
Add to `resolveChargeCorrectEffects`. Return `soulJarChargesGained: 1` when `context.chargeCountThisEncounter % 5 === 0 && context.chargeCountThisEncounter > 0` (i.e., every 5th correct Charge). This is informational — the caller accumulates `runState.soulJarCharges`.

Also add `resolveChargeButtonState(relicIds, soulJarCharges)` → `{ showGuaranteed: boolean }` helper for UI.

Player activating Soul Jar: in `resolveChargeCorrectEffects` (or a new `resolveSoulJarConsume` function), consuming 1 charge returns `autoSucceed: true`. Caller sets `soulJarCharges -= 1`.

**null_shard:**
In `resolveChainModifiers` (create if needed), if `null_shard` held: `chainMultiplierOverride: 1.0` (chain multiplier is always 1.0, no matter what). In `resolveAttackModifiers`, add `percentDamageBonus += 0.25`.

Chain Lightning specific: caller checks `null_shard` and floors chain length to 1 before calculating damage.

**hemorrhage_lens:**
In `resolveMultiHitEffects` (create if needed), return `bleedPerHit: 1` if held. Caller applies 1 Bleed per hit EXCEPT the first applying hit — subsequent hits trigger existing Bleed AND apply 1 more Bleed per the Appendix F ruling ("Bleed triggers on subsequent hits only").

**archive_codex:**
In `resolveEncounterEndEffects`, add `codexDamageBonusFlat: Math.floor(context.totalDeckMasteryLevels / 10)`. Context field `totalDeckMasteryLevels` = sum of mastery levels across all cards in deck (draw + discard + hand, not exhaust). Caller provides this from run state.

**berserker_s_oath:**
In `resolveRunStartEffects` (or wherever `on_run_start` relics fire), add `maxHpPenalty: 30` and `percentAttackBonus: 0.40`. Also add `percentDamageBonus += 0.40` in `resolveAttackModifiers` when relic held.

**chain_forge:**
In `resolveChainCompleteEffects`, add `chainForgeAvailable: !context.chainForgeUsedThisEncounter`. Return object. Separately, when a chain-breaking event is detected (caller's responsibility), if `chainForgeAvailable`, the break is prevented: the card gets current chain multiplier, chain increments, and `chainForgeUsedThisEncounter = true`. This is purely informational from the resolver; the actual chain-break prevention happens in the caller.

**deja_vu:**
In `resolveTurnStartEffects`, if relic held AND `context.turnNumberThisEncounter === 1` AND `!context.dejaVuUsedThisEncounter`:
- Return `dejaVuCardSpawn: { count: context.characterLevel >= 15 ? 2 : 1, apCostReduction: 1 }`
- Caller: picks `count` random cards from discard pile, adds to hand. Each card's AP cost is reduced by 1 for this turn only. Each card is assigned a fact from `runState.correctlyAnsweredFactIds` (facts answered correctly this run). If no discard cards, spawns nothing (graceful no-op).
- Set `dejaVuUsedThisEncounter = true` after spawning.

Add `characterLevel: number` and `dejaVuUsedThisEncounter: boolean` to `TurnStartContext`.

**inferno_crown:**
In `resolveAttackModifiers`, add `percentDamageBonus += 0.30` when `context.enemyHasBurn && context.enemyHasPoison`.

**mind_palace:**
Mind Palace is a run-level streak tracker. Add to `resolvePermanentEffects`:
- Input: `context.mindPalaceStreak: number` (from run state)
- Return `mindPalaceBonusToAllEffects: context.mindPalaceStreak >= 30 ? 10 : context.mindPalaceStreak >= 20 ? 6 : context.mindPalaceStreak >= 10 ? 3 : 0`
- This bonus is added to all effect values (+3/+6/+10 to "all effects" means attack damage, block, and heal amounts)

Streak tracking (caller responsibility in `runState`):
- Correct Charge → `mindPalaceStreak += 1`
- Wrong Charge when `mindPalaceWrongBuffer < 1` AND `mindPalaceStreak % 10 !== 0` (not in forgiveness window): `mindPalaceStreak` does NOT reset; instead `mindPalaceWrongBuffer += 1` (frozen — progress pauses until next correct)
- Wrong Charge when `mindPalaceWrongBuffer >= 1`: streak resets to 0, `mindPalaceWrongBuffer = 0`
- Correct Charge after buffer: `mindPalaceWrongBuffer = 0`, streak resumes
- Forgiveness window: 1 wrong per 10 correct freezes progress rather than resetting

**entropy_engine:**
In `resolveTurnEndEffects`, add `entropyEngineProcs: boolean` when `context.distinctCardTypesPlayedThisTurn >= 3`. Return `{ bonusDamage: 5, bonusBlock: 5 }` if true.

Add `distinctCardTypesPlayedThisTurn: number` to turn-end context.

**bloodstone_pendant:**
In `resolveDamageTakenEffects`, add `furyStacksGained: 1` when relic held (always gains 1 Fury per hit).

In `resolveAttackModifiers`, add `flatDamageBonus += context.furyStacks` if relic held. Caller sets `furyStacks = 0` after the attack (consumed on attack).

Add `furyStacks: number` to `AttackContext`.

**chromatic_chain:**
In `resolveChainCompleteEffects`, if relic held AND `context.chainLength >= 3` AND `!context.chromaticChainUsedThisEncounter`:
- Return `chromaticChainPrimed: true`
- Caller sets `runState.chromaticChainPrimed = true` and `chromaticChainUsedThisEncounter = true`
- When the NEXT chain starts (any turn), if `chromaticChainPrimed`, chain begins at length 2 instead of 1. Then `chromaticChainPrimed = false`.

Note from Appendix F: "carries across turns" — the primed state persists until used, even if that's the next turn.

**dragon_s_heart:**
Add `resolveEliteKillEffects(relicIds)` function:
- Returns `{ maxHpGain: 5, healPercent: 0.30 }` if `dragon_s_heart` held

Add to `resolveKillEffects` or `resolveBossKillEffects`:
- On boss kill: `{ maxHpGain: 15, fullHeal: true, grantRandomLegendaryRelic: true }`

In `resolveAttackModifiers`, add `flatDamageBonus += 2` when `dragon_s_heart` held (passive, always active).

**Acceptance:** All 15 handlers implemented. Compiles. No existing tests broken.

---

### TODO C.4 — Soul Jar GUARANTEED button UI

**Files:** `src/ui/components/ChargeButton.svelte` (or equivalent Charge button component)

**What:** The CHARGE button already has a "FREE" state (shown when Free First Charge is available). Add a layered "GUARANTEED" state that appears when `soulJarCharges > 0` in the player's run state.

- Button label changes to "GUARANTEED" (replacing "CHARGE" or "FREE")
- Visual: distinct gold/amber styling distinct from the FREE green
- Player tapping GUARANTEED: calls `resolveSoulJarConsume()` which returns `autoSucceed: true`, skips quiz, applies full Charge correct multiplier, decrements `soulJarCharges`
- If both FREE and GUARANTEED are available simultaneously: GUARANTEED takes precedence (show GUARANTEED)
- Show remaining charges as a small badge/counter on the button when > 1 charge available

**Acceptance:** GUARANTEED button appears in combat when `soulJarCharges > 0`. Tapping it auto-succeeds without showing the quiz. Charge counter decrements. Button returns to normal state when charges exhausted.

---

### TODO C.5 — Deja Vu turn-start card spawn logic

**Files:** `src/game/scenes/CombatScene.ts` (or turn manager / `turnManager.ts`)

**What:** At the start of turn 1 of each encounter, if `deja_vu` relic is held and `dejaVuUsedThisEncounter === false`:
1. Select `count` cards from `runState.discardPile` at random (1 normally, 2 at character level 15+)
2. Assign each card a fact from `runState.correctlyAnsweredFactIds` (facts answered correctly this run). If `correctlyAnsweredFactIds` is empty, assign normally.
3. Add spawned cards to the current hand with a `turnApCostReduction: 1` flag (applies only this turn)
4. Set `dejaVuUsedThisEncounter = true`
5. Reset `dejaVuUsedThisEncounter = false` at encounter start

If `discardPile` is empty at turn 1 (first encounter, no discard yet): graceful no-op, still set `dejaVuUsedThisEncounter = true` so it doesn't retrigger.

**Acceptance:** On turn 1 of each encounter with Deja Vu held, up to 2 cards (level 15+) appear in hand with -1 AP cost. Each carries a previously-correct fact. No crash when discard is empty.

---

### TODO C.6 — Mind Palace streak tracking in run state

**Files:** `src/game/state/runState.ts` (or equivalent)

**What:** Add persistent streak tracking fields to the run state:

```typescript
// Mind Palace
mindPalaceStreak: number;       // starts at 0 each run
mindPalaceWrongBuffer: number;  // 0 normally; set to 1 when a wrong is "forgiven" (freezes progress)
```

Wire up in `cardEffectResolver.ts` (or wherever charge correct/wrong is handled):
- On charge CORRECT (any card): if `mind_palace` held → `mindPalaceStreak += 1`; if `mindPalaceWrongBuffer > 0 → mindPalaceWrongBuffer = 0` (buffer cleared on next correct)
- On charge WRONG (any card): if `mind_palace` held → if `mindPalaceWrongBuffer === 0` → freeze (do nothing to streak, set `mindPalaceWrongBuffer = 1`); if `mindPalaceWrongBuffer >= 1` → reset streak to 0, reset buffer to 0

The bonus activates at streak thresholds 10, 20, 30 (see resolver). The bonus applies to the value of each attack, block, and heal effect while the threshold is met.

**Acceptance:** Mind Palace streak persists across encounters within a run. One wrong per 10 freezes rather than resets. Second consecutive wrong resets. Streak resets at run start.

---

### TODO C.7 — Dragon's Heart elite/boss kill hooks

**Files:** `src/game/scenes/CombatScene.ts` (or wherever enemy death is handled), `src/services/relicEffectResolver.ts`

**What:**
1. Identify where enemy kill resolution happens in the combat loop.
2. Add a check: if killed enemy is `type: 'elite'`, fire `resolveEliteKillEffects(relicIds)` and apply: `player.maxHp += 5`, `player.hp = Math.min(player.hp + Math.floor(player.maxHp * 0.30), player.maxHp)`.
3. For boss kills (`type: 'boss'`), `on_boss_kill` trigger presumably already fires. Ensure Dragon's Heart is handled in that path: apply `player.maxHp += 15`, `player.hp = player.maxHp` (full heal), grant 1 random Legendary relic from the catalogue (excluding already-held relics and relics above `characterLevel`). Show relic reward screen or add to reward queue.
4. The passive `+2 flat damage` is always active and handled in `resolveAttackModifiers` (see TODO C.3).

**Acceptance:** Elite kill with Dragon's Heart held: player gains +5 max HP and heals 30% of new max HP. Boss kill: +15 max HP, full heal, Legendary relic granted. No crash if no Legendary relics are available (graceful fallback: no relic granted, max HP and heal still apply).

---

### TODO C.8 — Self-Burn implementation for Volatile Manuscript

**Files:** `src/services/cardEffectResolver.ts` (or wherever enemy Burn is applied), `src/data/statusEffects.ts`

**What:** Volatile Manuscript is defined in Batch D but requires a self-Burn mechanic built here (Rare batch), so it's ready when the Legendary/Cursed batch ships.

Appendix F ruling: "Volatile Manuscript self-Burn works identically to enemy Burn — enemy hits trigger player's Burn stacks on player."

Implement:
1. Add `playerBurnStacks: number` to player combat state (mirrors `enemyBurnStacks`).
2. When the player is HIT by an enemy attack: if `playerBurnStacks > 0`, trigger Burn on player — apply bonus damage equal to `playerBurnStacks` to the player (BEFORE block is applied, same as enemy Burn), then halve `playerBurnStacks` (round down).
3. Burn application function already exists for enemies — abstract it to accept a target parameter (enemy or player) or duplicate the calculation for player. The math is identical.
4. Self-Burn stacks are applied by Volatile Manuscript's effect (every 3rd Charge). This is wired in TODO D.2.

**Acceptance:** `playerBurnStacks` exists on combat state. Enemy attacks trigger player Burn before block is applied. Burn halves on trigger. Unit test: player with 8 self-Burn, enemy hits once → player takes 8 bonus damage, `playerBurnStacks` drops to 4.

---

### TODO C.9 — Unit tests for Rare relics

**Files:** `src/services/__tests__/relicEffectResolver.new-relics.test.ts`

**What:** Add `describe` blocks for all Rare relics:

- `red_fang`: returns +30% on encounter start, caller applies to first attack only
- `chronometer`: returns `extraQuizTimerMs: 3000` and `chargeMultiplierPenalty: 0.15`
- `soul_jar`: gains 1 charge on 5th correct Charge, 10th, 15th; not on 1st, 4th
- `null_shard`: chain multiplier override = 1.0; attack gets +25% percent bonus
- `hemorrhage_lens`: returns `bleedPerHit: 1`; verify it does NOT apply on hit 1 (applying hit)
- `archive_codex`: 0 mastery = 0 bonus; 10 total mastery = +1; 25 total mastery = +2
- `berserker_s_oath`: `maxHpPenalty: 30` on run start; `percentDamageBonus += 0.40` on attack
- `chain_forge`: `chainForgeAvailable: true` when not used; `false` when used; once per encounter
- `deja_vu`: returns `dejaVuCardSpawn { count: 1 }` at level 14; `{ count: 2 }` at level 15
- `inferno_crown`: +30% when both Burn AND Poison; no bonus if only one
- `mind_palace`: streak 9 = 0 bonus; streak 10 = +3; streak 20 = +6; streak 30 = +10; forgiveness test (wrong on streak 10 freezes, second wrong resets)
- `entropy_engine`: procs at 3 distinct types; does NOT proc at 2
- `bloodstone_pendant`: `furyStacksGained: 1` on damage taken; `flatDamageBonus += furyStacks` on attack
- `chromatic_chain`: primes on 3+ chain, does NOT prime on 2-chain; once per encounter
- `dragon_s_heart`: `flatDamageBonus: 2` always; elite kill returns `{ maxHpGain: 5, healPercent: 0.30 }`; boss kill returns full heal + legendary

**Acceptance:** All tests pass. Mind Palace forgiveness test explicitly validates freeze vs reset behavior.

---

### TODO C.10 — Update inspection registry for Rare relics

**Files:** `data/inspection-registry.json`

**What:** Add 15 entries to the `relics` table using the schema from TODO A.4. Set `rarity: "rare"`, correct triggers, `lastChangedDate: "2026-03-21"`.

**Acceptance:** Registry valid JSON. Count increases by 15.

---

## Batch D — Legendary + Cursed Relics (5)

**Worker: Sonnet**
**Prerequisite:** Batch C complete (self-Burn from TODO C.8 required for Volatile Manuscript). AR-202 (Cursed system) for Paradox Engine flavor context. Burn/Bleed (AR-203) for Volatile Manuscript.

### TODO D.1 — Add Legendary + Cursed relic data definitions

**Files:** `src/data/relics/unlockable.ts`

**What:** Append 4 Legendary + 1 Cursed Rare entries to `UNLOCKABLE_RELICS`.

**Legendaries** (`rarity: 'legendary'`, `unlockCost: 75`, `isStarter: false`, `startsUnlocked: false`):

```
omniscience      | unlockLevel: 20 | on_charge_correct | 3 correct in one turn → 4th Charge this turn auto-succeeds | knowledge
paradox_engine   | unlockLevel: 21 | on_charge_wrong   | Wrong = 0.3× AND 5 piercing damage. +1 AP/turn permanent. | cursed
akashic_record   | unlockLevel: 22 | on_charge_correct | Tier 2b+ facts: 1 wrong subtly highlighted. Tier 3 auto-Charge = 1.5× (from 1.2×). | knowledge
singularity      | unlockLevel: 23 | on_chain_complete | Completing 5-chain deals BONUS damage = total chain damage dealt (doubles 5-chain output). | chain
```

Paradox Engine `curseDescription`: `"Wrong Charged answers resolve at 0.3× (worse than Quick Play). You still take the damage."`. It IS a Legendary but has the cursed downside — use `category: 'cursed'` and add `curseDescription`.

**Cursed Rare** (`rarity: 'rare'`, `unlockCost: 55`, `unlockLevel: 12`, `isStarter: false`, `startsUnlocked: false`):

```
volatile_manuscript | unlockLevel: 12 | on_charge_correct | All Charge multipliers +0.5×. Every 3rd Charge applies 4 Burn to yourself. | cursed
```

`volatile_manuscript.curseDescription`: `"Every 3rd Charge applies 4 Burn to yourself. Enemy attacks trigger your Burn stacks."`.

**Acceptance:** 5 entries added. Paradox Engine has `curseDescription`. Volatile Manuscript has `curseDescription`. Compiles.

---

### TODO D.2 — Add Legendary + Cursed resolver handlers

**Files:** `src/services/relicEffectResolver.ts`

**What:**

**omniscience:**
In `resolveChargeCorrectEffects`, track `context.correctChargesThisTurn`. If relic held AND `context.correctChargesThisTurn >= 3`, return `autoSucceedNextCharge: true`. Caller: if `autoSucceedNextCharge`, the 4th Charge attempt this turn auto-succeeds (no quiz, full multiplier). Applies once per turn (the 4th charge only; 5th and beyond are normal again unless 3 more correct stack up again — no, per spec: 3 correct in one turn → 4th auto-succeeds. Reset counter at turn end).

Add `correctChargesThisTurn: number` to `ChargeCorrectContext`.

**paradox_engine:**
Two effects:
1. In `resolveTurnStartEffects`, add `bonusAP += 1` if relic held (permanent +1 AP/turn, no condition). No hard AP cap.
2. In `resolveChargeWrongEffects`, if relic held: return `multiplierOverride: 0.30` and `piercingDamage: 5` (piercing = ignores block). Caller: apply `0.3×` to card effect power AND deal 5 piercing damage to enemy.

**akashic_record:**
Two effects:
1. In `resolveChargeCorrectEffects`, if relic held AND `context.cardTier >= 3` (Tier 3 / mastered): set `tier3AutoChargeMultiplierOverride: 1.5` (replaces the default 1.2×).
2. In a quiz rendering hook (outside the resolver — this is a UI effect): if relic held AND `context.factTier >= 2` AND player has answered the fact wrong before, the wrong answer that was previously selected is "subtly highlighted" (dim/grey styling — not revealed as correct, just flagged as "you chose this wrong before"). This requires a note in the resolver return: `akashicRecordHintFactId: string | null` — the resolver returns which fact to highlight. The quiz UI reads this.

**singularity:**
In `resolveChainCompleteEffects`, if relic held AND `context.chainLength >= 5`:
- Return `singularityBonusDamage: context.totalChainDamage` (bonus damage = total damage dealt in the chain)
- This effectively doubles 5-chain output

Add `totalChainDamage: number` to chain complete context.

**volatile_manuscript:**
Two effects:
1. In `resolveChargeCorrectEffects`, add `extraMultiplier *= 1.5` (adds +0.5× to all Charge multipliers, multiplicative). Apply BEFORE obsidian_dice roll if both held (ordering: base mult → Volatile +0.5× → Obsidian roll).
2. In `resolveChargeCorrectEffects`, track `context.totalChargesThisRun` (or use a separate counter). If relic held AND `context.totalChargesThisRun % 3 === 0 && context.totalChargesThisRun > 0`, return `selfBurnApply: 4` (apply 4 Burn to player). Caller applies these stacks to `playerBurnStacks` (from TODO C.8).

Add `totalChargesThisRun: number` to `ChargeCorrectContext`.

**Acceptance:** All 5 Legendary/Cursed relics handled. Compiles. Paradox Engine +1 AP is unconditional. Volatile Manuscript self-Burn uses the player-Burn system from TODO C.8.

---

### TODO D.3 — Unit tests for Legendary + Cursed relics

**Files:** `src/services/__tests__/relicEffectResolver.new-relics.test.ts`

**What:** Add `describe` blocks:

- `omniscience`: no auto-succeed at 2 correct; `autoSucceedNextCharge: true` at 3; resets at turn end
- `paradox_engine`:
  - Turn start: `bonusAP += 1`
  - Wrong Charge: `multiplierOverride: 0.30` and `piercingDamage: 5`
  - Both effects independently testable
- `akashic_record`:
  - Tier 3 correct Charge: `tier3AutoChargeMultiplierOverride: 1.5` (not 1.2)
  - Tier 2 correct Charge: multiplier override NOT applied (only Tier 3)
  - Hint: returns non-null `akashicRecordHintFactId` when fact tier >= 2 and previously wrong
- `singularity`:
  - 5-chain with 100 total damage: `singularityBonusDamage: 100`
  - 4-chain: NO singularity bonus
- `volatile_manuscript`:
  - Charge multiplier: `extraMultiplier` is increased by +0.5× compared to base
  - 3rd total Charge this run: `selfBurnApply: 4`
  - 6th total Charge: `selfBurnApply: 4`
  - 4th total Charge: NOT applied

**Acceptance:** All tests pass. Paradox Engine wrong test verifies both multiplier override AND piercing damage returned. Self-Burn count test verifies exact threshold behavior.

---

### TODO D.4 — Update inspection registry for Legendary + Cursed relics

**Files:** `data/inspection-registry.json`

**What:** Add 5 entries. Paradox Engine: `rarity: "legendary"`, `"curseDescription": "..."`. Volatile Manuscript: `rarity: "rare"`. All get `lastChangedDate: "2026-03-21"`.

**Acceptance:** Registry valid JSON. Total new relic entries = 36 (5 + 12 + 15 + 4 + 1 = 37? No: Volatile Manuscript counted in the 15 Rare subtotal? No — Volatile Manuscript is a 36th relic, NOT in the 15 Rares listed above. Check: 5 Common + 12 Uncommon + 15 Rare + 4 Legendary + 1 Cursed Rare (Volatile Manuscript) = 37. But the spec says 36 total. Per §7E, Paradox Engine is listed in BOTH Legendary (R33) AND the Cursed section — it is ONE relic, not two. Volatile Manuscript (R36) is a Cursed Rare. Total = 5 + 12 + 14 Rare (excluding Volatile) + 4 Legendary + 1 Cursed Rare = 36. So Volatile Manuscript IS one of the 15 Rares by slot — treat it as Rare with `curseDescription`.

Correction: the 15 Rare entries in TODO C.2 already include all 15 Rare IDs but Volatile Manuscript was NOT listed there since it ships in Batch D. Move Volatile Manuscript to be defined in TODO C.2 as the 15th Rare entry (or simply accept it is defined in TODO D.1 as a Cursed Rare). Either way, the total must be exactly 36 new entries across all four batches.

Final allocation: Batch A = 5, Batch B = 12, Batch C = 14 Rares, Batch D = 4 Legendary + 1 Cursed Rare (Volatile Manuscript) = 5. Total = 36.

Update TODO C.2 to list only 14 Rare definitions (exclude `volatile_manuscript`). This todo already reflects that.

**Acceptance:** Exactly 36 new relic entries added across all batches.

---

## Acceptance Criteria — Full AR

### Functional Gates

- [ ] All 36 relic `effectId`s handled in `relicEffectResolver.ts`
- [ ] Soul Jar `GUARANTEED` button state appears in combat UI when `soulJarCharges > 0`
- [ ] Soul Jar charges accumulate: 1 per 5 correct Charges; tap to consume → auto-succeed quiz
- [ ] Deja Vu: On turn 1 of each encounter, 1 card (2 at level 15+) from discard appears in hand with -1 AP cost, carrying a previously-correct fact. No crash on empty discard.
- [ ] Mind Palace: streak persists run-wide. One wrong per 10 freezes (not resets). Second consecutive wrong resets. Bonuses at 10/20/30 verified in headless sim.
- [ ] Self-Burn (`playerBurnStacks`): enemy attacks trigger player Burn stacks before block. Halves on trigger.
- [ ] Volatile Manuscript: every 3rd Charge applies 4 self-Burn stacks. All Charge multipliers +0.5×.
- [ ] Paradox Engine: +1 AP/turn unconditional. Wrong Charge = 0.3× multiplier + 5 piercing damage.
- [ ] Dragon's Heart: passive +2 damage always. Elite kill = +5 max HP + 30% heal. Boss kill = +15 max HP + full heal + random Legendary relic.
- [ ] Null Shard: all chain multipliers locked at 1.0×. All attacks +25% damage. Chain Lightning floors at chain length 1.
- [ ] Chain Forge: once per encounter, a chain-breaking card continues instead. Card gets current multiplier, chain increments.
- [ ] Chromatic Chain: completing 3+ chain primes next chain to start at 2 (carries across turns). Once per encounter.
- [ ] `on_elite_kill` trigger type added to `RelicTrigger` union.
- [ ] All 36 relic unlock levels match the schedule in Part 10 of the spec.

### Code Quality Gates

- [ ] `npm run typecheck` passes with no errors
- [ ] `npm run build` succeeds
- [ ] `npx vitest run` passes all tests including new relic tests
- [ ] No `any` types in new resolver code
- [ ] All new resolver functions have JSDoc comments
- [ ] All new context interface fields are documented

### Balance Verification

- [ ] Run headless sim: `npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 500` — no crashes
- [ ] Run relic audit: `npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/relic-audit.ts` — all 36 new relics fire at least once in 500 runs
- [ ] No build archetype exceeds 9.5/10 power (per Part 11 scorecard targets)
- [ ] Mind Palace + Soul Jar combo verified safe (no infinite-streak exploit)
- [ ] Paradox Engine + Gambit: wrong Gambit at 0.3× = 2.1 damage + 5 piercing. Verify no degenerate loop.
- [ ] Volatile Manuscript self-Burn: verify self-damage does not exceed ~30% of player HP per turn at normal Burn stacks

### Documentation Gate

- [ ] `docs/GAME_DESIGN.md` updated: relic count changed from 41 to 77, new relic tiers/categories described, self-Burn mechanic documented, Mind Palace streak mechanic documented
- [ ] `docs/ARCHITECTURE.md` updated: `on_elite_kill` trigger noted, new run state fields (`soulJarCharges`, `mindPalaceStreak`, `playerBurnStacks`, etc.) listed in run state schema section
- [ ] `data/inspection-registry.json` has exactly 36 new relic entries

### Visual Verification (post-implementation)

- [ ] Soul Jar GUARANTEED button: screenshot confirms it appears and is visually distinct from CHARGE/FREE
- [ ] Deja Vu card spawn: screenshot confirms extra card(s) in hand on turn 1 with -1 AP indicator
- [ ] Dragon's Heart elite kill: console log or health bar confirms +5 max HP and heal applied
- [ ] Volatile Manuscript self-Burn: combat log confirms player takes Burn damage on enemy attacks when stacked

---

## Parallel Execution Plan

Batches A and B can begin simultaneously.
Batch C begins after AR-203 (Burn/Bleed) is merged.
TODO C.8 (self-Burn) should be the FIRST task in Batch C since Batch D depends on it.
Batch D begins after TODO C.8 is complete.
TODOs C.4–C.7 (Soul Jar UI, Deja Vu logic, Mind Palace state, Dragon's Heart hooks) can run in parallel with C.3 and C.9.

```
[AR-203 ready] ──────────────────────────────────────────────────────────────────┐
[AR-202 ready] ──────────┐                                                        │
                          │                                                        │
Batch A (Haiku)  ─────────┤                                                        │
Batch B (Sonnet) ─────────┘                                                        │
                           ↓                                                       ↓
                      Batch C.1 (type) + C.2 (data) + C.8 (self-Burn first) ──────┤
                           ↓                                                       │
                      C.3 (resolver) + C.4 (Soul Jar UI) + C.5 (Deja Vu)         │
                           + C.6 (Mind Palace state) + C.7 (Dragon's Heart)       │
                           + C.9 (tests) + C.10 (registry)                        │
                           ↓                                                       │
                      Batch D (all) ────────────────────────────────────────────── ┘
                           ↓
                      Final: headless sim + relic-audit + docs update
```

---

## Notes for Workers

1. **effectId naming:** Use `snake_case` throughout. effectId should be descriptive: `soul_jar_charge_gain`, `soul_jar_auto_succeed`, `null_shard_chain_disable`, `null_shard_attack_bonus`, etc.

2. **Context field additions:** When adding new context fields to existing interfaces (e.g., `AttackContext`, `ChargeCorrectContext`), make them optional (`?: type`) with safe defaults in the resolver so existing callers do not break.

3. **`gambler_s_token` vs `gambler's_token`:** IDs are always snake_case. The apostrophe in "Gambler's" becomes `_s_` → `gambler_s_token`. Same for `gladiator_s_mark`, `berserker_s_oath`.

4. **Dragon's Heart boss kill Legendary grant:** The random Legendary selection must filter to relics where `rarity === 'legendary'` AND the relic is not already held by the player AND `unlockLevel <= characterLevel`. If the filtered pool is empty, skip the relic grant (just do max HP + full heal). Log a warning in dev mode.

5. **Paradox Engine has NO hard AP cap:** Per Appendix F and spec, `AP gain exceeds MAX_AP_PER_TURN = YES — no hard cap`. The +1 AP/turn from Paradox Engine can push AP above `MAX_AP_PER_TURN`. Do not clamp it.

6. **Archive Codex mastery counting:** "Total mastery levels across all cards in deck" = sum of each card's current mastery level (0-5 per card) across draw pile + discard pile + hand. Exhaust pile is excluded. This is calculated fresh at encounter end by the caller and passed as `totalDeckMasteryLevels` context.

7. **Omniscience reset:** The `correctChargesThisTurn` counter resets at turn end. This means getting 3 correct on turn 1 auto-succeeds the 4th attempt on turn 1. On turn 2, the counter resets to 0 and must reach 3 again.

8. **Volatile Manuscript charge counter:** Use `runState.totalChargesEver` (a run-wide counter incremented on every successful Charge, correct or wrong). Every 3rd Charge (3, 6, 9, ...) applies 4 self-Burn. This counter does NOT reset per encounter — it accumulates for the entire run.
