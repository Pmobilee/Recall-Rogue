# Card System Mechanics

> **Purpose:** Card entity, card types, tier system, damage formula, mastery system, and card creation pipeline.
> **Last verified:** 2026-03-31
> **Source files:** `src/data/card-types.ts`, `src/data/mechanics.ts`, `src/services/cardFactory.ts`, `src/services/cardUpgradeService.ts`, `src/services/cardEffectResolver.ts`, `src/services/damagePreviewService.ts`, `src/data/balance.ts`

> **See also:** [`card-mechanics.md`](card-mechanics.md) — Complete table of all 50+ mechanics (attack, shield, buff, debuff, utility, wild).

---

## Card Entity (`Card` interface)

Each card is a runtime instance linked to a Fact. Key fields:

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Per-run unique ID (`card_<counter>`) |
| `factId` | string | Source fact in the facts DB |
| `cardType` | `CardType` | Combat role |
| `domain` | `FactDomain` | Derived from `fact.category` |
| `tier` | `'1' \| '2a' \| '2b' \| '3'` | SM-2 review progression |
| `baseEffectValue` | number | Pre-multiplier damage/block amount |
| `mechanicId` | string? | Mechanic from the mechanic pool |
| `masteryLevel` | number? | In-run mastery level 0–5 (AR-113) |
| `apCost` | number? | AP cost to play |
| `isInscription` | bool? | Exhausts on play, persists for combat |
| `isCursed` | bool? | Cursed fact penalty applies |
| `isLocked` | bool? | Locked by Trick Question enemy (AR-268) |

---

## Card Types

`CardType = 'attack' | 'shield' | 'utility' | 'buff' | 'debuff' | 'wild'`

Base effect values from `BASE_EFFECT` in `balance.ts`:

| Type | Base Value | Role |
|------|-----------|------|
| `attack` | 4 | Deal damage to enemy |
| `shield` | 3 | Gain block |
| `utility` | 0 | Draw, cycle, manipulate |
| `buff` | 0 | Enhance player or next card |
| `debuff` | 0 | Apply status effects to enemy |
| `wild` | 0 | Context-sensitive or copy effects |

---

## Card Tiers and Power Scaling

Tier is derived from SM-2 review state via `getCardTier()` in `tierDerivation.ts`.

| Tier | Name | `effectMultiplier` | Quiz Format |
|------|------|-------------------|------------|
| `'1'` | Learning | 1.0× | 3 choices |
| `'2a'` | Proven | 1.3× | 4 choices, reverse allowed |
| `'2b'` | Deep Recall | 1.6× | 5 choices, fill-blank allowed |
| `'3'` | Mastered | 1.6× (→ Passive) | Becomes `PassiveEffect` |

Tier 3 cards leave the active hand and become `PassiveEffect` entries. Values in `TIER3_PASSIVE_VALUE` (attack=+1 flat dmg all attacks, shield=+1 flat block, utility=+1 draw at turn start).

---

## Damage Formula

The resolver (`cardEffectResolver.ts`) computes CC damage as:

```
CC damage = (quickPlayValue + getMasteryBaseBonus(mechanicId, masteryLevel))
            × CHARGE_CORRECT_MULTIPLIER (1.5)
            × tierMultiplier
            × chainMultiplier
            × relicModifiers
            + inscriptionFuryBonus
```

`chargeCorrectValue` on `MechanicDefinition` is **dead data** — resolver computes CC as `(quickPlayValue + masteryBonus) × 1.5`. Do not read it.

**Play mode multipliers:**

| Mode | Effect |
|------|--------|
| Quick Play (`quick`) | Uses `quickPlayValue` directly |
| Charge Correct (`charge_correct`) | `(quickPlayValue + masteryBonus) × 1.5 × tier` |
| Charge Wrong (`charge_wrong`) | T1=0.8×, T2a/b=0.85×, T3=0.75× on base |
| Cursed QP | `CURSED_QP_MULTIPLIER = 0.7×` |
| Cursed CC | `CURSED_CHARGE_CORRECT_MULTIPLIER = 1.0×` (reward is the cure) |
| Cursed CW | `CURSED_CHARGE_WRONG_MULTIPLIER = 0.5×` |
| First Charge free (new fact) | Wrong = `FIRST_CHARGE_FREE_WRONG_MULTIPLIER = 0.0×` (fizzles) |

---

## Effective Damage Preview

Service: `src/services/damagePreviewService.ts` — pure function, no side effects.

Cards in hand display **effective** QP and CC values rather than raw base values. Numbers are colored to signal modifier state:

- Green (`damage-buffed`) — effective value exceeds the unmodified base
- Red (`damage-nerfed`) — effective value is below the unmodified base

`CardCombatOverlay` builds a `DamagePreviewContext` from `turnState` and calls `computeDamagePreview` for every card in hand, passing the resulting `Record<string, DamagePreview>` to `CardHand` via the `damagePreviews` prop.

**Modifiers INCLUDED in preview:**

| Modifier | Effect |
|----------|--------|
| Relic % and flat bonuses | Applied per active relic |
| Cursed multiplier | `CURSED_QP_MULTIPLIER` / `CURSED_CHARGE_CORRECT_MULTIPLIER` |
| Empower buff (`buffNextCard`) | % bonus to next card's value |
| Overclock ready | 2× effective damage |
| Double strike ready | 2× effective damage |
| Enemy vulnerable | 1.5× damage |
| Enemy `quickPlayDamageMultiplier` | Partial QP reduction (e.g. Core Harbinger 0.3×) |
| Enemy charge-resistant | 50% QP damage |
| Enemy hardcover | Flat QP damage reduction |
| Relics: inscription_fury, bastion's_will, stone_wall, worn_shield, hollow_armor | Inline computation |

**Modifiers EXCLUDED (unknowable at preview time):**

Speed bonus, chain multiplier, chainVulnerable, factDamageBonus, crescendo streak, memory_palace streak.

---

## Mastery System (AR-113)

Cards gain mastery during a run by answering Charge correctly; lose mastery on wrong answers. Max once per encounter per card (`masteryChangedThisEncounter`). Resets each run.

- `MASTERY_MAX_LEVEL = 5`
- `MASTERY_BASE_DISTRACTORS = 2` (L0), `MASTERY_UPGRADED_DISTRACTORS = 3` (L1+)
- Colors: L0=none, L1=green `#22c55e`, L2=blue `#3b82f6`, L3=purple `#a855f7`, L4=orange `#f97316`, L5=gold `#eab308`

### Mastery Scaling

```typescript
getMasteryBaseBonus(mechanicId, level) = MASTERY_UPGRADE_DEFS[mechanicId].perLevelDelta × level
getMasterySecondaryBonus(mechanicId, level) = secondaryPerLevelDelta × level
```

Selected caps and deltas (from `MASTERY_UPGRADE_DEFS` in `cardUpgradeService.ts`):

| Mechanic | perLevelDelta | maxLevel | L5 bonus |
|----------|-------------|---------|---------|
| `strike` | +3 | 5 | +15 |
| `block` | +2 | 5 | +10 |
| `empower` | +5% | 5 | +25% |
| `quicken` | 0 | 3 | tag bonus at L3 |
| `cleanse` | 0 | 2 | binary only |
| `overclock` | 0 | 3 | AP-1 at L3 |

Some mechanics gain tags at L3 via `addTagAtLevel: [3, 'tagName']` unlocking additional behavior in the resolver.

---

## Card Creation (`createCard`)

`cardFactory.ts` builds cards via `createCard(fact, reviewState, cardTypeOverride?)`:

1. `domain` — `resolveDomain(fact)` from `fact.category`
2. `cardType` — `cardTypeOverride` or `deriveCardTypeForFactId(fact.id)`
3. `tier` — `getCardTier()` from `reviewState.stability + consecutiveCorrect + passedMasteryTrial`
4. `baseEffectValue` — `BASE_EFFECT[cardType]` (attack=4, shield=3, others=0)
5. `effectMultiplier` — tier multiplier (T1=1.0, T2a=1.3, T2b=1.6, T3=1.6)
6. `isMasteryTrial` — `qualifiesForMasteryTrial()` checks `MASTERY_TRIAL.REQUIRED_STABILITY=30` + `REQUIRED_CONSECUTIVE_CORRECT=7`

Mechanics (`mechanicId`) and chain type (`chainType`) are assigned by the run pool builder, not `createCard`.
