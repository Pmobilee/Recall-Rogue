# CR-11: Remaining Card Mechanics Phase 2

> Phase: P1 — Core Systems Completion
> Priority: MEDIUM
> Depends on: CR-FIX-08 (Card mechanics pool phase 1 — 16 base mechanics)
> Estimated scope: L

Add the remaining 17 card mechanics from GAME_DESIGN.md Section 4, bringing the total from 16 to 33. These mechanics add strategic variety — cost-tradeoff attacks, persistent defense, status effects, card manipulation, and resource trading. Each mechanic is defined as a data-driven entry resolved by the card effect resolver.

## Design Reference

From GAME_DESIGN.md Section 4 (Card Mechanics Pool).

Phase 1 (CR-FIX-08) implements 2 mechanics per type (16 total): Strike, Multi-Hit, Block, Thorns, Restore, Cleanse, Empower, Quicken, Weaken, Expose, Scout, Recycle, Sustained, Emergency, Mirror, Adapt.

This CR adds the remaining mechanics:

### Attack (add 4)

| Mechanic | Effect | Base Value |
|----------|--------|------------|
| Heavy Strike | High damage, costs 2 AP | 14 |
| Piercing | Damage, ignores enemy block | 6 |
| Reckless | High damage + self-damage | 12 dmg, 3 self |
| Execute | Damage + bonus if enemy <30% HP | 6 (+8 below 30%) |

### Shield (add 3)

| Mechanic | Effect | Base Value |
|----------|--------|------------|
| Fortify | Block that persists into next turn | 4 persistent |
| Parry | Block + draw bonus if enemy attacks | 3 block + draw |
| Brace | Block equal to enemy's telegraphed attack | Varies |

### Heal (add 2)

| Mechanic | Effect | Base Value |
|----------|--------|------------|
| Overheal | Heal, excess converts to temporary block | 4 (overflow) |
| Lifetap | Heal % of damage dealt this turn | 30% turn dmg |

### Buff (add 2)

| Mechanic | Effect | Base Value |
|----------|--------|------------|
| Double Strike | Next attack hits twice at 60% each | 2x 60% |
| Focus | Next card minimum 1.3x difficulty multiplier | Override |

### Debuff (add 2)

| Mechanic | Effect | Base Value |
|----------|--------|------------|
| Slow | Enemy skips next buff/shield action | 1 skip |
| Hex | Poison: 3 dmg/turn for 3 turns | 9 total |

### Utility (add 2)

| Mechanic | Effect | Base Value |
|----------|--------|------------|
| Foresight | See enemy's next 2 intents | 2-turn vision |
| Transmute | Transform 1 random hand card to different type | 1 transform |

### Regen (add 1)

| Mechanic | Effect | Base Value |
|----------|--------|------------|
| Immunity | Prevent next status damage instance | 1 shield |

### Wild (add 1)

| Mechanic | Effect | Base Value |
|----------|--------|------------|
| Overclock | Double next card's effect, draw 4 next turn instead of 5 | 2x, -1 draw |

From GAME_DESIGN.md Section 4 (Mechanic Assignment Rules):
- Heavy Strike (2 AP) limited to max 3 per pool
- Quicken (+1 AP) limited to max 2 per pool
- No duplicate mechanics in the same drawn hand (reroll on draw)

## Implementation

### Data Model

**Extend mechanic definitions** in `src/data/mechanics.ts` (or create if CR-FIX-08 hasn't):

```typescript
export interface MechanicDefinition {
  id: string;
  name: string;
  type: CardType;
  description: string;
  baseValue: number;
  apCost: number;              // Default 1, Heavy Strike = 2
  maxPerPool: number;          // 0 = unlimited
  secondaryValue?: number;     // Reckless self-dmg, Execute bonus
  secondaryThreshold?: number; // Execute: 0.3 (30% HP)
  tags: string[];              // e.g. ['strike'] for Sharpened Edge relic
}
```

Add 17 new entries to the `MECHANIC_DEFINITIONS` array with the values above.

### Logic

**Extend `resolveCardEffect()`** in `src/services/cardEffectResolver.ts` with branches for each new mechanic:

**Heavy Strike:** Validate AP >= 2 before allowing commit. Deduct 2 AP. Deal `14 x modifiers`.

**Piercing:** Deal `6 x modifiers`. Bypass enemy block entirely (damage applies regardless of shield).

**Reckless:** Deal `12 x modifiers` to enemy. Deal 3 flat damage to self (unmodified, ignores player block).

**Execute:** Deal `6 x modifiers`. If enemy currentHP < 30% of maxHP, deal additional `8 x modifiers`.

**Fortify:** Apply `4 x modifiers` block. Mark block as persistent (survives turn reset). If Fortress relic active, this is redundant but harmless.

**Parry:** Apply `3 x modifiers` block. If enemy's current intent type is `'attack'` or `'multi_attack'`, draw 1 extra card next turn. If Aegis relic active, always trigger draw regardless.

**Brace:** Apply block equal to enemy's current intent `value`. If enemy intent is not attack-type, apply 0 block. Uses single-hit value for multi-attacks (not total).

**Overheal:** Heal `4 x modifiers`. Excess above maxHP converts to temporary block (1:1 ratio). If Overgrowth relic active, same behavior (stacks conceptually but not numerically).

**Lifetap:** Heal 30% of total damage dealt by player this turn. Minimum heal: 1 HP. If no damage dealt, heal 1.

**Double Strike:** Sets a buff flag on TurnState. NEXT attack card played this turn hits twice, each hit at 60% of its computed value. Expires at end of turn if unused.

**Focus:** Sets a buff flag. NEXT card's difficulty multiplier is floored at 1.3x (if it would be lower due to FSRS ease). Expires at end of turn.

**Slow:** Enemy's next buff or shield intent is replaced with a no-op. If enemy has no buff/shield in upcoming queue, no effect.

**Hex:** Apply poison status: 3 damage per turn for 3 turns (9 total damage).

**Foresight:** Set a flag revealing enemy intents for next 2 turns. UI shows upcoming intents above enemy.

**Transmute:** Pick 1 random card from hand (excluding the card being played). Change its `cardType` to a random different type. Reassign mechanic from new type's pool. Recalculate `baseEffectValue`.

**Immunity:** Apply an "immune" status buff. Absorbs the next poison/burn/status damage tick. Consumed on use, otherwise expires at encounter end.

**Overclock:** Sets buff flag. NEXT card's final effect value is doubled. On next turn's draw phase, draw 4 cards instead of 5.

### UI

**Heavy Strike AP badge:**
- When Heavy Strike is selected: show "2 AP" badge in amber on the card
- If player AP < 2: Cast button disabled, text "Requires 2 AP"
- On commit: 2 AP gems dim simultaneously

**Brace dynamic value:**
- Card effect text dynamically shows enemy intent value: "Block: 8" if enemy telegraphs 8
- If enemy intent is non-attack: "Block: 0"

**Foresight display:**
- After playing Foresight: enemy intent area shows 2 future turns
- Format: "Next: [intent]" and "Then: [intent]"
- Fades after those turns pass

**Transmute animation:**
- Transformed card gets brief shimmer in hand
- Updates type color tint and mechanic name instantly

### System Interactions

- **AP system (CR-FIX-03):** Heavy Strike costs 2 AP. Validate before commit.
- **Combo:** All mechanics apply combo normally.
- **Tier multiplier:** All mechanics multiply base value by tier modifier.
- **Double Strike + Multi-Hit:** Multi-Hit (3x3) under Double Strike becomes 6 hits at 60% value each.
- **Double Strike + Heavy Strike:** 14 x modifiers x 0.6, applied twice. Still costs 2 AP.
- **Overclock + Quicken:** Independent. Overclock reduces draw, Quicken adds AP.
- **Reckless self-damage:** NOT modified by Glass Cannon (+10% incoming). Glass Cannon only affects enemy damage.
- **Piercing + Expose:** Piercing bypasses block. Expose (+20% damage) still applies.
- **Execute bonus:** The +8 is ALSO multiplied by all modifiers (tier, combo, speed, etc.).
- **Fortify + Fortress relic:** Both cause block persistence. Redundant but not harmful.
- **Parry + Aegis relic:** Aegis makes Parry always trigger draw regardless of enemy intent.

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Heavy Strike with 1 AP remaining | Cast button disabled, tooltip "Requires 2 AP" |
| Heavy Strike with exactly 2 AP | Allowed. 0 AP after, auto End Turn |
| Brace when enemy intent is 'heal' | Block = 0 |
| Brace when enemy multi_attack 3x4 | Block = 4 (single hit value, not total 12) |
| Lifetap on turn where player dealt 0 damage | Heal = 1 HP (minimum) |
| Double Strike buff, no more attack cards in hand | Buff wasted, expires at turn end |
| Double Strike + Multi-Hit (3x3) | 6 hits total, each at 60% computed value |
| Transmute the last card in hand | Valid. Card transforms in place. Player can play it. |
| Overclock, only 3 cards in draw pile | Draw min(4, available). If fewer than 4, draw whatever remains. |
| Focus + Tier 2b card (difficulty multiplier already 1.6x) | Focus has no effect (1.6x > 1.3x floor) |
| Immunity + no status damage ever taken | Immunity buff sits until consumed or encounter ends |
| Slow + enemy has no buff/shield in next 3 intents | Slow has no effect. AP still spent. |

## Files

| Action | File | What Changes |
|--------|------|-------------|
| Create/Modify | `src/data/mechanics.ts` | Add 17 new MechanicDefinition entries |
| Modify | `src/services/cardEffectResolver.ts` | Add resolution branches for each new mechanic |
| Modify | `src/services/turnManager.ts` | Double Strike/Focus/Overclock buff flags, Fortify persistent block |
| Modify | `src/services/runPoolBuilder.ts` | Enforce maxPerPool during mechanic assignment, no-duplicate-in-hand reroll |
| Modify | `src/services/deckManager.ts` | Overclock draw reduction, Transmute card mutation |
| Modify | `src/ui/components/CardCombatOverlay.svelte` | AP cost badge, Brace dynamic value, Foresight display |
| Create | `tests/unit/mechanics-phase2.test.ts` | Unit tests for each new mechanic |

## Done When

- [ ] All 17 new mechanics defined in data layer with correct base values
- [ ] Heavy Strike costs 2 AP, Cast disabled when AP < 2
- [ ] Piercing ignores enemy block
- [ ] Reckless deals self-damage (3) in addition to enemy damage (12)
- [ ] Execute deals bonus damage (+8) when enemy below 30% HP
- [ ] Fortify block persists between turns
- [ ] Parry grants draw bonus when enemy intent is attack
- [ ] Brace block equals enemy's telegraphed attack value
- [ ] Overheal excess converts to temporary block
- [ ] Lifetap heals 30% of turn's total damage dealt
- [ ] Double Strike makes next attack hit twice at 60% each
- [ ] Focus floors next card's difficulty multiplier at 1.3x
- [ ] Slow skips enemy's next buff/shield intent
- [ ] Hex applies 3/turn poison for 3 turns
- [ ] Foresight reveals next 2 turns of enemy intent
- [ ] Transmute changes a random hand card's type and mechanic
- [ ] Immunity absorbs next status damage instance
- [ ] Overclock doubles next card's effect, draws 4 next turn
- [ ] maxPerPool enforced (Heavy Strike max 3, Quicken max 2)
- [ ] No duplicate mechanics in same drawn hand (reroll on conflict)
