# Multiplayer Architecture

> **Source files:** `src/services/multiplayerCoopSync.ts`, `src/services/multiplayerLobbyService.ts`, `src/services/multiplayerTransport.ts`, `src/services/multiplayerGameService.ts`, `src/services/multiplayerElo.ts`, `src/services/multiplayerWorkshopService.ts`, `src/data/multiplayerTypes.ts`, `src/services/enemyManager.ts`, `src/services/encounterBridge.ts`
> **Last verified:** 2026-04-21 — Hardening wave (co-op barrier, duel protocol, reconnect/presence, ranked Elo, workshop gate, seed-ACK)

---

## E2E Verification Status (2026-04-13)

All five multiplayer modes tested end-to-end in batch MP-20260413-003941 using two real Docker containers connected via Fastify `webBackend`. Both containers were full WebSocket clients — no bots.

| Mode | Result | Notes |
|------|--------|-------|
| Race Mode | PASS | Lobby → combat → multiple turns |
| Same Cards | PASS | Lobby → combat → 3 turns each |
| Knowledge Duel | PASS | Lobby → combat → 2 turns each |
| Co-op | PASS | Lobby → combat → 8+ turns, 2 enemies |
| Trivia Night | PASS | Lobby → combat → 1 turn |

**Seed sync verified:** Both players see identical enemy (Eraser Worm 28/28), identical hand (Strike, Block, Transmute, Strike, Block), and identical map (25 nodes).

---

## Co-op Mode — Shared Enemy (Authoritative HP)

Both players fight **one shared enemy** with scaled HP. The host is authoritative — HP changes are merged and broadcast at end-of-turn. Each client applies damage optimistically during their turn; the host reconciles and both clients converge.

### HP Scaling

`getCoopHpMultiplier(playerCount)` in `enemyManager.ts` — sublinear curve:
- 1 player: 1.0× / 2 players: 1.6× / 3 players: 2.2× / 4 players: 2.3× (capped)

Applied once at `createEnemy()`. Do not apply twice.

### Canary System — Disabled in Coop

`canaryEnemyDamageMultiplier` forced to `1.0` in co-op (gate in `encounterBridge.ts`). `canary.enemyHpMultiplier` excluded from `enemyHpMultiplier` computation — co-op HP scaling handled entirely by `getCoopHpMultiplier()`.

---

## Encounter Start Sync

```
Host                                    Non-host
----                                    --------
createEnemy(template, floor, opts)
broadcastSharedEnemyState(snapshot)  →  awaitCoopEnemyReconcile()
                                        hydrateEnemyFromSnapshot(enemy, snapshot)
activeTurnState.set(...)                activeTurnState.set(...)
[combat visible to both]
```

Both clients capture `_coopPreTurnEnemySnapshot = snapshotEnemy(enemy)` at encounter start. This is the baseline for delta computation on turn 1.

---

## Turn Flow — Co-op Barrier Checkpoint

```
Both clients (simultaneous turns)
   Player plays cards against local enemy copy
   [mid-turn: P1 sees 150 HP, P2 sees 152 HP — acceptable cosmetic drift]

Player ends turn → handleEndTurn()
   Compute delta: { damageDealt, blockDealt, statusEffectsAdded }
   awaitCoopTurnEndWithDelta(delta)  ← BARRIER: waits for ALL players
                                        45s hard timeout; resolves 'cancelled' on
                                        transport disconnect or peer leaving lobby

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

`EnemyTurnDelta` fields:
- `damageDealt` = `preTurnSnapshot.currentHP - enemy.currentHP`
- `blockDealt` = `preTurnSnapshot.block - enemy.block`
- `statusEffectsAdded` = status effects not present in pre-turn snapshot

### Merge Function

`applyEnemyDeltaToState(snapshot, deltas, phaseTransitionAt?)` in `enemyManager.ts` is a **pure function** that:
1. Sorts deltas by `playerId` for deterministic order
2. Applies `blockDealt` to strip block
3. Applies `damageDealt` to HP (clamped at 0)
4. Merges `statusEffectsAdded` (sums magnitudes for duplicates)
5. Checks phase transition
6. Returns a new `SharedEnemySnapshot` without mutating input

---

## Knowledge Duel Protocol

**Source file:** `src/services/multiplayerGameService.ts`

Both players fight a shared enemy simultaneously. The host is authoritative for enemy state; damage is attributed per player.

### Setup

```typescript
// Host calls once per encounter
hostCreateSharedEnemy(templateId: string, floor: number, playerCount: number): void
// → creates enemy via enemyManager.createEnemy, broadcasts mp:duel:enemy_state
```

### Turn Cycle

1. Host sends `mp:duel:turn_start { turnNumber }` — both players begin playing cards independently.
2. Each player submits via `submitDuelTurnAction(action: DuelTurnAction)`:
   ```typescript
   interface DuelTurnAction {
     playerId: string;
     damageDealt: number;   // clamped to Math.max(0, ...) on receive (M10)
     blockGained: number;   // clamped to Math.max(0, ...) on receive (M10)
     cardId: string;
   }
   ```
3. Host collects both actions; `hostResolveTurn(actions[])` fires when the second arrives.
4. `hostResolveTurn()` — host-authoritative resolution:
   - Applies combined damage to shared enemy HP
   - Rotates target (round-robin between players for enemy attacks)
   - Broadcasts `mp:duel:turn_resolve` with full state delta + per-player damage attribution
   - If enemy HP ≤ 0 or either player HP ≤ 0: broadcasts `mp:duel:end`
5. Non-host applies received resolution via `applyDuelTurnResolution()`.

### Both-Defeated Outcome

When both players reach 0 HP in the same turn resolution:
- `DuelTurnResolution.winnerId = null`
- `DuelTurnResolution.reason = 'both_defeated'`
- Result consumers must treat `null` winnerId as a tie (no Elo delta when ratings are equal).

### Duel vs. Co-op Differences

| Aspect | Knowledge Duel | Co-op |
|--------|---------------|-------|
| Turn structure | Simultaneous submission | Simultaneous play + barrier |
| Reconciliation | Full `DuelTurnAction` per player | Delta-based merge |
| Enemy attacks | Round-robin target rotation | All players take full damage |

---

## Reconnect + Presence

**Source files:** `src/services/multiplayerTransport.ts`, `src/services/multiplayerLobbyService.ts`

### Peer Presence Monitor

`initPeerPresenceMonitor(localId, getPeerIds, transport)` — called after lobby join on both host and non-host.

- Every **15s**: sends `mp:ping` to all known peers.
- Each peer replies with `mp:pong` (wired automatically by `initPeerPresenceMonitor`'s handler).
- If no `mp:pong` received within **30s** of the last ping: emits `mp:lobby:peer_left { playerId }` locally.

The 30s pong timeout is intentionally > 15s interval to allow one missed pong before firing.

### Lobby-Service Grace Period (H10)

When `mp:lobby:peer_left` fires, `multiplayerLobbyService.ts` marks the player as `connectionState: 'reconnecting'` rather than removing them immediately. A **60-second grace timer** starts. If the player sends `mp:lobby:peer_rejoined` within the window, `connectionState` resets to `'connected'`. If the timer expires and `connectionState` is still `'reconnecting'`, the player is removed from the lobby.

### Co-op Barrier — Disconnect Handling (C3)

`awaitCoopTurnEndWithDelta(delta)` also watches `_currentLobby.players.length`. If it drops below the expected count mid-barrier, the barrier resolves `'cancelled'` immediately. The **45s hard timeout** is a separate backstop for cases where the disconnect is not signaled via lobby state.

### Steam P2P Session Recovery (H9)

After a network interruption on Steam P2P, use `reestablishSteamP2PSession(transport, lobbyId, peerSteamId, localSteamId)` in `multiplayerTransport.ts`. This:
1. Calls `steam_accept_p2p_session` on the peer's Steam ID.
2. Verifies the peer is still in the lobby before attempting.
3. Returns `false` (logs warn) if the peer has left or if IPC fails.

---

## Ranked Mode + Elo

**Source file:** `src/services/multiplayerElo.ts`

### Constants

| Constant | Value | Notes |
|----------|-------|-------|
| `DEFAULT_RATING` | 1500 | Starting rating for all new profiles |
| `K_FACTOR` | 32 | Fixed for v1; differs from `eloMatchmakingService.ts` (K=32/16 split) |

### Persistence

- `PlayerProfile.multiplayerRating?: number` — stored and loaded via `profileService`.
- `LobbyPlayer.multiplayerRating?: number` — broadcast in lobby player records so each player knows the opponent's rating at match end.
- `HouseRules.isRanked: boolean` — host-only toggle; default `false`.

### Application

`applyEloResult(localRating, oppRating, outcome)` fires at:
- **Race end** — inside `_tryEmitRaceResults()` when `lobby.isRanked === true`.
- **Duel end** — in `hostResolveTurn()` (host) and on `mp:duel:end` receipt (non-host).

Opponent rating is read from `lobby.players.find(p => p.id === opponentId)?.multiplayerRating ?? 1500` — graceful fallback when the rating is absent.

**Tie behavior:** When both players have identical ratings, a tie produces 0 Elo delta. At a skill gap, the winning underdog gains `K * (1 - expected)` and the losing favorite loses the mirror.

---

## Workshop Deck Gate

**Source file:** `src/services/multiplayerWorkshopService.ts`

Before a match starts with a Workshop deck, the host verifies all players have the deck installed.

1. Host sends `mp:workshop:deck_check { workshopItemId, requestId }` to all peers.
2. Each non-host client responds with `mp:workshop:deck_check_ack { requestId, playerId, installed: boolean }`.
3. Host pre-populates its own entry as `installed: true` (never sends to itself).
4. If any player responds `installed: false`, the host can block game start and prompt the missing player.

The `requestId` is a UUID per check round — prevents stale ACKs from a prior check resolving a new one.

---

## Messages

### Co-op Messages

| Message | Sender | Payload | Purpose |
|---------|--------|---------|---------|
| `mp:coop:enemy_state` | Host | `SharedEnemySnapshot` | Initial anchor + authoritative state after each turn merge |
| `mp:coop:turn_end_with_delta` | Any client | `{ playerId, delta: EnemyTurnDelta }` | Per-player turn-end signal with damage delta |
| `mp:coop:turn_end` | Any client | `{ playerId }` | Legacy barrier signal (still active, used internally) |
| `mp:coop:turn_end_cancel` | Any client | `{ playerId }` | Cancel a pending turn-end signal |
| `mp:coop:partner_state` | Any client | `PartnerState` | Partner HP/block/score for HUD after enemy phase |
| `mp:coop:player_died` | Any client | `{ playerId }` | Broadcast when a player's HP reaches 0 mid-encounter |

### Duel Messages

| Message | Sender | Payload | Purpose |
|---------|--------|---------|---------|
| `mp:duel:turn_start` | Host | `{ turnNumber }` | Begin new turn; both players start playing |
| `mp:duel:cards_played` | Any client | `DuelTurnAction` | Submit turn action (damage + block); host resolves when both arrive |
| `mp:duel:turn_resolve` | Host | `DuelTurnResolution` | Authoritative state delta for non-host |
| `mp:duel:enemy_state` | Host | `SharedEnemySnapshot` | Enemy state broadcast after resolution |
| `mp:duel:end` | Host | `DuelTurnResolution` | Match over (enemy defeated, player defeated, or both_defeated) |

### Lobby + Presence Messages

| Message | Sender | Payload | Purpose |
|---------|--------|---------|---------|
| `mp:lobby:peer_left` | Transport / local | `{ playerId }` | Peer pong timeout or transport disconnect |
| `mp:lobby:peer_rejoined` | Transport | `{ playerId }` | Peer reconnected within grace window |
| `mp:lobby:start_ack` | Non-host | `{ playerId }` | Guest ACKs `mp:lobby:start` seed receipt |

### Workshop Messages

| Message | Sender | Payload | Purpose |
|---------|--------|---------|---------|
| `mp:workshop:deck_check` | Host | `{ workshopItemId, requestId }` | Ask all clients if Workshop deck is installed |
| `mp:workshop:deck_check_ack` | Non-host | `{ requestId, playerId, installed }` | Client responds with install status |

### Lobby Message Type Mapping (gotcha)

| Direction | Message type | Notes |
|-----------|-------------|-------|
| Client → Server (join intent) | `mp:lobby:join` | Sent when client initiates a join |
| Server → All (broadcast) | `mp:lobby:player_joined` | What server broadcasts on successful join |

Confusing these two causes the host's player list to never update. See `docs/gotchas.md` 2026-04-13.

---

## Lobby Start — Seed-ACK Handshake (H5)

When the host clicks Start, `multiplayerLobbyService.ts` does not fire `onGameStart` immediately. Instead:

1. Host sends `mp:lobby:start` with the shared seed.
2. Each non-host guest ACKs with `mp:lobby:start_ack { playerId }`.
3. Host retries `mp:lobby:start` every **750ms** for up to **3s** for any guest that hasn't ACKed.
4. After 3s, `onGameStart` fires regardless (logs a warning for any remaining unACKed guests).

This ensures all clients have received and processed the seed before the host's `onGameStart` callback triggers match initialization.

---

## Key Types

```typescript
// src/data/multiplayerTypes.ts

interface SharedEnemySnapshot {
  currentHP: number; maxHP: number; block: number
  phase: 1 | 2; nextIntent: EnemyIntent; statusEffects: StatusEffect[]
}

interface EnemyTurnDelta {
  playerId: string
  damageDealt: number   // post-block, pre-clamp
  blockDealt: number    // block stripped from enemy
  statusEffectsAdded: StatusEffect[]
}

interface DuelTurnAction {
  playerId: string; damageDealt: number; blockGained: number; cardId: string
}

interface HouseRules {
  turnTimerSecs: number          // 20 | 45 | 90
  quizDifficulty: 'adaptive' | 'easy' | 'hard'
  fairness: FairnessOptions
  ascensionLevel: number         // 0 = off, 1-20 ascension for the run
  isRanked: boolean              // enables Elo delta at match end
}

interface LobbyPlayer {
  id: string; displayName: string; isHost: boolean; isReady: boolean
  multiplayerRating?: number     // broadcast so opponent rating known at match end
}
```

---

## Helper Functions

### `enemyManager.ts`

| Function | Description |
|----------|-------------|
| `snapshotEnemy(enemy)` | Extract `SharedEnemySnapshot` from a live `EnemyInstance` |
| `hydrateEnemyFromSnapshot(enemy, snapshot)` | Overwrite mutable fields from snapshot |
| `applyEnemyDeltaToState(snapshot, deltas, phaseAt?)` | Pure merge: apply deltas → new snapshot |

### `multiplayerCoopSync.ts`

| Function | Description |
|----------|-------------|
| `broadcastSharedEnemyState(snapshot)` | Host sends `mp:coop:enemy_state` |
| `onSharedEnemyState(cb)` | Subscribe to incoming enemy state broadcasts |
| `awaitCoopTurnEndWithDelta(delta)` | Barrier + delta send; resolves when all players signal |
| `getCollectedDeltas()` | All deltas for current barrier, sorted by playerId |
| `awaitCoopEnemyReconcile()` | One-shot Promise resolving on next `mp:coop:enemy_state` |

### `multiplayerGameService.ts` (Duel)

| Function | Description |
|----------|-------------|
| `hostCreateSharedEnemy(templateId, floor, playerCount)` | Host creates and broadcasts shared enemy |
| `submitDuelTurnAction(action)` | Submit turn damage/block; triggers host resolve when both arrive |
| `hostResolveTurn()` | Host-authoritative: applies damage, rotates target, broadcasts resolution |
| `initDuelMode(localPlayerId, isHost)` | Must be called before `hostCreateSharedEnemy` or `submitDuelTurnAction` |
| `initRaceMode(localPlayerId)` | Called at race-encounter start; sets local player ID for race result tracking |

### `multiplayerTransport.ts`

| Function | Description |
|----------|-------------|
| `initPeerPresenceMonitor(localId, getPeerIds, transport)` | 15s ping / 30s pong timeout → emits `mp:lobby:peer_left` |
| `reestablishSteamP2PSession(transport, lobbyId, peerSteamId, localSteamId)` | Steam P2P session recovery after interruption |

---

## Enemy Intent Determinism

Enemy intents are deterministic via a **seeded RNG fork** named `enemy-intent`:
- Both host and non-host call `getRunRng('enemyIntents')` in the same sequence → identical intents.
- Host is still authoritative: after barrier, rolls via `rollNextIntent`, broadcasts in `SharedEnemySnapshot.nextIntent`.
- Non-host drift detection: before `hydrateEnemyFromSnapshot`, rolls locally and compares. Mismatch → `console.warn('[coop-sync] intent drift')`. Host value adopted regardless.

---

## Known Acceptable Drift

During a turn, P1 and P2 may see different enemy HP (each sees only their own damage applied). This resolves at end-of-turn when the host broadcasts the merged state. If one player overkills the enemy locally, the encounter ends on both clients once the host's merged state shows HP ≤ 0.

---

## Three-Backend Architecture

`multiplayerLobbyService.ts` routes discovery/create/join through a `lobbyBackend` abstraction:

| Backend | Transport | Discovery | Scope |
|---------|-----------|-----------|-------|
| `steamBackend` | Steam P2P + Steamworks | `steam_request_lobby_list` → metadata loop | Steam builds |
| `webBackend` | Fastify REST + WebSocket | `GET /mp/lobbies` | Web / mobile / CI |
| `broadcastBackend` | BroadcastChannel + `localStorage` | `localStorage['rr-mp:directory']` | Dev two-tab mode |

### Backend Selection (`pickBackend()`)

| Priority | Condition | Backend | Notes |
|----------|-----------|---------|-------|
| 1 | `isBroadcastMode()` — URL has `?mp` | `broadcastBackend` | Explicit opt-in beats auto-detected Steam |
| 2 | `isLanMode()` — `rr-lan-server` in localStorage | `webBackend` | LAN mode overrides Steam |
| 3 | `isTauriRuntime()` (live check) | `steamBackend` | Tauri + Steam builds |
| 4 | (default) | `webBackend` | Web / mobile / CI |

`pickBackend()` uses a live `isTauriRuntime()` check (not the module-load-time `hasSteam` constant) to avoid a packaging-order race on Steam builds. See `docs/gotchas.md` 2026-04-20 "Tauri v2 platform detection."

---

## Fastify Web Backend

**Source files:** `server/src/services/mpLobbyRegistry.ts`, `server/src/routes/mpLobby.ts`, `server/src/routes/mpLobbyWs.ts`

- **In-memory** — server restart drops all lobbies (accepted for V1).
- **10-minute TTL** — `pruneStale()` runs every 60s.
- **Password** — client SHA-256 hashes before sending; server uses `timingSafeEqual`.
- **CORS** — `CORS_ORIGIN` env var. Default covers `localhost:5173`, `127.0.0.1:5173`, and `host.docker.internal:5173`. Extend for Docker multi-container playtests.

### REST Routes (under `/mp` prefix)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/mp/lobbies` | Create lobby → `{ lobbyId, lobbyCode, joinToken }` |
| `GET` | `/mp/lobbies` | List public + password lobbies |
| `GET` | `/mp/lobbies/code/:code` | Resolve 6-char code → lobby info |
| `POST` | `/mp/lobbies/:id/join` | Join → `joinToken` for WS upgrade |
| `POST` | `/mp/lobbies/:id/leave` | REST leave |

### WebSocket Protocol (`/mp/ws?lobbyId=&playerId=&token=`)

Server validates `joinToken`, sends `mp:lobby:settings` snapshot, then routes:
- `mp:lobby:ready` — rebroadcast
- `mp:lobby:leave` — `leaveLobby()` + close
- `mp:lobby:settings` — host-only; patch + rebroadcast
- `mp:lobby:start` — host-only; `status=in_game` + broadcast
- `mp:race:*`, `mp:coop:*`, `mp:duel:*`, `mp:trivia:*` — forwarded verbatim

### Server Snapshot Player Shape

```typescript
{ id: string; displayName: string; isHost: boolean; isReady: boolean }
```

Early versions used `playerId` instead of `id` — caused all ready-state lookups to return `undefined`. See `docs/gotchas.md` 2026-04-13.

### Lobby Code Alphabet

Both client and server use exactly: `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no I, O, 0, 1). 6 characters, uppercase.

---

## LAN Config Service

**Source file:** `src/services/lanConfigService.ts`

Allows runtime pointing to a LAN Fastify server without a build-time env var.

| Export | Description |
|--------|-------------|
| `setLanServerUrl(host, port)` | Persist LAN config to `localStorage['rr-lan-server']` |
| `getLanServerUrls()` | `LanServerConfig \| null` |
| `clearLanServerUrl()` | Remove; revert to normal mode |
| `isLanMode()` | True when LAN config is stored |

When `isLanMode()` is true: `createTransport()` returns `WebSocketTransport` even on Steam builds; `pickBackend()` returns `webBackend`.

---

## LAN Co-op System

**Source files:** `src-tauri/src/lan.rs`, `src/services/lanServerService.ts`, `src/services/lanDiscoveryService.ts`

Two API-compatible server implementations:

| Server | Platform | How |
|--------|----------|-----|
| Embedded Rust relay (`lan.rs`) | Tauri desktop | "Start LAN Server" button → `lan_start_server` Tauri command |
| Node.js LAN server (`lan-server.ts`) | Any with Node | `cd server && npm run lan` |

Both expose the same `/mp/*` endpoints. Port 19738 default.

`lanServerService.ts` uses live `isTauriRuntime()` check (not stale `isDesktop`). `startLanServer()` has a 10s timeout — Rust-side hangs do not block the UI indefinitely.

---

## Player Roster Panel

For modes with `MODE_MAX_PLAYERS[mode] > 2` (`trivia_night`, `race` 3-4+):
- `MultiplayerHUD` is hidden (gated on `!isManyPlayerMode`).
- `.roster-trigger-pill` button (👥 + count) on the local HP bar opens `PlayerRosterPanel.svelte`.
- Panel shows HP/block/score/accuracy for all other players.
- Data source: `partnerStates` in `CardApp.svelte` via `onPartnerStateUpdate`.

`isManyPlayerMode` = `currentLobby.mode === 'trivia_night' || currentLobby.maxPlayers > 2`.

---

## Bot Feature — Removed from UI (2026-04-13)

"Add Bot" button removed from lobby UI (commit `74fad47`). Bot-related exports remain at the service layer. **Do not test with bots** — they do not participate in map node consensus barriers, causing encounter start to deadlock. See `docs/gotchas.md` 2026-04-13.

---

---

## Steam Join Error Surfacing (A3 — 2026-04-21)

**Source file:** `src-tauri/src/steam.rs`, `src/services/steamNetworkingService.ts`

### Problem (pre-A3)

`steam_join_lobby` returned `Ok(())` immediately. The `Err(_)` branch of the async `LobbyEnter_t` callback only wrote to stderr. The TS-side `pollPendingResult` would time out after 5s and return `null`/`false`. The actual Steam error reason (lobby full, no access, etc.) never reached the UI — players saw a generic join failure.

### Fix

1. `SteamState` has a new field `pending_join_error: Arc<Mutex<Option<String>>>`.
2. `steam_join_lobby` clears the error slot at call-start and fills it in the callback `Err(e)` branch via `format!("{:?}", e)`.
3. New Tauri command `steam_get_pending_join_error` reads and takes the error slot (one-shot).
4. `pollJoinResult` in `steamNetworkingService.ts` polls both `steam_get_pending_join_lobby_id` and `steam_get_pending_join_error` in parallel each tick. On error slot populated: throws `Error(message)`. On ID populated: resolves with lobby ID.
5. Poll timeout bumped from 5s to 10s for the join path (slow callbacks on cold lobbies).
6. `joinSteamLobby` now returns `string | null` (lobby ID) instead of `boolean` — callers that used the boolean return need updating.

### Error flow: Steam callback → UI

```
steam_join_lobby (Rust)
  → LobbyEnter_t callback Err(e)
  → pending_join_error.lock() = Some(format!("{:?}", e))

pollJoinResult (TS, every 100ms)
  → tauriInvoke('steam_get_pending_join_error') returns error string
  → throws Error(errorString)

steamBackend.joinLobbyById
  → error propagates up (no catch)

joinLobby / joinLobbyById (multiplayerLobbyService.ts)
  → error propagates up (A2 fix: no swallowing try/catch)

CardApp.svelte :650-661
  → catch block sets multiplayerError
  → UI banner shows the error
```

## CHANGELOG (abbreviated)

| Date | Commits | What |
|------|---------|------|
| 2026-04-21 | (A2–A4 fix wave) | Ghost lobby prevention (joinLobby: _currentLobby set after join), Steam join error surfacing (pending_join_error slot, pollJoinResult, 10s timeout), stale lobby filtering (currentPlayers=0, >2h), host metadata clear on leave |
| 2026-04-21 | `ec9e86626`–`60f260fe0` | Hardening wave: co-op/race/trivia/LAN + Elo/FSRS, lobby service + workshop + lobby UI, wiring + PlayerProfile schema v2, Elo wire + CORS default, final wiring (initRaceMode, opp-rating, workshop gate) |
| 2026-04-20 | `3afcf0500`, `b332c3d96`, `4a1135194`, `3faa62a95`, `b06820ea8` | Visibility toggle + roster panel, Steam lobby discovery wiring, transport + Steam C1/C2/H8/H9, roster sort + CardCombatOverlay typecheck, lobby code rejection + live Tauri check |
| 2026-04-15 | — | LAN co-op system: `lan.rs`, `lanServerService.ts`, `lanDiscoveryService.ts`, `lanConfigService.ts` |
| 2026-04-13 | — | E2E verification batch MP-20260413-003941; lobby snapshot `id` vs `playerId` fix; bot removal |
| 2026-04-11 | `cc2e5b8bc` | Phase 4: public/private lobby browsing, `lobbyBackend` abstraction, `?mp`-first backend priority |


---

## C2 — Real Steam Persona Name (2026-04-21)

**New Tauri command:** `steam_get_persona_name` in `src-tauri/src/steam.rs`.  
**Registered in:** `src-tauri/src/main.rs` invoke handler.  
**TypeScript bridge:** `getLocalPersonaName()` export in `steamNetworkingService.ts`.  
**Typed IPC entries** added to `SteamCommandArgs` (`steam_get_persona_name: Record<string, never>`) and `SteamCommandReturn` (`steam_get_persona_name: string | null`).  

`CardApp.svelte` resolves the real Steam name on `onMount` and uses it for both `handleCreateLobby` and `handleJoinLobby` instead of the former `'Player 1'` / `'Player 2'` hardcoded strings.
