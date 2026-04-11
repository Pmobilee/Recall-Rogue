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

## Enemy Intent Determinism

Enemy intents are deterministic across co-op clients via a **seeded RNG fork** named `enemy-intent` (fork of the run RNG initialized via `initRunRng(seed)` in `seededRng.ts`).

- `weightedRandomIntent()` in `enemyManager.ts` calls `getRunRng('enemyIntents')` when `isRunRngActive()` is true. Both host and non-host advance the same fork in the same sequence, so both compute identical intents independently.
- The host is still authoritative: after the barrier, the host rolls via `rollNextIntent`, snapshots (including `nextIntent`), and broadcasts. The `SharedEnemySnapshot.nextIntent` field carries the rolled intent to non-host clients.
- **Non-host drift detection** (`encounterBridge.ts`): before calling `hydrateEnemyFromSnapshot`, the non-host rolls locally and compares with the host's `nextIntent`. A mismatch triggers `console.warn('[coop-sync] intent drift', { local, host })`. The host value is adopted regardless.
- Solo/test contexts without an active run seed fall back to `Math.random()` (the `isRunRngActive()` guard preserves this path).

**RNG fork label:** `getRunRng('enemyIntents')` in `enemyManager.ts`.

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

---

## Lobby Discovery & Privacy — Phase 4 Web Backend

**Source files:** `server/src/services/mpLobbyRegistry.ts`, `server/src/routes/mpLobby.ts`, `server/src/routes/mpLobbyWs.ts`
**Added:** 2026-04-11 — Phase 4 of the public/private lobby browsing feature

### Three-Backend Architecture

The client routes discovery / create / join through a `lobbyBackend` abstraction in `multiplayerLobbyService.ts`. Three backends exist:

| Backend | Transport | Discovery | Scope |
|---------|-----------|-----------|-------|
| `steamBackend` | Steam P2P + Steamworks matchmaking | `steam_request_lobby_list` → metadata loop | Steam builds (primary) |
| `webBackend` | Fastify REST + WebSocket | `GET /mp/lobbies` | Web / mobile builds |
| `broadcastBackend` | BroadcastChannel + `localStorage` directory | `localStorage['rr-mp:directory']` | Dev two-tab mode |

### Steam Backend — Lobby List Wrappers (Phase 3)

**Source file:** `src/services/steamNetworkingService.ts`
**Added:** 2026-04-11 — Phase 3 of the public/private lobby browsing feature

Two TypeScript wrappers bridge the Phase-1 Rust commands to the `steamBackend`. Both are guarded by `hasSteam` and return safe defaults on non-Steam platforms (browser, mobile):

| Function | Tauri command | Return | Off-Steam default | Purpose |
|----------|---------------|--------|-------------------|---------|
| `requestSteamLobbyList()` | `steam_request_lobby_list` | `Promise<boolean>` | `false` | Fire-and-forget kick; Steam callback delivers lobby IDs asynchronously. Callers pump `runSteamCallbacks` then query `getLobbyData` per lobby to build browser entries. Returns `true` if the IPC call was accepted. |
| `getLobbyMemberCount(lobbyId)` | `steam_get_lobby_member_count` | `Promise<number>` | `0` | Read current member count for a lobby ID without joining — enables the "2/4" display in the browser grid. |

`requestSteamLobbyList` is fire-and-forget: Steam's async callback mechanism delivers the actual list later. The `steamBackend` in `multiplayerLobbyService.ts` must pump `runSteamCallbacks` after calling this, then loop over returned lobby IDs via `getLobbyData` to construct `LobbyBrowserEntry` objects.

### Web Backend — Fastify Registry

`mpLobbyRegistry.ts` maintains an in-memory `Map<lobbyId, MpLobby>`. Key properties:

- **In-memory only** — a server restart drops all lobbies. This is documented and accepted for V1 (matches Among Us / L4D lifecycle). SQLite persistence is a deferred follow-up.
- **10-minute TTL** — `pruneStale()` runs every 60 s and drops lobbies with `lastActivity < Date.now() - 10 min`. All sockets are closed before deletion.
- **Password convention** — client hashes the raw password with SHA-256 before sending. Server stores and compares the hash only. `timingSafeEqual` prevents timing-oracle attacks. This is a UX gate, not a crypto auth boundary.
- **Friends-only degradation** — `friends_only` lobbies are excluded from `GET /mp/lobbies` because the web backend has no friends graph. On Steam, `SteamLobbyType::FriendsOnly` is used natively. On web, friends-only lobbies are code-join only (no browser entry).

### REST Routes (under `/mp` prefix)

| Method | Path | Body / Query | Description |
|--------|------|-------------|-------------|
| `POST` | `/mp/lobbies` | `{ hostId, hostName, mode, visibility, passwordHash?, maxPlayers, … }` | Create lobby, returns `{ lobbyId, lobbyCode, joinToken }` |
| `GET` | `/mp/lobbies` | `?mode=&fullness=` | List public + password lobbies for browser |
| `GET` | `/mp/lobbies/code/:code` | — | Resolve 6-char code → lobby info |
| `POST` | `/mp/lobbies/:id/join` | `{ playerId, displayName, password? }` | Join + receive `joinToken` for WS upgrade |
| `POST` | `/mp/lobbies/:id/leave` | `{ playerId }` | REST leave (before WS connected or after drop) |

### WebSocket Protocol (`/mp/ws?lobbyId=&playerId=&token=`)

1. Server validates `joinToken` (issued by prior REST join).
2. On success: `attachWebSocket()` + sends `mp:lobby:settings` snapshot.
3. **Inbound message routing:**
   - `mp:lobby:ready` — broadcast to all players.
   - `mp:lobby:leave` — `leaveLobby()` + close.
   - `mp:lobby:settings` — host-only; apply patch + rebroadcast snapshot.
   - `mp:lobby:start` — host-only; set `status=in_game` + broadcast.
   - `mp:race:*`, `mp:coop:*`, `mp:duel:*`, `mp:trivia:*` — forwarded verbatim to other players.
4. On close: `leaveLobby()` → broadcast `mp:lobby:leave` to remaining players.

### Lobby Code Alphabet

Both client (`multiplayerLobbyService.ts:465`) and server (`mpLobbyRegistry.ts`) use exactly:
```
ABCDEFGHJKLMNPQRSTUVWXYZ23456789
```
No I, O, 0, or 1 (visual confusion). Codes are 6 characters, uppercase only.

---

## Phase 5 — WebSocket Transport URL Construction (2026-04-11)

**Source file:** `src/services/multiplayerTransport.ts`

### `ConnectOpts` interface

A new optional third parameter on `MultiplayerTransport.connect()`:

```typescript
interface ConnectOpts {
  lobbyId?: string;     // Lobby ID to include in the WS upgrade query params
  joinToken?: string;   // Short-lived token from POST /mp/lobbies/:id/join
}
```

All four transports accept `opts` for interface compatibility. Only `WebSocketTransport` uses it.

### `WebSocketTransport.connect` URL building

The transport no longer uses `target` as a raw WS URL. Instead:

1. Reads the base URL from `import.meta.env.VITE_MP_WS_URL` (fallback: `ws://localhost:3000/mp/ws` via the `DEFAULT_MP_WS_URL` module-level const).
2. Appends `?lobbyId=<resolvedLobbyId>&playerId=<localId>&token=<joinToken>` to form the full WS upgrade URL.
3. `resolvedLobbyId` prefers `opts.lobbyId` over `target` so callers using the `joinLobbyById` path can supply the canonical backend ID.

### Environment variables (`.env.example`)

```
VITE_MP_WS_URL=ws://localhost:3000/mp/ws    # WebSocket URL for WS upgrade
VITE_MP_API_URL=http://localhost:3000        # REST base URL for webBackend
```

---

## Phase 6/8 — Unified LobbyBackend abstraction (2026-04-11)

**Source file:** `src/services/multiplayerLobbyService.ts`

### New public API surface

| Export | Signature | Description |
|--------|-----------|-------------|
| `createLobby` | `async (playerId, displayName, mode, opts?)` | Host creates a lobby via the active backend. Now async. `opts.password` is SHA-256 hashed client-side. |
| `joinLobby` | `async (lobbyCode, playerId, displayName, password?)` | Join by invite code. Now async; hashes password and resolves code via backend. |
| `joinLobbyById` | `async (lobbyId, playerId, displayName, password?)` | Join directly by backend lobby ID (used by the browser screen). |
| `setVisibility` | `(visibility: LobbyVisibility)` | Host-only. Co-updates `visibility` and `hasPassword` atomically. |
| `setPassword` | `async (password: string \| null)` | Host-only. Hashes plaintext, stores in `_passwordHash`. Clears if null. |
| `setMaxPlayers` | `(n: number)` | Host-only. Clamped to `[MODE_MIN_PLAYERS[mode], MODE_MAX_PLAYERS[mode]]`. |
| `listPublicLobbies` | `async (filter?)` | Delegates to active backend. Returns `LobbyBrowserEntry[]`. |

### `LobbyBackend` interface

```typescript
interface LobbyBackend {
  createLobby(opts: CreateLobbyBackendOpts): Promise<{ lobbyId, lobbyCode, joinToken? }>;
  resolveByCode(code: string): Promise<string | null>;
  joinLobbyById(lobbyId, playerId, displayName, passwordHash?): Promise<JoinLobbyResult>;
  listPublicLobbies(filter?): Promise<LobbyBrowserEntry[]>;
}
```

`pickBackend()` selects: `broadcastBackend` → `steamBackend` → `webBackend` (priority order). `?mp` is an explicit dev opt-in and therefore beats auto-detected Steam so devs running a Steam build can two-tab test the broadcast path without fighting the factory.

### Password handling

- Client hashes plaintext with SHA-256 (`crypto.subtle.digest`) before any backend call.
- Hash stored in module-level `_passwordHash` (never in `LobbyState` — not serialized over the wire).
- Backend receives only the hash. Fastify uses `timingSafeEqual`; Steam stores it in lobby metadata.
- `_passwordHash` cleared in `leaveLobby()`.

### `broadcastBackend` — localStorage fake directory (Phase 8)

- `localStorage['rr-mp:directory']` — JSON array of `LobbyBrowserEntry`.
- Host heartbeat: `setInterval(() => upsertBroadcastEntry(...), 5000)`. Interval stored in `_broadcastHeartbeat`; cleared in `leaveLobby()`.
- Read-side pruning: entries with `createdAt < Date.now() - 30_000` dropped on every read.
- Write-side dedup: `upsertBroadcastEntry` removes existing entry with the same `lobbyId` before inserting.
- `resolveByCode` returns `null` — broadcast mode uses the lobbyCode directly as the `BroadcastChannel` channel name.
- `friends_only` lobbies excluded from `listPublicLobbies` (no friends graph in localStorage).

### Backend Selection Logic

`pickBackend()` uses a priority cascade. The conditions are checked in order — the first matching condition wins:

| Priority | Condition | Backend selected | Notes |
|----------|-----------|-----------------|-------|
| 1 | `isBroadcastMode()` — URL has `?mp` param | `broadcastBackend` | Dev two-tab mode; uses `localStorage` fake directory. Explicit opt-in beats auto-detected Steam. |
| 2 | `hasSteam === true` | `steamBackend` | Tauri + Steam build; uses Steamworks matchmaking + P2P |
| 3 | (default) | `webBackend` | Web / mobile / CI; uses Fastify REST + WebSocket |

`hasSteam` is the existing Steam availability check from `steamService.ts`. `isBroadcastMode()` checks `new URLSearchParams(window.location.search).has('mp')`. The `?mp`-first order is load-bearing: a dev running a Steam build with `?mp` in the URL expects broadcast-mode two-tab testing, not Steam auto-routing — see commit `cc2e5b8bc`.

### Lobby Visibility — Tri-State

`LobbyVisibility` is `'public' | 'password' | 'friends_only'`. Behavior per state:

| Visibility | Steam behavior | Web/Broadcast behavior |
|------------|---------------|------------------------|
| `public` | `SteamLobbyType::Public`; appears in `steam_request_lobby_list` results | `GET /mp/lobbies` returns the entry; no icon |
| `password` | `SteamLobbyType::Public` + `password_hash` in lobby metadata; appears in list with 🔒 icon | Listed by `GET /mp/lobbies`; join validates hash; 🔒 icon |
| `friends_only` | `SteamLobbyType::FriendsOnly`; Steam handles native friends-graph filter | **Excluded from browser list** — no friends graph on web/broadcast; code-join only; tooltip explains |

**Degradation note:** `friends_only` on web degrades to "hidden from the lobby browser" (effectively code-join only). Steam friends can still receive a direct invite link. The lobby creation UI disables the Friends Only option on non-Steam builds with a tooltip: "Steam only — invite friends via code instead."
