# Chain System

> **Purpose:** How the Knowledge Chain system works — consecutive correct answers, multiplier scaling, chain types, and break conditions.
> **Last verified:** 2026-03-31
> **Source files:** `src/services/chainSystem.ts`, `src/data/chainTypes.ts`, `src/services/chainVisuals.ts`, `src/data/balance.ts`

---

## What Chains Are

A **Knowledge Chain** forms when a player plays consecutive cards via Charge Correct that share the same `chainType` (0–5). Each matching card extends the chain and applies a higher damage multiplier. The chain resets at the start of each player turn.

Chains only form through **Charge Correct** plays — Quick Play and Charge Wrong do not extend a chain. A card with no `chainType` (undefined/null) resets the chain to 0 with no multiplier.

---

## Chain Types

There are 6 chain types total (`NUM_CHAIN_TYPES = 6`). Each run uses 3 of the 6, selected deterministically from a seed via `selectRunChainTypes(seed, count)` using a Fisher-Yates LCG shuffle.

All 6 types defined in `CHAIN_TYPES` in `chainTypes.ts`:

| Index | Name | Hex Color | Glow Color |
|-------|------|----------|-----------|
| 0 | Obsidian | `#546E7A` | `rgba(84, 110, 122, 0.30)` |
| 1 | Crimson | `#EF5350` | `rgba(239, 83, 80, 0.30)` |
| 2 | Azure | `#42A5F5` | `rgba(66, 165, 245, 0.30)` |
| 3 | Amber | `#FFA726` | `rgba(255, 167, 38, 0.30)` |
| 4 | Violet | `#AB47BC` | `rgba(171, 71, 188, 0.30)` |
| 5 | Jade | `#26A69A` | `rgba(38, 166, 154, 0.30)` |

Cards are assigned a `chainType` integer (0–5) at run start from the active 3-type subset. This is runtime-only — not persisted to the DB.

---

## Multiplier Scaling

Defined in `CHAIN_MULTIPLIERS` in `balance.ts` (AR-59.3):

```typescript
export const CHAIN_MULTIPLIERS: number[] = [1.0, 1.0, 1.3, 1.7, 2.2, 3.0];
export const MAX_CHAIN_LENGTH = 5;
```

| Chain Length | Multiplier | Cards Played |
|-------------|-----------|-------------|
| 0 | 1.0× | no cards yet |
| 1 | 1.0× | first card (no bonus) |
| 2 | 1.3× | second matching card |
| 3 | 1.7× | third matching card |
| 4 | 2.2× | fourth matching card |
| 5 | 3.0× | fifth+ matching card (cap) |

Once `MAX_CHAIN_LENGTH = 5` is reached, the multiplier stays at `3.0×`. Capped via `Math.min(_chain.length + 1, MAX_CHAIN_LENGTH)` in `extendOrResetChain()`.

---

## Core Functions (`chainSystem.ts`)

### `extendOrResetChain(chainType, chainMultiplierOverride?)`

Called by `turnManager` on every Charge Correct play:

- If `chainType === null/undefined` — resets chain, returns `1.0`
- If `chainType === _chain.chainType` — increments `_chain.length` (capped at 5), returns `CHAIN_MULTIPLIERS[length]`
- If `chainType !== _chain.chainType` — resets to new chain with `length: 1`, returns `1.0`
- `chainMultiplierOverride` — clamps the multiplier to a fixed value (used by The Nullifier enemy, AR-59.13)

### `resetChain()`

Called at the start of each player turn. Resets state to `{ chainType: null, length: 0 }`.

### `getChainMultiplier(length)`

Returns `CHAIN_MULTIPLIERS[clamp(0, length, MAX_CHAIN_LENGTH)]`. Safe lookup with `?? 1.0` fallback.

### `getChainState()`

Returns a snapshot `{ chainType: number | null, length: number }` for UI consumption.

---

## Chain Momentum (AR-122)

```typescript
export const CHAIN_MOMENTUM_ENABLED = true;
```

When enabled: a correct Charge answer waives the +1 AP surcharge on the **next** Charge that same turn. This rewards consecutive Charge plays within a turn, not just same-chainType plays.

---

## How Chains Interact with Damage

The chain multiplier is passed into `cardEffectResolver.ts` as `options.chainMultiplier`. The full attack formula:

```
CC damage = (quickPlayValue + masteryBonus) × 1.5 × tierMult × chainMult × relicMods + inscriptionBonus
```

The chain multiplier applies to the **full resolved damage** after base + mastery + tier scaling, before relic flat bonuses. Chain Lightning (`chain_lightning` mechanic) is the only card that reads `chainLightningChainLength` directly — its CC damage is `baseValue × chain length` rather than using the standard multiplier.

---

## Break Conditions

The chain resets in these cases:

1. **Turn start** — `resetChain()` is called by `turnManager` at every new turn
2. **Quick Play** — QP does not call `extendOrResetChain()`; chain is not extended or broken [UNVERIFIED — turnManager behavior]
3. **Charge Wrong** — does not extend chain; whether it resets depends on turnManager [UNVERIFIED]
4. **No chainType** — passing `null/undefined` to `extendOrResetChain()` resets chain to 0
5. **Wrong chain type** — playing a Charge Correct card with a different `chainType` starts a new chain at length 1

---

## Visual Feedback (`chainVisuals.ts`)

`chainVisuals.ts` maps `chainType` integers to display colors for `CardHand.svelte`:

- `getChainColor(chainType)` — returns hex color; `#888888` if undefined
- `getChainGlowColor(chainType)` — returns rgba glow color; `rgba(136,136,136,0.30)` if undefined
- `getChainColorGroups(cards)` — groups card IDs by shared `chainType`; only includes groups with 2+ cards (potential chain partners worth highlighting)

Cards with the same `chainType` in hand are visually grouped so players can identify chain opportunities before playing.

---

## Knowledge Surge System (AR-59.4)

Related system that runs on a turn schedule (not per-play):

```typescript
export const SURGE_FIRST_TURN = 2;
export const SURGE_INTERVAL = 4;
```

Surge turns occur on turn 2, then every 4 turns (turns 2, 6, 10, ...). Surge provides a bonus that stacks with chain multipliers. Exact Surge bonuses are defined in `turnManager.ts` [UNVERIFIED — not in chainSystem.ts].
