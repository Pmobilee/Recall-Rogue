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

1. Host sends `mp:lobby:start` with the full lobby config payload: `{ seed, mode, deckId, houseRules, contentSelection }`.
   Guests MUST apply all fields to `_currentLobby` before firing `onGameStart` — this is the authoritative
   snapshot that covers any `mp:lobby:settings` messages that were lost on Steam P2P.
2. Each non-host guest ACKs with `mp:lobby:start_ack { playerId }`.
3. Host retries `mp:lobby:start` every **750ms** for up to **3s** for any guest that hasn't ACKed.
4. **On 3s timeout (BUG-3 fix):** if any guests still haven't ACKed, the host does NOT fire `onGameStart`.
   Instead: ghost guests (failed-to-ACK players) are removed from the player list, the lobby status
   resets to `'waiting'`, and `onLobbyError` fires with `'Could not reach all players. Returning to lobby.'`
   so the host can retry.

### Guest-side payload application order

The `mp:lobby:start` handler on the guest applies fields in this order before firing `onGameStart`:

1. `mode` — overrides stale mode from prior lobby or lost `mp:lobby:settings`
2. `deckId` → `selectedDeckId` — overrides prior deck selection
3. `houseRules` — overrides stale house rules
4. `contentSelection` — authoritative at game-start time
5. `seed` and `status = 'in_game'`

Each field is guarded with `if (payload.X !== undefined)` so a host that omits a field does not clobber valid local state. If `_currentLobby.mode` is still `undefined` after applying all fields, the handler aborts with a console error (BUG-2 defensive assertion).

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

### macOS 15 Requirements

macOS 15 (Sequoia) requires `NSLocalNetworkUsageDescription` in `Info.plist` for any app that binds a local-network socket. Without it, macOS silently refuses the permission and the `TcpListener` bind in `lan.rs` hangs — `startLanServer()` fires the 10s timeout with "LAN server start timed out after 10 seconds".

This key is now set via `bundle.macOS.infoPlist` in `src-tauri/tauri.conf.json`. It injects the description into the bundle's `Info.plist` at build time. No entitlement file changes are needed — the Info.plist key is sufficient to trigger the system permission prompt on first LAN server start.

LAN discovery uses plain HTTP subnet scanning (not mDNS/Bonjour), so `NSBonjourServices` is not required.

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
2. `steam_join_lobby` clears the error slot at call-start and fills it in the callback `Err(e)` branch. **Note:** steamworks-rs 0.12 `join_lobby` closure signature is `FnOnce(Result<LobbyId, ()>)` — the error is the unit type `()`, so the pre-A5 message was the useless string `"()"`. A5 replaces this with the raw `LobbyEnter` callback approach (see below).
3. New Tauri command `steam_get_pending_join_error` reads and takes the error slot (one-shot).
4. `pollJoinResult` in `steamNetworkingService.ts` polls both `steam_get_pending_join_lobby_id` and `steam_get_pending_join_error` in parallel each tick. On error slot populated: throws `Error(message)`. On ID populated: resolves with lobby ID.
5. Poll timeout bumped from 5s to 10s for the join path (slow callbacks on cold lobbies).
6. `joinSteamLobby` now returns `string | null` (lobby ID) instead of `boolean` — callers that used the boolean return need updating.

### Error flow: Steam callback → UI (post-A5)

```
steam_join_lobby (Rust) → kicks off join
  ↓
LobbyEnter_t fires (processed by background pump ~16ms)
  ↓ (two paths simultaneously)
  [Path 1 — raw callback (A5 — SOURCE OF TRUTH)]
    LobbyEnter.chat_room_enter_response → ChatRoomEnterResponse enum
    Mapped to human-readable string (e.g. "Lobby is full",
      "Your Steam account is Limited — spend +...")
    pending_join_error.lock() = Some(msg)

  [Path 2 — join_lobby closure (A3 fallback)]
    Result<LobbyId, ()> — error type is () (useless)
    Only writes "steam: join_lobby closure returned ()" if Path 1 didn't write first
  ↓
pollJoinResult (TS, every 100ms)
  → tauriInvoke('steam_get_pending_join_error') returns human-readable string
  → throws Error(errorString)
  ↓
steamBackend.joinLobbyById → error propagates up (no catch)
  ↓
joinLobby / joinLobbyById (multiplayerLobbyService.ts) → error propagates up (A2 fix)
  ↓
CardApp.svelte catch block → sets multiplayerError → UI banner shows the error
```

**Key codes mapped by the raw LobbyEnter callback:**

| Code | Enum | Message shown to player |
|------|------|------------------------|
| 1 | Success | (no error — join succeeded) |
| 2 | DoesntExist | Lobby no longer exists |
| 3 | NotAllowed | Lobby join not allowed |
| 4 | Full | Lobby is full |
| 5 | Error | Generic Steam error joining lobby |
| 6 | Banned | You are banned from this lobby |
| 7 | **Limited** | **Your Steam account is Limited — spend $5 or more on the Steam Store to join multiplayer lobbies** |
| 8 | ClanDisabled | Clan chat is disabled for this lobby |
| 9 | CommunityBan | A community ban prevents joining |
| 10 | MemberBlockedYou | A lobby member has blocked you |
| 11 | YouBlockedMember | You have blocked a lobby member |
| 12 | RatelimitExceeded | Steam rate limit hit — try again in a moment |

**Limited account note:** Steam accounts that have never spent $5+ on the Steam Store receive code 7 (`k_EChatRoomEnterResponseLimited`) on every lobby join. The game surfaces the exact message. There is no client-side workaround — the second test account needs a qualifying Steam purchase.

---

## Steam Join Hardening (A5 — 2026-04-21)

**Source file:** `src-tauri/src/steam.rs`, `src/services/steamNetworkingService.ts`

### Three fixes in one commit

**1. Raw `LobbyEnter` callback for real error codes**

steamworks-rs 0.12 `join_lobby` closure yields `Result<LobbyId, ()>`. The unit error type means `format!("{:?}", e)` produced the string `"()"` — useless as a diagnostic. The real `m_EChatRoomEnterResponse` value is available via the `LobbyEnter` callback type registered with `client.register_callback`. A5 registers this callback in `SteamState::new()`, maps all `ChatRoomEnterResponse` variants to human-readable strings, and writes the result to `pending_join_error`. The old `join_lobby` closure fallback still fires but only writes if the raw callback hasn't already. The raw callback handle is stored in `SteamState::_lobby_enter_callback`.

**2. Worldwide distance filter for lobby discovery**

Steam's default lobby list distance filter is `k_ELobbyDistanceFilterDefault` (nearby). Two Steam accounts on the same physical LAN but assigned to different Steam regions will NOT see each other's lobbies with the default filter. `steam_request_lobby_list` now calls `set_request_lobby_list_distance_filter(DistanceFilter::Worldwide)` before `request_lobby_list`. API confirmed in steamworks-rs 0.12 matchmaking.rs.

**3. Explicit `set_lobby_joinable(true)` after create**

Steam documents lobbies as joinable by default, but the explicit call is defensive — it costs nothing and prevents a class of silent lockout edge cases (e.g., invisible lobbies, lobbies created after permission changes). Called in the `create_lobby` callback Ok arm after storing the lobby ID, using a cloned client Arc.

**Diagnostic logging**

`joinSteamLobby` in `steamNetworkingService.ts` now logs both success and error paths to the browser console under `[steamNetworking] joinSteamLobby result`. This gives us visibility without needing a Tauri stdout tap.

---

## Steam Lobby Metadata Warm-up (Wave 12 — 2026-04-21)

**Source files:** `src-tauri/src/steam.rs`, `src/services/steamNetworkingService.ts`, `src/services/multiplayerLobbyService.ts`

### Problem

Steam's `GetLobbyData(lobbyId, key)` returns `""` for lobbies whose metadata the local Steam client has not yet cached. Lobbies discovered via `RequestLobbyList` (not created or joined by the local player) start cold — the cache is populated only after `RequestLobbyData(lobbyId)` fires and `LobbyDataUpdate_t` completes.

**Symptom:** Guest scanning via code sees lobby list entries with blank `mode`/`lobby_code`/`host_name` and skips them (or `resolveByCode` returns null for a lobby that exists).

### Fix

**New Rust command:** `steam_request_lobby_data(lobby_id: String) -> Result<bool, String>`

Calls `SteamAPI_ISteamMatchmaking_RequestLobbyData` via the `steamworks::sys` flat API. steamworks-rs 0.12 does not expose this as a `Matchmaking` method, so we call the raw flat API directly using the pointer from `SteamAPI_SteamMatchmaking_v009()`. Both are public exports of the crate.

Returns `true` when the request was submitted, `false` when data is already cached (safe to proceed) or Steam is unavailable.

**New TS helper:** `requestSteamLobbyData(lobbyId: string): Promise<boolean>` in `steamNetworkingService.ts`.

### Warm-up pattern in steamBackend

Before ANY per-lobby `getLobbyData` call:

```ts
// Kick off metadata requests for all lobbies in parallel.
// Steam's GetLobbyData returns "" until LobbyDataUpdate_t fires for a cold lobby.
await Promise.all(ids.map(lid => requestSteamLobbyData(lid).catch(() => false)));
// Brief wait for the background callback pump to process LobbyDataUpdate_t.
await new Promise(r => setTimeout(r, 200));
```

Applied in both `steamBackend.resolveByCode` and `steamBackend.listPublicLobbies`. The existing `if (!mode || !visibility || !lobbyCode) continue` guard remains as a backstop for any remaining misses.

---

## CHANGELOG (abbreviated)

| Date | Commits | What |
|------|---------|------|
| 2026-04-22 | (BUG-1/2/3/4/14 Wave 1) | Guest now applies `mode`/`deckId`/`houseRules` from `mp:lobby:start` payload (fixes independent-game split). BUG-2: defensive abort if mode still undefined after apply. BUG-3: ACK timeout aborts start + fires `onLobbyError` + evicts ghost guests instead of firing onGameStart with unreachable peers. BUG-4: `mp:lobby:start_ack` was already in `MultiplayerMessageType` union — removed stale `as` cast + TODO comment. 3 new regression tests. |
| 2026-04-22 | (P2P session fix) | `session_request_callback` + `session_failed_callback` registered in `SteamState::new()`; `AUTO_RESTART_BROKEN_SESSION` send flag; `steam_prime_p2p_sessions` + `steam_get_p2p_connection_state` new Tauri commands; `lan_tcp_probe` LAN command; TS retry loop in `SteamP2PTransport._sendWithRetry`; `primeP2PSessions` called in all three lobby join/create paths; forensic logging in `setContentSelection` + `notifyLobbyUpdate` |
| 2026-04-21 | (Wave 12) | Steam lobby metadata warm-up: `steam_request_lobby_data` Rust command (raw sys flat API), `requestSteamLobbyData` TS helper, warm-up pass in `listPublicLobbies` + `resolveByCode` — fixes cold-cache "" from `GetLobbyData` |
| 2026-04-21 | (C4 fix) | Outbound pre-connect buffer in SteamP2PTransport — send() during 'connecting' state now buffers to _preSendBuffer (cap 64); flushed after acceptP2PSession resolves. Silent-drop warns added. Malformed P2P message catch now logs. 6 new unit tests. |
| 2026-04-21 | (A5 hardening) | Raw LobbyEnter callback for real ChatRoomEnterResponse codes (Limited user = code 7 with actionable message), Worldwide distance filter on lobby list, explicit set_lobby_joinable(true), joinSteamLobby diagnostic console.log |
| 2026-04-21 | (A2–A4 fix wave) | Ghost lobby prevention (joinLobby: _currentLobby set after join), Steam join error surfacing (pending_join_error slot, pollJoinResult, 10s timeout), stale lobby filtering (currentPlayers=0, >2h), host metadata clear on leave |
| 2026-04-21 | (AR-80 pump) | Background `run_callbacks` pump thread in `SteamState::new()` — fixes intermittent lobby join failures on cold Steam backends |
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


---

## B2 — Broadcast Directory Cleanup on Host Leave (2026-04-21)

**Source file:** `src/services/multiplayerLobbyService.ts` — `leaveLobby()`

When the host leaves a broadcast-mode lobby, `leaveLobby()` now immediately deletes their entry from `localStorage['rr-mp:directory']` rather than waiting for the 15s TTL to expire. The cleanup block reads the directory, filters out the departing lobby ID, and writes back. This is fire-and-forget with a silent catch; if it fails the TTL still handles eventual removal.

---

## B3 — Steam Force-Leave on Any Lobby Exit (2026-04-21)

**Source file:** `src/services/multiplayerLobbyService.ts` — `leaveLobby()`

On Steam builds, `leaveLobby()` now calls `invokeSteam('steam_force_leave_active_lobby')` (fire-and-forget, dynamic import to avoid circular imports). This cleans up Steam matchmaking state immediately on departure instead of waiting for app exit. The call is gated on `hasSteam` and its failure is a logged warning only — never blocks the local leave.

---

## C1 — Lobby Titles (2026-04-21)

**Source files:** `src/data/multiplayerTypes.ts`, `src/services/multiplayerLobbyService.ts`, `src/ui/components/MultiplayerMenu.svelte`, `src/ui/components/LobbyBrowserScreen.svelte`, `server/src/services/mpLobbyRegistry.ts`, `server/src/routes/mpLobby.ts`

Optional `title?: string` field plumbed end-to-end:

- `multiplayerTypes.ts` — added `title?: string` to `LobbyState` and `LobbyBrowserEntry`
- `multiplayerLobbyService.ts` — `createLobby()` accepts `title` in opts, sanitizes via `sanitizeLobbyTitle()`, passes through all three backends; `broadcastBackend` writes to directory entry; `steamBackend` writes via `setLobbyData`; `webBackend` POSTs to server
- `MultiplayerMenu.svelte` — optional text input in Create tab; max 40 chars; sanitized at creation
- `LobbyBrowserScreen.svelte` — title shown as primary label when set; host name shown as `"by {hostName}"` secondary line when title is set
- `mpLobbyRegistry.ts` — `MpLobby`, `CreateLobbyOpts`, and `LobbyBrowserEntry` types include `title?`
- `mpLobby.ts` — server-side `sanitizeLobbyTitle()` applied to all incoming titles; `toEntry()` serializer includes title

---

## C3 — Profanity Service (2026-04-21)

**Source files:** `src/services/profanityService.ts`, `src/services/profanityService.test.ts`

New `profanityService` module:

- `sanitizeLobbyTitle(title)` — creation-time sanitization: strips control chars, trims, collapses whitespace, clamps to 40 chars. Mirrored server-side in `mpLobby.ts`.
- `maskProfanity(input)` — render-time masking: applies leet-speak normalization (0→o, 1→i, 3→e, 4→a, 5→s, 7→t, @→a, $→s) then matches `\b...\b` against a curated English word list. Matched spans replaced with `*` × span length. Masking is client-only presentation logic; stored text is unchanged.
- `TITLE_MAX_LENGTH = 40` — exported constant.

Leet normalization only applies when the leet char is adjacent to at least one alpha character on either side (prevents sentence-terminal punctuation like `cunt!` from corrupting word boundaries).

16 unit tests cover `sanitizeLobbyTitle` (6 cases) and `maskProfanity` (10 cases including leet variants, punctuation, case-insensitivity, length preservation).

---

## C4 — Outbound Pre-Connect Buffer (2026-04-21)

**Source file:** `src/services/multiplayerTransport.ts` — `SteamP2PTransport`

### Problem (pre-C4)

`SteamP2PTransport.send()` checked `if (this.state !== 'connected') return` as its first guard. This was correct for fully disconnected or error states, but it silently dropped any message sent while state was `'connecting'` — the window between `transport.connect()` being called and `acceptP2PSession()` resolving.

C1 (landed in a prior commit) already solved the symmetric inbound problem: messages arriving from the remote peer during this window were buffered in `_preAcceptBuffer` and replayed once connected. Outbound messages had no equivalent.

**Race scenario:** joiner calls `transport.connect()` → state = `'connecting'` → lobby service immediately calls `transport.send('mp:lobby:player_joined', {...})` → the send returns early → host never learns the joiner arrived → joiner is stuck in the lobby.

### Fix

New private field `_preSendBuffer: MultiplayerMessage[]` on `SteamP2PTransport`:

- `send()` when state is `'connecting'`: constructs the message and pushes to `_preSendBuffer`. Buffer is capped at 64 entries (matching Steam's internal per-channel queue size); if the cap is exceeded, the oldest message is dropped with a `console.warn`.
- `send()` when state is `'error'` or `'disconnected'`: logs `console.warn` with the message type (no buffer — these states are terminal/unrecoverable without a new `connect()`).
- `.then()` in `connect()` after the inbound replay loop: splices and sends all `_preSendBuffer` entries via `sendP2PMessage`. Each send is individually caught with a warn that includes the message type.
- `.catch()` in `connect()`: clears `_preSendBuffer` and logs how many pending sends were dropped.
- `disconnect()`: clears `_preSendBuffer` to prevent replay on a subsequent `connect()` to a different peer.

### Symmetry with C1

| Side | Buffer | Flushed in | Cap |
|------|--------|-----------|-----|
| Inbound (C1) | `_preAcceptBuffer` | `.then()` — poll loop start | none |
| Outbound (C4) | `_preSendBuffer` | `.then()` — after inbound flush | 64 msgs |

### Diagnostic improvements (same commit)

- `_handleRawMessage` catch: now logs the raw data prefix (`data.slice(0, 200)`) and the error instead of a silent return. Malformed P2P messages were previously invisible in bug reports.
- `sendP2PMessage` catch in the connected `send()` path: now includes `msg.type` in the warning so failed sends identify which message was lost.
- `send()` when `state === 'error'` or `'disconnected'`: now emits a named `console.warn` instead of a silent return.

6 unit tests in `src/services/multiplayerTransport.test.ts` cover the buffer, flush, cap, overflow warning, `disconnect()` clear, and connect-failure clear paths.

---

## AR-80 Follow-up — Steam Callback Pump (2026-04-21)

**Source file:** `src-tauri/src/steam.rs` — `SteamState::new()`

### Problem (pre-fix)

All async Steam callbacks (`LobbyEnter_t`, `LobbyCreated_t`, leaderboard, cloud sync) only fire when `client.run_callbacks()` executes. Before this fix, the only driver was the JS-side `steam_run_callbacks` Tauri command, polled every ~100 ms. The JS pollers for join/create timed out at 10 s — on cold or slow Steam backends, callbacks arriving after the timeout produced spurious `joinSteamLobby failed` errors even when Steam had actually succeeded.

### Fix

`SteamState::new()` now spawns a background thread immediately after successful `Client::init_app`:

```rust
let client_for_pump = client.clone(); // Arc<Inner> clone — cheap
let (tx, rx) = std::sync::mpsc::channel::<()>();
std::thread::spawn(move || {
    loop {
        std::thread::sleep(Duration::from_millis(16));
        client_for_pump.run_callbacks();
        match rx.try_recv() {
            Err(TryRecvError::Empty) => continue,
            _ => break, // sender dropped (app exit) or explicit shutdown
        }
    }
});
// tx stored in SteamState::_pump_shutdown
```

### Thread lifecycle

`SteamState._pump_shutdown: Option<mpsc::Sender<()>>` owns the sender. When `SteamState` drops on app exit, the sender is dropped. The thread's `rx.try_recv()` returns `Err(Disconnected)` on its next tick and exits the loop cleanly. No explicit `thread::join` is needed — the thread is lightweight and exits within one 16 ms tick.

### Concurrency safety

`steamworks-rs` `Client` wraps `Arc<Inner>` internally and implements `Clone` (confirmed in `steamworks-0.12.2/src/lib.rs:92`). `run_callbacks()` is idempotent — concurrent calls from this thread and the JS-driven `steam_run_callbacks` command don't conflict. Worst case is a duplicate pump that processes zero additional events.

### Impact on existing code

`steam_run_callbacks` is kept intact as a harmless safety net. JS callers may still poll it. The 10 s `pollJoinResult` timeout in `steamNetworkingService.ts` is intentionally kept at 10 s — it also defends against genuine Steam outages. Any future async Steam API (leaderboards, cloud save) will have its callbacks processed automatically without needing its own polling loop.
