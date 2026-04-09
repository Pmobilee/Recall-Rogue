# Multiplayer Architecture

> **Source files:** `src/services/multiplayerCoopSync.ts`, `src/services/multiplayerLobbyService.ts`, `src/services/multiplayerTransport.ts`, `src/services/multiplayerGameService.ts`, `src/data/multiplayerTypes.ts`, `src/services/enemyManager.ts`, `src/services/encounterBridge.ts`
> **Last verified:** 2026-04-09 — Coop shared-enemy refactor (host-authoritative HP, end-of-turn delta reconciliation)

---

## Coop Mode — Shared Enemy (Authoritative HP)

### Overview

In co-op mode, both players fight **one shared enemy** with scaled HP. The host is authoritative — all enemy HP changes are merged and broadcast by the host at end-of-turn. Each client applies damage optimistically during their turn; at turn end, the host reconciles and both clients converge to the same state.

### HP Scaling

`getCoopHpMultiplier(playerCount)` in `enemyManager.ts` applies a sublinear curve:
- 1 player: 1.0× (solo)
- 2 players: 1.6×
- 3 players: 2.2×
- 4 players: 2.3× (capped)

Applied once at `createEnemy()`. Do not apply twice.

### Canary System — Disabled in Coop

`canaryEnemyDamageMultiplier` is forced to `1.0` in coop mode (via a gate in `encounterBridge.ts`). The shared-enemy model makes per-player adaptive assist meaningless. Solo and race modes retain normal canary behavior.

`canary.enemyHpMultiplier` is also excluded from `enemyHpMultiplier` computation in coop — the coop HP scaling is handled entirely by `getCoopHpMultiplier()`.

---

## Encounter Start Sync

```
Host                                    Non-host
----                                    --------
createEnemy(template, floor, opts)
broadcastSharedEnemyState(snapshot)  →  awaitCoopEnemyReconcile()
                                        hydrateEnemyFromSnapshot(enemy, snapshot)
activeTurnState.set(...)                activeTurnState.set(...)
[combat visible to both]                [combat visible to both]
```

Both clients capture `_coopPreTurnEnemySnapshot = snapshotEnemy(enemy)` at encounter start. This is the baseline for delta computation on turn 1.

---

## Turn Flow — Optimistic Local + End-of-Turn Reconciliation

```
Both clients (simultaneous turns)
   Player plays cards against local enemy copy
   [mid-turn: P1 sees 150 HP, P2 sees 152 HP — acceptable cosmetic drift]

Player ends turn → handleEndTurn()
   Compute delta: { damageDealt, blockDealt, statusEffectsAdded }
   awaitCoopTurnEndWithDelta(delta)  ← barrier: waits for all players

[Barrier releases when all players have signaled]

Host                                    Non-host
----                                    --------
getCollectedDeltas()                    awaitCoopEnemyReconcile()
applyEnemyDeltaToState(preTurn, all)
hydrateEnemyFromSnapshot(enemy)
rollNextIntent(enemy)
broadcastSharedEnemyState(snapshot)  →  hydrateEnemyFromSnapshot(enemy, snapshot)

[Both clients run executeEnemyIntent() against their own local player HP]
[Full damage to each player — no split, no halving]
```

### Delta Computation

`EnemyTurnDelta` captures what one player did to the enemy during their turn:
- `damageDealt` = `preTurnSnapshot.currentHP - enemy.currentHP` (after card plays)
- `blockDealt` = `preTurnSnapshot.block - enemy.block` (stripped block)
- `statusEffectsAdded` = status effects not present in the pre-turn snapshot

The pre-turn snapshot is stored in `_coopPreTurnEnemySnapshot` (module-level in `encounterBridge.ts`), captured at encounter start and updated after each reconciliation.

### Merge Function

`applyEnemyDeltaToState(snapshot, deltas, phaseTransitionAt?)` in `enemyManager.ts` is a **pure function** that:
1. Sorts deltas by `playerId` for deterministic order
2. Applies `blockDealt` to strip block
3. Applies `damageDealt` to HP (clamped at 0)
4. Merges `statusEffectsAdded` (sums magnitudes for duplicate types)
5. Checks phase transition
6. Returns a new `SharedEnemySnapshot` without mutating the input

---

## Key Types

```typescript
// src/data/multiplayerTypes.ts

interface SharedEnemySnapshot {
  currentHP: number
  maxHP: number
  block: number
  phase: 1 | 2
  nextIntent: EnemyIntent
  statusEffects: StatusEffect[]
}

interface EnemyTurnDelta {
  playerId: string
  damageDealt: number   // post-block, pre-clamp
  blockDealt: number    // block stripped from enemy
  statusEffectsAdded: StatusEffect[]
}
```

---

## Messages

| Message | Sender | Payload | Purpose |
|---------|--------|---------|---------|
| `mp:coop:enemy_state` | Host | `SharedEnemySnapshot` | Initial anchor at encounter start + authoritative state after each turn merge |
| `mp:coop:turn_end_with_delta` | Any client | `{ playerId, delta: EnemyTurnDelta }` | Per-player turn-end signal with damage delta |
| `mp:coop:turn_end` | Any client | `{ playerId }` | Legacy barrier signal (still active, used internally) |
| `mp:coop:turn_end_cancel` | Any client | `{ playerId }` | Cancel a pending turn-end signal |
| `mp:coop:partner_state` | Any client | `PartnerState` | Partner HP/block/score for HUD after enemy phase |

---

## Helper Functions

### `enemyManager.ts`

| Function | Description |
|----------|-------------|
| `snapshotEnemy(enemy)` | Extract `SharedEnemySnapshot` from a live `EnemyInstance` |
| `hydrateEnemyFromSnapshot(enemy, snapshot)` | Overwrite mutable fields of `EnemyInstance` from snapshot |
| `applyEnemyDeltaToState(snapshot, deltas, phaseAt?)` | Pure merge: apply deltas to pre-turn snapshot → new snapshot |

### `multiplayerCoopSync.ts`

| Function | Description |
|----------|-------------|
| `broadcastSharedEnemyState(snapshot)` | Host sends `mp:coop:enemy_state` |
| `onSharedEnemyState(cb)` | Subscribe to incoming enemy state broadcasts |
| `awaitCoopTurnEndWithDelta(delta)` | Barrier + delta send; resolves when all players signal |
| `getCollectedDeltas()` | Returns all deltas for the current barrier, sorted by playerId |
| `awaitCoopEnemyReconcile()` | One-shot Promise resolving on next `mp:coop:enemy_state` |

---

## Known Acceptable Drift

During a turn, P1's local enemy may show a different HP than P2's (each sees only their own damage). This is cosmetic and resolves at end-of-turn. Both clients converge to the host-authoritative state after each turn barrier.

If one player overkills the enemy mid-turn locally (HP → 0) but the other player's client still shows it alive, the encounter ends on both clients once the host's merged state shows HP ≤ 0.

---

## Duel Mode Reference

Duel mode has a similar host-authoritative pattern (see `multiplayerGameService.ts:312-525`). Coop differs in:
- Simultaneous turns (not alternating)
- Enemy attacks hit ALL players for full damage (not round-robin targeted)
- Delta-based reconciliation (not full action submission per duel's `DuelTurnAction`)
