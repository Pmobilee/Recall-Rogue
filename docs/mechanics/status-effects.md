# Status Effects

> **Purpose:** Complete list of all status effects, stacking rules, tick timing, and application behavior.
> **Last verified:** 2026-04-08 (6.3 enemy buff persistence, 6.5 Plagiarist strength indicator)
> **Source files:** `src/data/statusEffects.ts`, `src/services/turnManager.ts`, `src/services/cardEffectResolver.ts`

---

## Core Types

```ts
// src/data/statusEffects.ts
export type StatusEffectType =
  | 'poison' | 'regen' | 'strength' | 'weakness' | 'vulnerable'
  | 'immunity' | 'burn' | 'bleed'
  | 'charge_damage_amp_percent'   // AR-207: Curse of Doubt
  | 'charge_damage_amp_flat';     // AR-207: Mark of Ignorance

export interface StatusEffect {
  type: StatusEffectType;
  value: number;          // magnitude; stacks additively with same type
  turnsRemaining: number; // countdown; 99 = sentinel (expires by other means)
}
```

---

## All Status Effects

### Poison
- **Target:** player or enemy
- **Effect:** Deals `value` damage per tick
- **Tick:** During `tickStatusEffects()`, called from `endPlayerTurn()` (after enemy attack)
- **Stacking:** Values add; duration = max of existing vs new
- **Immunity interaction:** If player has `immunity`, Poison damage is suppressed and immunity is consumed instead (`turnsRemaining = 0`)
- **Expiry:** `turnsRemaining` counts down each tick; removed when `<= 0`

### Regen
- **Target:** player
- **Effect:** Heals `value` HP per tick
- **Tick:** During `tickStatusEffects()`, same timing as Poison
- **Stacking:** Values add; duration = max
- **Expiry:** `turnsRemaining` countdown

### Strength
- **Target:** player or enemy
- **Effect:** +25% damage multiplier per stack (`getStrengthModifier()`)
- **Formula:** `modifier = 1.0 + strength.value * 0.25` (minimum 0.25 after weakness)
- **Stacking:** Values add; duration = max
- **Tick:** Does not tick — passive multiplier read at damage resolution time
- **Expiry:** `turnsRemaining` countdown (99/9999 = sentinel, permanent for rest of encounter)
- **Enemy buffs (6.3):** All enemy buff intents applied via `executeEnemyIntent()` use `turnsRemaining: 9999` so they persist the entire encounter. Per-encounter direct applications (e.g. Plagiarist `onEnemyTurnStart`) also use `999`/`9999`. Player debuffs (weakness, poison, etc.) still use their normal durations.

### Weakness
- **Target:** player or enemy
- **Effect:** −25% damage multiplier per stack
- **Formula:** `modifier -= weakness.value * 0.25` (clamped to minimum 0.25 combined with Strength)
- **Stacking:** Values add; duration = max
- **Tick:** Passive, no tick

### Vulnerable
- **Target:** enemy
- **Effect:** Makes enemy vulnerable — checked by `isVulnerable(effects)` at damage resolution
- **Stacking:** Values add; duration = max
- **Tick:** `turnsRemaining` countdown — does NOT apply bonus damage directly; the effect is read by mechanics that check `isVulnerable()`

### Immunity
- **Target:** player
- **Effect:** Absorbs one incoming damage instance up to `value` damage; consumed on trigger
- **Stacking:** Values add; duration = max (but fires once per hit event)
- **Applied as:** `value: 8, turnsRemaining: 99` (applied by immunity card mechanic)
- **Consumed in:** `takeDamage()` in `playerCombatState.ts` — absorbs after shield, before HP

### Burn
- **Target:** enemy (or player via self-Burn relics)
- **Effect:** On-hit bonus damage equal to current stacks; stacks halve (floor) after firing
- **Trigger:** `triggerBurn(effects)` — called from `playCardAction()` whenever attack damage is dealt
  - Multi-hit cards: triggers once per hit (stacks halve after each hit)
  - Does NOT trigger on Thorns/reflect damage
- **Stacking:** Values add; duration = max
- **Applied with:** `turnsRemaining: 99` (sentinel — expires by halving to 0, not by turn countdown)
- **Expiry:** When stacks halve to 0 (`value <= 0` after halving), effect is removed
- **Player self-Burn:** When enemy attacks, `triggerBurn(playerState.statusEffects)` fires — self-Burn adds to incoming damage

### Bleed
- **Target:** enemy
- **Effect:** Flat bonus damage per stack on card-play attacks: `getBleedBonus(effects, BLEED_BONUS_PER_STACK)`
- **Decay:** `BLEED_DECAY_PER_TURN` stacks removed at end of each enemy turn (after Poison tick, before next player turn)
- **Stacking:** Values add; duration = max
- **Applied with:** `turnsRemaining: 99` (sentinel — expires by decay, not countdown)
- **Expiry:** Removed when `value <= 0` after decay
- **DOES NOT** tick passively like Poison — only adds bonus on card-play attack damage

### charge_damage_amp_percent (Curse of Doubt)
- **Target:** enemy
- **Effect:** Percentage bonus amplifier on Charge damage (e.g. `value = 30` = +30%)
- **AR:** AR-207
- **Stacking:** Values add; duration = max
- **Tick:** `turnsRemaining` countdown

### charge_damage_amp_flat (Mark of Ignorance)
- **Target:** enemy
- **Effect:** Flat bonus on Charge damage (e.g. `value = 3` = +3 damage)
- **AR:** AR-207
- **Stacking:** Values add; duration = max
- **Tick:** `turnsRemaining` countdown

---

## Stacking Rules

All status effects use `applyStatusEffect()` which has a single rule:

```ts
// If same type already exists:
existing.value += newEffect.value;
existing.turnsRemaining = Math.max(existing.turnsRemaining, newEffect.turnsRemaining);
// If no existing: push a copy
```

There is no cap on stacked value. Duration takes the higher of the two values (does not add).

---

## When Effects Tick

`tickStatusEffects(effects)` runs once per enemy turn inside `endPlayerTurn()`:

1. Immunity check — if immunity is present, Poison damage is suppressed (immunity consumed)
2. Poison — damages by `value`
3. Regen — heals by `value`
4. All effects: `turnsRemaining -= 1`
5. Effects with `turnsRemaining <= 0` are removed

Burn and Bleed do NOT tick in this function. Burn fires in `triggerBurn()` (called during card play). Bleed decays in `endPlayerTurn()` after the enemy status tick, at `bleedEffect.value -= BLEED_DECAY_PER_TURN`.

---

## Player vs Enemy Effects

| Effect | Can apply to Player | Can apply to Enemy |
|---|---|---|
| `poison` | Yes | Yes |
| `regen` | Yes | No (in practice) |
| `strength` | Yes (Warcry) | Yes (enemy buff intents) |
| `weakness` | Yes | Yes |
| `vulnerable` | No | Yes |
| `immunity` | Yes | No |
| `burn` | Yes (self-Burn relics) | Yes |
| `bleed` | No | Yes |
| `charge_damage_amp_percent` | No | Yes |
| `charge_damage_amp_flat` | No | Yes |

Player status effects live in `playerState.statusEffects`; enemy effects live in `enemy.statusEffects`. Both use the same `StatusEffect[]` array type and identical `applyStatusEffect()`/`tickStatusEffects()` functions.

---

## Cleanse

Cards with `applyCleanse` remove all debuffs from `playerState.statusEffects` where type is in `['poison', 'weakness', 'vulnerable', 'burn', 'bleed', 'freeze']`. The `adaptCleanse` variant removes one random debuff from that set.
