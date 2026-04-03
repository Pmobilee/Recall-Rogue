# Combat Mechanics

> **Purpose:** Turn-based combat loop, AP system, damage pipeline, and play modes as implemented in code.
> **Last verified:** 2026-04-03
> **Source files:** `src/services/turnManager.ts`, `src/services/cardEffectResolver.ts`, `src/services/playerCombatState.ts`, `src/data/balance.ts`

---

## Turn Structure

Phases are defined by the `TurnPhase` type: `'draw' | 'player_action' | 'enemy_turn' | 'turn_end' | 'encounter_end'`.

The encounter begins with `startEncounter()`: initializes `TurnState`, resets chain/aura/review-queue, draws 5 opening cards via `drawHand()`.

**Player action phase:** Player calls `playCardAction()` repeatedly until AP is exhausted, then calls `endPlayerTurn()`.

**`endPlayerTurn()` executes in order:**
1. `onPlayerNoCharge` enemy callback (if player made no Charge plays)
2. `dispatchEnemyTurnStart()` — enrage and Brain Fog hooks
3. `enemy.block = 0` — enemy block decays
4. `executeEnemyIntent()` — enemy attacks/defends/buffs (or skipped if staggered/slowed)
5. `takeDamage(playerState)` — shield absorbs first, then HP
6. `resolveLethalEffects()` — death-save relic checks (`last_breath`, `phoenix_feather`)
7. `tickPlayerStatusEffects()` — poison/regen tick on player
8. `tickEnemyStatusEffects()` — poison tick on enemy; Bleed decays by `BLEED_DECAY_PER_TURN`
9. `resolveTurnEndEffects()` — relic hooks (perfect turn bonus, etc.)
10. `resetTurnState(playerState)` — shield decays, AP refills, chain resets
11. `drawHand()` — draw 5 new cards for next turn

**Turn counters:** `turnNumber` is global (run-level, drives Surge system); `encounterTurnNumber` resets to 1 per encounter (drives enrage system).

---

## AP (Action Points) System

| Constant | Value |
|---|---|
| `START_AP_PER_TURN` | 3 |
| `MAX_AP_PER_TURN` | 5 |
| Normal card cost | `card.apCost` |
| Charge surcharge | +1 AP added to `apCost` |
| `FIRST_CHARGE_FREE_AP_SURCHARGE` | 0 (first attempt at a fact is free) |

Charge plays add +1 AP surcharge. Surcharge waivers (checked in priority order in `playCardAction`):
1. **Surge turn** — `getSurgeChargeSurcharge(turnNumber) === 0`; fires every `SURGE_INTERVAL (4)` turns starting at `SURGE_FIRST_TURN (2)`
2. **Warcry buff** — `warcryFreeChargeActive` flag (consumed on use)
3. **Chain Momentum** — `CHAIN_MOMENTUM_ENABLED = true`; previous correct Charge waives surcharge for next same chain-type Charge
4. **Free First Charge** — `isFirstChargeFree(factId, ...)` — first attempt at any fact in the run costs +0 surcharge

If `apCurrent < apCost`, card is blocked (`blocked: true`, no AP deducted).

---

## Damage Pipeline

Computed in `resolveCardEffect()` (`cardEffectResolver.ts`):

1. **Mechanic base** — `getMasteryStats(mechanicId, masteryLevel).qpValue` (QP) or `qpValue × CHARGE_CORRECT_MULTIPLIER` (CC = 1.75×) or `FIZZLE_EFFECT_RATIO × baseEffectValue` (CW = 0.25×)
   - Note: stat table `qpValue` at L0 may be LOWER than `mechanic.quickPlayValue` — stat tables override the mechanic definition
   - `chargeCorrectValue` field on `MechanicDefinition` is dead data — never read by the resolver
   - CW has `Math.max(0, ...)` floor to prevent negative values
2. **Player strength/weakness modifier** — `getStrengthModifier(playerState.statusEffects)` — multiplied against base attack damage. Strength: +25% per stack; Weakness: −25% per stack; floor: 0.25×. Applied inside `applyAttackDamage()` in `cardEffectResolver.ts`. Does NOT affect shield cards.
3. **Cursed multipliers** (if `card.isCursed`) — QP: 0.7×, CC: 1.0×, CW: 0.5×
4. **Inscription of Fury bonus** — flat add for attack cards from `activeInscriptions`
5. **Speed/trick bonus** — speed bonus (1.5× if answered fast) × trick question unlock (2.0×)
6. **Combo multipliers** — `chainMultiplier × overclockMultiplier × buffMultiplier`
7. **Relic modifiers** — `resolveAttackModifiers()` / `resolveShieldModifiers()`
8. **Enemy modifiers** — QP damage multiplier, hardcover armor, `chargeResistant` (−50% QP), `chainVulnerable` (+50% chain damage)
9. **Burn trigger** — `triggerBurn()`: bonus = current stacks, then stacks halve (multi-hit fires per hit)
10. **Bleed bonus** — `getBleedBonus()`: flat `BLEED_BONUS_PER_STACK` per stack

Final damage: `applyDamageToEnemy(enemy, damageDealt)`. Enemy HP ≤ 0 → `result = 'victory'`.

**Tier multipliers:** All active tiers (T1, T2a, T2b) use `effectMultiplier = 1.0`. Tier no longer drives card power; mastery does. T3 = 0× (card becomes a passive).

**Knowledge Chain multipliers** (`CHAIN_MULTIPLIERS`): [1.0, 1.2, 1.5, 2.0, 2.5, 3.5] at chain lengths 0–5.
Chains now **decay by 1** per turn end (`CHAIN_DECAY_PER_TURN=1`) instead of fully resetting, preserving momentum into the next turn.

---

## Play Modes

**Quick Play (`playMode = 'quick'`)**
- No quiz; fires at `getMasteryStats(mechanicId, level).qpValue`
- No +1 AP surcharge
- Breaks the Knowledge Chain
- Locked cards (Trick Question) cannot be played Quick
- If no Charge play was made the entire turn (Quick Play only, or no cards played), fog drifts up by 1 (`adjustAura(1)`) at `endPlayerTurn()` — AR-261

**Charge Correct (`playMode = 'charge'`, `answeredCorrectly = true`)**
- Damage = `getMasteryStats().qpValue × CHARGE_CORRECT_MULTIPLIER (1.75×)`
- The qpValue already encodes full mastery progression — no separate masteryBonus added
- Extends Knowledge Chain
- Mastery upgrade eligible
- Costs `apCost + 1` (with waivers)
- Decrements fog by 1 (`adjustAura(-1)`)
- Clears fact from review queue

**Charge Wrong (`playMode = 'charge'`, `answeredCorrectly = false`)**
- Partial effect at `FIZZLE_EFFECT_RATIO = 0.25×` of base effect — always resolves, never zero
- At 0.5× the fizzle damage equaled or exceeded quick play, undermining knowledge-as-power; current 0.25× keeps wrong answers clearly inferior
- Breaks Knowledge Chain, loses Chain Momentum
- Mastery downgrade (skipped on first attempt at a fact, `isFirstAttempt` flag)
- Adds fact to `cursedFactIds` if `masteryLevel === 0` and not first attempt
- Increases fog by 1 (`adjustAura(1)`)
- AP deducted — no refund on wrong answer

After balance constant changes (fizzle ratio, charge multipliers, AP costs), run `/balance-sim` then `/advanced-balance` for per-card contribution and tension metrics.

---

## Card Acquisition and Catch-Up Mastery

When a player picks a new card as a reward mid-run, `encounterBridge.addRewardCardToActiveDeck()` calls `computeCatchUpMastery()` (`catchUpMasteryService.ts`) to assign a starting mastery level proportional to the deck's current average. This prevents late-game picks from being dead on arrival.

- Deck avg < 1 → new card starts at L0 (early game, no catch-up)
- Deck avg ≥ 1 → starting level = `floor(rand(0.5–1.5) × avgMastery)`, capped at mechanic's `maxLevel`

See `docs/mechanics/cards.md` — Catch-Up Mastery section for full details.

---

## Win/Lose Conditions

**Victory:** `enemy.currentHP <= 0` via `applyDamageToEnemy()` or status ticks. Sets `result = 'victory'`, `phase = 'encounter_end'`.

**Defeat:** `playerState.hp <= 0` after `takeDamage()` or poison ticks. `resolveLethalEffects()` checked first — `last_breath` relic saves to 1 HP (once per encounter); `phoenix_feather` saves to a % of maxHP and grants 1 turn of auto-Charge. If no save: `result = 'defeat'`, `phase = 'encounter_end'`.

---

## Post-Encounter Healing

Post-encounter auto-heal is **disabled** (2026-04-01). All three heal constants in `balance.ts` are 0:

- `POST_ENCOUNTER_HEAL_PCT = 0` — no base heal after victory
- `RELAXED_POST_ENCOUNTER_HEAL_BONUS = 0` — no extra heal in Relaxed mode
- `POST_BOSS_ENCOUNTER_HEAL_BONUS = 0` — no extra heal after boss/mini-boss

Healing during a run comes exclusively from **potions** (consumable items). The heal-cap table (`POST_ENCOUNTER_HEAL_CAP`) is retained in `balance.ts` as it may be reused if the feature is re-enabled, but has no effect while base heal is 0.

The reward screen (`CardRewardScreen.svelte`) skips the heal UI step when `healAmount === 0`, so no UI change is needed.

---

## Debuff Mechanics — Explicit Cases

`expose` and `weaken` have explicit `case` branches in `cardEffectResolver.ts` (added 2026-04-01). Before this fix both fell through to the generic debuff fallback which applied wrong effects (weakness instead of vulnerable for expose; 0 stacks for weaken due to low finalValue).

- `expose` — applies Vulnerable stacks: QP=1 stack, 1 turn. CC=max(1, round(finalValue)) stacks, 2 turns.
- `weaken` — applies Weakness stacks: QP=1 stack, 1 turn. CC=max(1, round(finalValue)) stacks, 2 turns.
- **Player Weakness effect** — when the player has Weakness stacks, `getStrengthModifier(playerState.statusEffects)` returns < 1.0, and `applyAttackDamage()` multiplies base attack damage by that value (fixed 2026-04-01). Previously player Weakness had no effect on outgoing player damage.
- **Damage Preview** — `DamagePreviewContext.playerStrengthModifier` (optional, defaults to 1.0) mirrors this in the preview pipeline. Wired from `getStrengthModifier(ps.statusEffects)` in `CardCombatOverlay.svelte`.

---

## Shield (Block)

- `applyShield(state, amount)` — stacks additively
- `takeDamage()` — shield absorbs first, then HP; `immunity` status absorbs after shield
- `resetTurnState()` — block **persists** across turns (capped at `BLOCK_CARRY_CAP_MULTIPLIER × maxHP = 2× maxHP`). Block no longer decays to 0 each turn (changed 2026-04-01 balance pass).
- `persistentShield` — `fortress_wall` relic's `blockCarries` flag still applies; fortify mechanic remains differentiated as the primary persistent-block card
- Enemy block resets to 0 at start of enemy turn — enemies must re-defend each turn

## Thorns (Retaliation)

- `thorns` card mechanic: reflects `thornsValue` damage back to enemy after each enemy attack
- **Stacks additively** — multiple thorns plays in one encounter add to `turnState.thornsValue` (changed 2026-04-01)
- **Persists for entire encounter** — no longer resets after each enemy attack; resets only at `startEncounter()` (changed 2026-04-01)
- `aegis_stone` relic: grants `+2 thorns` at end of turn if block ≥ `RELIC_AEGIS_STONE_MAX_CARRY` — also additive
- `thorns_persist` tag (thorns L5) and `reactive_thorns_persist` tag (reactive_shield L5): sets `result.thornsPersist = true`; turnManager must carry thorns across encounters when this flag is set.

---

## Tag-Based Mastery Features in cardEffectResolver (2026-04-03)

`resolveCardEffect()` now checks cumulative mastery tags via `hasTag('tag_name')`. Tags are set in `MASTERY_STAT_TABLES` and read via `getMasteryStats().tags`.

Key behavioral changes driven by tags:
- **Shield mechanics**: `fortify_carry` (blockCarries), `brace_exceed2/brace_draw1`, `overheal_heal2/pct5`, `parry_counter3`, `reinforce_draw1`, `shrug_cleanse1`, `guard_taunt1t`, `absorb_draw2cc/absorb_heal1cc`, `reactive_thorns_persist`, `bulwark_no_exhaust`, `conversion_bonus_50pct/keep_block`
- **Buff mechanics**: `empower_2cards`, `quicken_draw1/draw2/ap2`, `focus_draw1/next2free`, `insc_fury_cc_bonus2`, `insc_iron_thorns1`
- **Debuff mechanics**: `hex_vuln1t`, `slow_any_action/slow_weak1t`, `sap_weak2t/strip3block`, `corrode_vuln1t/strip_all`, `expose_dmg3`, `corrtouch_vuln1t`, `bash_vuln2t`, `stagger_weak1t`

**Pending turnManager wiring** — these new `CardEffectResult` fields are emitted by the resolver but turnManager must be updated to apply them:
- `thornsPersist` — carry thorns value across encounter end
- `blockCarries` — skip block decay for this turn
- `counterDamage` — deal damage to attacker when hit
- `healPctApplied` — heal % of max HP
- `tauntDuration` — force enemy attack-only intent
- `removeDebuffCount` — remove N player debuffs
- `empowerTargetCount` — apply buff to N cards instead of 1
- `freePlayCount` — grant N 0-AP plays
- `slowAnyAction` — allow slow to target any action type
- `inscriptionFuryCcBonus` — add flat damage on CC when fury inscription active
- `inscriptionIronThorns` — grant N thorns per turn when iron inscription active
- `blockConsumed` (conversion) — reduce player shield by this amount after damage

---

## Enrage System

`getEnrageBonus(encounterTurnNumber, floor, enemyHpPercent)` returns flat bonus added to all enemy attacks.

Uses `ENRAGE_SEGMENTS` (floor-based): Phase 1 ramps at `ENRAGE_PHASE1_BONUS` per turn for `ENRAGE_PHASE1_DURATION` turns; Phase 2 escalates faster. Enemies below `ENRAGE_LOW_HP_THRESHOLD` (30%) deal an extra `ENRAGE_LOW_HP_BONUS` regardless of segment.
