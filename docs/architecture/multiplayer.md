# Multiplayer Architecture

> **Source files:** `src/services/multiplayerCoopSync.ts`, `src/services/multiplayerLobbyService.ts`, `src/services/multiplayerTransport.ts`, `src/services/multiplayerGameService.ts`, `src/data/multiplayerTypes.ts`, `src/services/enemyManager.ts`, `src/services/encounterBridge.ts`
> **Last verified:** 2026-04-20 — Tauri v2 desktop detection fix + Steam lobby async-callback polling

---

## E2E Verification Status (2026-04-13)

All five multiplayer modes were tested end-to-end in batch MP-20260413-003941 using two real Docker containers connected via Fastify `webBackend`. No bots were involved — both containers were full WebSocket clients.

| Mode | Result | Notes |
|------|--------|-------|
| Race Mode | PASS | Lobby → combat → multiple turns |
| Same Cards | PASS | Lobby → combat → 3 turns each |
| Knowledge Duel | PASS | Lobby → combat → 2 turns each |
| Co-op | PASS | Lobby → combat → 8+ turns, 2 enemies |
| Trivia Night | PASS | Lobby → combat → 1 turn |

**Seed sync verified:** Both players see identical enemy (Eraser Worm 28/28), identical hand (Strike, Block, Transmute, Strike, Block), and identical map (25 nodes).

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

interface HouseRules {
  turnTimerSecs: number          // 20 | 45 | 90
  quizDifficulty: 'adaptive' | 'easy' | 'hard'
  fairness: FairnessOptions      // chainNormalized, etc.
  ascensionLevel: number         // 0 = off, 1-20 = ascension level for the run
}
```

### HouseRules — ascensionLevel (added 2026-04-14)

`ascensionLevel` in `HouseRules` sets the ascension difficulty for all players in a multiplayer run. Default is 0 (no ascension). Host-only control in the lobby Settings panel, rendered under "Quiz Difficulty" in the House Rules section. The host's maximum selectable level is `max(trivia.highestUnlockedLevel, study.highestUnlockedLevel)` across both personal tracks. `DEFAULT_HOUSE_RULES.ascensionLevel = 0` in `src/data/multiplayerTypes.ts`.

---

## Messages

| Message | Sender | Payload | Purpose |
|---------|--------|---------|---------|
| `mp:coop:enemy_state` | Host | `SharedEnemySnapshot` | Initial anchor at encounter start + authoritative state after each turn merge |
| `mp:coop:turn_end_with_delta` | Any client | `{ playerId, delta: EnemyTurnDelta }` | Per-player turn-end signal with damage delta |
| `mp:coop:turn_end` | Any client | `{ playerId }` | Legacy barrier signal (still active, used internally) |
| `mp:coop:turn_end_cancel` | Any client | `{ playerId }` | Cancel a pending turn-end signal |
| `mp:coop:partner_state` | Any client | `PartnerState` | Partner HP/block/score for HUD after enemy phase |

### Lobby Message Type Mapping

The client outbound type and server broadcast type for player-join events differ:

| Direction | Message type | Notes |
|-----------|-------------|-------|
| Client → Server (outbound join intent) | `mp:lobby:join` | Sent when the client initiates a join via the lobby service |
| Server → All clients (broadcast) | `mp:lobby:player_joined` | What the server broadcasts when a player successfully joins |

**This is a known gotcha.** The client listens for `mp:lobby:player_joined` (not `mp:lobby:join`) to learn about new players entering the lobby. Confusing these two names causes the host's player list to never update. See `docs/gotchas.md` 2026-04-13.

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

### Steam Backend — Async-Callback Polling for createLobby / joinLobby (2026-04-20)

Steamworks lobby creation and join operations are **two-phase**: the Rust Tauri command returns immediately (with an empty string or `()`) and the actual result arrives later via a Steamworks callback after `steam_run_callbacks` is pumped.

The Rust side stores the callback result in a `Mutex<Option<u64>>` slot:
- `steam_create_lobby` → callback stores result in `SteamState::pending_lobby_id`
- `steam_join_lobby` → callback stores result in `SteamState::pending_join_lobby_id`

JavaScript retrieves these via one-shot consuming reads:
- `steam_get_pending_lobby_id` — returns `string | null`, clears the slot on read
- `steam_get_pending_join_lobby_id` — same pattern

`steamNetworkingService.ts` bridges this with the internal `pollPendingResult(pendingCmd, timeoutMs, intervalMs)` helper:

```
1. Kick off the Tauri command (returns immediately)
2. Loop until deadline (5 s default):
   a. await tauriInvoke('steam_run_callbacks')   // pump Steamworks callbacks
   b. await tauriInvoke(pendingCmd)              // check if callback has fired
   c. if result is non-null, return it
   d. await sleep(100ms)
3. Return null on timeout
```

`createSteamLobby` and `joinSteamLobby` both use this pattern. They resolve when the callback fires — not at IPC call time. If the Steam client is not running or the lobby creation fails, they return `null` / `false` after the 5 s timeout.

**Why this matters:** The old implementation of `createSteamLobby` returned the empty string from the Tauri command directly. The `steamBackend.createLobby` caller in `multiplayerLobbyService.ts` checked `if (!lobbyId) throw ...` — so every Steam lobby creation silently threw, the UI caught it and did nothing, and the player saw the "Create Lobby" button do nothing.

### Steam Backend — pickBackend() Live Tauri Detection (2026-04-20)

`pickBackend()` in `multiplayerLobbyService.ts` no longer relies solely on the module-load-time `hasSteam` constant imported from `platformService.ts`. Instead it performs a live call-time check against both Tauri v2 globals (`__TAURI_INTERNALS__` and `__TAURI__`) at the moment the function executes.

This addresses a packaging-order issue seen in the shipped Windows Steam build: the `hasSteam` IIFE in `platformService.ts` evaluates when the module bundle is first parsed, but Tauri's global injection may land slightly later. If that race is lost, `hasSteam` stays `false` for the session — `pickBackend()` returns `webBackend` and the "Create Lobby" error banner fires instantly (the `fetch` to `http://localhost:3000` fails immediately, no 5 s delay).

The `hasSteam` import is retained in the diagnostic `console.log` so DevTools can show whether the static snapshot was stale vs. the live check. The open question: whether inlining the live check is sufficient, or whether the injection race also affects other callers that depend on the cached `hasSteam` value.

### Web Backend — Fastify Registry

`mpLobbyRegistry.ts` maintains an in-memory `Map<lobbyId, MpLobby>`. Key properties:

- **In-memory only** — a server restart drops all lobbies. This is documented and accepted for V1 (matches Among Us / L4D lifecycle). SQLite persistence is a deferred follow-up.
- **10-minute TTL** — `pruneStale()` runs every 60 s and drops lobbies with `lastActivity < Date.now() - 10 min`. All sockets are closed before deletion.
- **Password convention** — client hashes the raw password with SHA-256 before sending. Server stores and compares the hash only. `timingSafeEqual` prevents timing-oracle attacks. This is a UX gate, not a crypto auth boundary.
- **Friends-only degradation** — `friends_only` lobbies are excluded from `GET /mp/lobbies` because the web backend has no friends graph. On Steam, `SteamLobbyType::FriendsOnly` is used natively. On web, friends-only lobbies are code-join only (no browser entry).
- **CORS_ORIGIN for Docker testing** — The Fastify server reads `CORS_ORIGIN` env var to allow cross-origin WS upgrades. When running two Docker containers against a host-machine Fastify instance, set `CORS_ORIGIN=http://host.docker.internal:5173`. Without this, WS connections fail at the HTTP upgrade step with no visible client error.

### Server Snapshot Player Shape

When the server broadcasts a lobby snapshot (on join, ready-state change, or settings change), each entry in the `players` array has this shape:

```typescript
{
  id: string;          // canonical player identifier (NOT playerId — that was a bug, fixed 2026-04-13)
  displayName: string;
  isHost: boolean;
  isReady: boolean;
}
```

**Gotcha:** Early versions of the server snapshot used `playerId` instead of `id`. The client's `readyMap` lookups key on `player.id`. Using `player.playerId` silently returns `undefined` for every player — all players appear not-ready. See `docs/gotchas.md` 2026-04-13.

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
CORS_ORIGIN=http://localhost:5173            # Fastify CORS allow-origin (set to Docker bridge for container testing)
```

---

## Phase 6/8 — Unified LobbyBackend abstraction (2026-04-11)

**Source file:** `src/services/multiplayerLobbyService.ts`

### New public API surface

| Export | Signature | Description |
|--------|-----------|-------------|
| `createLobby` | `async (playerId, displayName, mode, opts?)` | Host creates a lobby via the active backend. Now async. `opts.password` is SHA-256 hashed client-side. |
| `joinLobby` | `async (lobbyCode, playerId, displayName, password?)` | Join by invite code. Now async; hashes password and resolves code via backend. **Throws `"Lobby not found. Check the code and try again."` if `resolveByCode` returns null and the backend is not BroadcastChannel.** BroadcastChannel mode uses the code directly as the channel key (returns null intentionally) — that path does not throw. |
| `joinLobbyById` | `async (lobbyId, playerId, displayName, password?)` | Join directly by backend lobby ID (used by the browser screen). On 404 the thrown error message reads `"Lobby not found or has ended."` (user-friendly). |
| `setVisibility` | `(visibility: LobbyVisibility)` | Host-only. Co-updates `visibility` and `hasPassword` atomically. |
| `setPassword` | `async (password: string \| null)` | Host-only. Hashes plaintext, stores in `_passwordHash`. Clears if null. |
| `setMaxPlayers` | `(n: number)` | Host-only. Clamped to `[MODE_MIN_PLAYERS[mode], MODE_MAX_PLAYERS[mode]]`. |
| `listPublicLobbies` | `async (filter?)` | Delegates to active backend. Returns `LobbyBrowserEntry[]`. |

### Defensive Cleanup — `leaveLobby()` and Navigation Hooks

`leaveLobby()` wraps all transport operations in `try/catch`. Navigation-triggered cleanup must not throw — a failed disconnect should be logged and ignored, not surfaced to the player.

`CardApp.svelte` has a `$effect` that watches `currentScreen`. When the screen changes away from any MP screen (`multiplayerMenu`, `multiplayerLobby`, `multiplayerGame`, `raceResults`, `lobbyBrowser`), it calls `leaveLobby()` automatically. This prevents orphaned server-side lobby entries when a player presses Back or navigates away without explicitly clicking Leave.

### `LobbyBackend` interface

```typescript
interface LobbyBackend {
  createLobby(opts: CreateLobbyBackendOpts): Promise<{ lobbyId, lobbyCode, joinToken? }>;
  resolveByCode(code: string): Promise<string | null>;
  joinLobbyById(lobbyId, playerId, displayName, passwordHash?): Promise<JoinLobbyResult>;
  listPublicLobbies(filter?): Promise<LobbyBrowserEntry[]>;
}
```

`pickBackend()` selects: `broadcastBackend` → `webBackend` (LAN mode) → `steamBackend` → `webBackend` (default) (priority order). `?mp` is an explicit dev opt-in and therefore beats auto-detected Steam so devs running a Steam build can two-tab test the broadcast path without fighting the factory.

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
| 2 | `isLanMode()` — `rr-lan-server` key in `localStorage` | `webBackend` | LAN mode (set via `setLanServerUrl()`); routes to the stored Fastify host/port. Bypasses Steam P2P even on Steam builds. |
| 3 | `hasSteam === true` | `steamBackend` | Tauri + Steam build; uses Steamworks matchmaking + P2P |
| 4 | (default) | `webBackend` | Web / mobile / CI; uses Fastify REST + WebSocket |

`hasSteam` is the existing Steam availability check from `steamService.ts`. `isBroadcastMode()` checks `new URLSearchParams(window.location.search).has('mp')`. The `?mp`-first order is load-bearing: a dev running a Steam build with `?mp` in the URL expects broadcast-mode two-tab testing, not Steam auto-routing — see commit `cc2e5b8bc`.

### Lobby Visibility — Tri-State

`LobbyVisibility` is `'public' | 'password' | 'friends_only'`. Behavior per state:

| Visibility | Steam behavior | Web/Broadcast behavior |
|------------|---------------|------------------------|
| `public` | `SteamLobbyType::Public`; appears in `steam_request_lobby_list` results | `GET /mp/lobbies` returns the entry; no icon |
| `password` | `SteamLobbyType::Public` + `password_hash` in lobby metadata; appears in list with 🔒 icon | Listed by `GET /mp/lobbies`; join validates hash; 🔒 icon |
| `friends_only` | `SteamLobbyType::FriendsOnly`; Steam handles native friends-graph filter | **Excluded from browser list** — no friends graph on web/broadcast; code-join only; tooltip explains |

**Degradation note:** `friends_only` on web degrades to "hidden from the lobby browser" (effectively code-join only). Steam friends can still receive a direct invite link. The lobby creation UI disables the Friends Only option on non-Steam builds with a tooltip: "Steam only — invite friends via code instead."

---


## LAN Config Service (2026-04-15)

**Source file:** `src/services/lanConfigService.ts`

Allows players (or devs) to point the game at a LAN Fastify MP server at runtime without requiring a build-time env variable. Useful for Windows VM builds, LAN parties, and local network testing where `VITE_MP_WS_URL`/`VITE_MP_API_URL` can't be set.

### API

| Export | Signature | Description |
|--------|-----------|-------------|
| `setLanServerUrl` | `(host: string, port: number) → void` | Persist LAN config to `localStorage['rr-lan-server']`. Strips scheme/trailing-slash from host. |
| `getLanServerUrls` | `() → LanServerConfig \| null` | Return current LAN config, or null when not in LAN mode. |
| `clearLanServerUrl` | `() → void` | Remove LAN config; revert to normal mode. |
| `isLanMode` | `() → boolean` | True when a LAN config is stored. |

### LanServerConfig shape

```typescript
interface LanServerConfig {
  wsUrl: string;   // e.g. 'ws://192.168.1.5:19738/mp/ws'
  apiUrl: string;  // e.g. 'http://192.168.1.5:19738'
}
```

### Effect on transport and lobby selection

When `isLanMode()` is true:
- `createTransport()` returns `WebSocketTransport` even on Steam builds (skips `SteamP2PTransport`).
- `WebSocketTransport.connect()` uses `getLanServerUrls().wsUrl` instead of `VITE_MP_WS_URL`.
- `pickBackend()` returns `webBackend` instead of `steamBackend`.
- `getWebApiBaseUrl()` returns `getLanServerUrls().apiUrl` instead of `VITE_MP_API_URL`.

This gives LAN mode priority slot 2 in `pickBackend()` — after broadcast but before Steam — so it takes effect even on Tauri/Steam desktop builds.

---

## LAN Co-op System (2026-04-15)

**Source files:** `src-tauri/src/lan.rs`, `src/services/lanServerService.ts`, `src/services/lanDiscoveryService.ts`, `src/services/lanConfigService.ts`, `server/src/lan-server.ts`, `src/ui/components/MultiplayerMenu.svelte`

### Overview

LAN co-op lets players on the same local network host and join multiplayer games without Steam or an external server. Two implementations exist:

| Server | Platform | How to run |
|--------|----------|------------|
| **Embedded Rust relay** (`lan.rs`) | Tauri desktop | "Start LAN Server" button in game UI → `lan_start_server` Tauri command |
| **Node.js LAN server** (`lan-server.ts`) | Any platform with Node | `cd server && npm run lan` |

Both are API-compatible with the existing `/mp/*` endpoints — the client code works unchanged.

### Embedded Rust Server (`src-tauri/src/lan.rs`)

An axum-based HTTP + WebSocket server running inside the Tauri process on a tokio task.

- **Port:** 19738 (default), configurable via `lan_start_server` command
- **Lobby registry:** In-memory `Arc<RwLock<HashMap>>`, same lifecycle as the Fastify registry
- **Stale pruning:** 60s interval, 10-minute TTL
- **Password:** Constant-time comparison of SHA-256 hex hashes
- **CORS:** All origins allowed (LAN-only, no auth boundary)

**Tauri commands:**

| Command | Args | Returns | Description |
|---------|------|---------|-------------|
| `lan_start_server` | `port?: u16` | `{ port, localIps }` | Start server on `0.0.0.0:port` |
| `lan_stop_server` | — | `()` | Graceful shutdown via oneshot channel |
| `lan_get_local_ips` | — | `string[]` | Non-loopback IPv4 addresses |
| `lan_server_status` | — | `{ running, port }` | Current state |

### `lanServerService.ts` — Live Tauri Detection (2026-04-20)

`lanServerService.ts` previously used the module-load-time `isDesktop` constant from `platformService.ts` to gate all Tauri `invoke` calls. This suffered the same packaging-order race documented in the `pickBackend()` section above: if `__TAURI_INTERNALS__` lands after the bundle evaluates, `isDesktop` stays `false` and every `tauriInvoke` returns `null` instantly — causing the "Start LAN Server" button to show "Starting…" indefinitely (the null result is silently dropped by the UI, which never transitions out of the loading state).

**Fix:** `lanServerService.ts` now uses a local `isTauriRuntime()` function (live check of `window.__TAURI_INTERNALS__ || window.__TAURI__`) identical to the pattern in `steamNetworkingService.ts`. The `isDesktop` import was removed. A 10-second timeout (`LAN_START_TIMEOUT_MS = 10_000`) was also added to `startLanServer()` so a Rust-side tokio hang does not block the UI indefinitely. On timeout, `null` is returned and the caller's existing error path fires.

### LAN Discovery (`lanDiscoveryService.ts`)

HTTP-based subnet scanner. Probes `GET /mp/discover` on port 19738 across /24 subnets.

- **Subnet detection:** Tauri `lan_get_local_ips` → extract /24 prefix. Fallback: `192.168.0`, `192.168.1`, `10.0.0`, `10.0.1`.
- **Batching:** 50 concurrent probes, 400ms timeout each.
- **Validation:** Response must contain `{ game: "recall-rogue" }`.

### UI Flow

The MultiplayerMenu has three tabs: "Create Lobby", "Join Lobby", "LAN Play".

LAN Play tab:
1. **Host section** (desktop only): Start/Stop server, shows IP + port
2. **Join section** (all platforms): Auto-scan results, manual IP entry, connect/disconnect
3. After connecting → `setLanServerUrl()` → normal lobby flow (Browse/Create)

---

## Bot Feature — Removed from UI (2026-04-13)

The "Add Bot" button was removed from the lobby UI in commit `74fad47`. Bot-related exports remain in `multiplayerLobbyService.ts` at the service layer for potential future use, but no UI surface exposes them. All multiplayer testing should use two real containers (or two browser tabs in broadcast mode) rather than bots.

**Reason:** Bot players do not participate in map node consensus barriers, causing encounter start to deadlock. See `docs/gotchas.md` 2026-04-13 "Map node consensus blocks both players when one is a bot."
