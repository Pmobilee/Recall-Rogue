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
                                        15s hard timeout; resolves 'cancelled' on
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

`awaitCoopTurnEndWithDelta(delta)` also watches `_currentLobby.players.length`. If it drops below the expected count mid-barrier, the barrier resolves `'cancelled'` immediately. The **15s hard timeout** is a separate backstop for cases where the disconnect is not signaled via lobby state (aligns with peer-presence 30s pong grace; subsequent peer-left event cancels the barrier — M-025).

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

## Subscribe-After-Send Race Hazard

In Steam P2P (and any transport without reliable message replay), there is a window between
when the host **sends** a message and when the guest has **registered its listener**. If the
host broadcasts `mp:coop:enemy_state` at encounter setup before `initCoopSync()` has run on
the guest (e.g. the guest's `mp:lobby:start` handler fires slightly after the host's), the
guest's listener is not yet registered and the snapshot is permanently lost.

**Mitigation — buffer + request-on-subscribe:**

1. `broadcastSharedEnemyState()` writes the snapshot to `_lastBroadcastSnapshot` (module-level buffer) **before** calling `transport.send()`.
2. At the end of `initCoopSync()`, if the local player is a guest, `_requestInitialEnemyState()` sends `mp:coop:request_initial_state` to the host.
3. The host's `mp:coop:request_initial_state` handler re-broadcasts `_lastBroadcastSnapshot` to all.
4. If no `mp:coop:enemy_state` arrives within **2 seconds**, the guest retries. Max **3 retries** (total ~6s). Each retry logs attempt number + elapsed via `rrLog`.
5. Any arrival of `mp:coop:enemy_state` cancels the retry timer immediately.

This pattern generalises: any message that MUST arrive before the receiver can proceed should be buffered by the sender and re-sent on an explicit request from the late subscriber. Do not rely on timing guarantees from the transport layer.

**Retry schedule:** 0ms → +2000ms → +4000ms → +6000ms (3 retries, 6s total).

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
| `mp:coop:request_initial_state` | Guest | `{ playerId }` | Guest requests host re-broadcast initial enemy snapshot (subscribe-after-send recovery) |

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

### Host self-fire on Steam P2P (BUG-8 fix)

Steam P2P has no loopback — the host never receives its own `mp:lobby:start` broadcast. Without a fix, the
host's `onGameStart` subscribers would only fire via the 3s timeout (old behavior — now an abort path).

**Fix:** immediately after `transport.send('mp:lobby:start', payload)`, the host fires
`_gameStartSubscribers` directly on Steam builds (`hasSteam && !isBroadcastMode() && !isLanMode()`).
A `_hostStartFired` flag prevents double-fire if the host somehow receives an echo (BroadcastChannel and
WebSocket transport echo the message back — they reach the same guard via the received-message handler).

### Guest-side payload application order

The `mp:lobby:start` handler on the guest applies fields in this order before firing `onGameStart`:

0. **Idempotency guard (FIX 023):** if `_currentLobby.status === 'in_game'` the handler re-sends `mp:lobby:start_ack` and returns — the host's 750ms retry storm cannot re-fire `_gameStartSubscribers` for a guest already in-game.
1. `status = 'in_game'` — set early (before field merges) so any re-entrant delivery hits the guard.
2. `mode` — overrides stale mode from prior lobby or lost `mp:lobby:settings`
3. `deckId` → `selectedDeckId` — overrides prior deck selection
4. `houseRules` — overrides stale house rules
5. `contentSelection` — authoritative at game-start time
6. `seed`

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

## Seeded RNG Forks — `SAME_CARDS_FORK_LABELS`

`multiplayerGameService.ts` exports `SAME_CARDS_FORK_LABELS` — the fork labels whose internal PRNG state is broadcast from host to guest at run start (and re-broadcast on late-join). Coop and Same-Cards both rely on this list. Adding a new `Math.random()` site in a code path the guest also runs is a **desync vector** unless it goes through `getRunRng(label).next()` AND `label` is included here.

Current labels (2026-04-22, ULTRATHINK wave-2):

| Label | Owner | Purpose |
|---|---|---|
| `deck` | `deckManager.ts` | Per-encounter deck shuffles, draw piles |
| `hand` | `deckManager.ts` | Hand draw order |
| `factAssignment` | `cardEffectResolver.ts` | Fact assignment at charge-commit |
| `cardReward` | `rewardGenerator.ts` | Reward room card-pick offers |
| `shopInventory` | `shopService.ts` | Shop relic + card rolls |
| `tagMagnetism` | `deckManager.ts:198` | Tag-magnet relic draw bias |
| `cardEffects` | `turnManager.ts:609` | Transmute mechanic-pool selection |
| `debuffTarget` | `turnManager.ts:1666/1671/1683/2992` | Enemy debuff target shuffles + scavenge/forge/mimic candidate picks |
| `catchUpMastery` | `catchUpMasteryService.ts:42` | Starting-mastery roll for newly acquired cards |
| `shopFloor10Food` | `shopService.ts:239` | Late-floor elixir-vs-feast roll |
| `quizFraming` | `nonCombatQuizSelector.ts:21` | Flag question-type roll (identify/reverse/continent/not_elimination) |

**Workflow when adding a new fork:**
1. Replace the `Math.random()` call with `isRunRngActive() ? getRunRng('newLabel').next() : Math.random()` (the `Math.random` fallback keeps tests / dev preview working without a run).
2. Add `'newLabel'` to `SAME_CARDS_FORK_LABELS` so `collectForkSeeds()` broadcasts it on coop/same-cards game start.
3. Add a unit test that proves two seeded RNGs at the same state produce the same value.

---

## Coop Scoring (MP-STEAM-AUDIT-2026-04-22-L-030)

`calculateScoreForMode('coop', stats)` in `multiplayerGameService.ts` is now its own branch (no longer falls through the `race` case). Formula:

```
solo:    floors*100 + damage + chain*50 + correct*10 - wrong*5  + perfect*200
partner:                                + partnerCorrect*3 - partnerWrong*1 + partnerPerfect*75
```

Partner-credit weights are smaller than solo weights (3 vs 10, 1 vs 5, 75 vs 200) so the score still primarily reflects this player's own contribution — joining a strong partner does not 2× your number, but a player who carries the deck-knowledge load gets visible recognition on both screens.

`ModeScoreStats` now carries optional `partnerCorrectCount`, `partnerWrongCount`, `partnerPerfectEncounters` populated by the coop endgame summary after both players' final `mp:coop:partner_state` messages have arrived. When omitted (back-compat callers), the formula collapses to the race formula.

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
| 2 | `isLanMode()` — `rr-lan-server` in localStorage (non-Steam build, or Steam with `?lan=1`) | `webBackend` | LAN mode for dev/LAN testing |
| 3 | `isTauriPresent()` (live check) | `steamBackend` | Tauri + Steam builds |
| 4 | `isDesktop && !isTauriPresent()` | **throws** | M-022: Steam build context but live Tauri check failed — hard-fail so the error surfaces instead of silently routing to Fastify WebSocket |
| 5 | (default) | `webBackend` | Web / mobile / CI |

`pickBackend()` uses a live `isTauriPresent()` check (not the module-load-time `hasSteam` constant) to avoid a packaging-order race on Steam builds. See `docs/gotchas.md` 2026-04-20 "Tauri v2 platform detection."

**M-022:** If `isDesktop=true` (module-load Tauri snapshot detected) but `isTauriPresent()=false` at call time, `pickBackend()` throws rather than falling through to `webBackend`. Logged at `console.error` with context. In each `createLobby`/`joinLobby`/`joinLobbyById` call, the selected backend is logged via `rrLog('mp:lobby', 'backend picked', {entrypoint, backend})`.

**FIX 019:** In a packaged Steam build, stale `rr-lan-server` localStorage is ignored unless `?lan=1` is present in the URL. This prevents a leftover dev artifact from routing Steam multiplayer through the web backend. Console warns when the flag is detected but ignored.

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
- `mp:lobby:ready` — persists `lastKnownReady` on the connection record (issue 069), then rebroadcasts `mp:lobby:ready`.
- `mp:lobby:leave` — `leaveLobby()` + close. Distinct from a transport-level disconnect.
- `mp:lobby:settings` — host-only; patch + rebroadcast.
- `mp:lobby:start` — host-only; `status=in_game` + broadcast.
- `mp:race:*`, `mp:coop:*`, `mp:duel:*`, `mp:trivia:*` — forwarded verbatim.

`ws.on('close')` (transport-level disconnect, not a deliberate `mp:lobby:leave`) emits **`mp:lobby:peer_left`** to the remaining players (issue L-029) BEFORE `leaveLobby` runs. Payload: `{ playerId, reason: 'transport_close', timestamp }`. The Steam transport emits the same shape from the Rust side via P2PSessionConnectFail_t; clients can treat both paths identically. Sub-second detection latency replaces the prior ~30s JS ping/pong fallback.

### Server Snapshot Player Shape

```typescript
{
  id: string;
  displayName: string;
  isHost: boolean;
  isReady: boolean;            // issue 069: server tracks lastKnownReady per connection
  multiplayerRating: number;   // issue 068: defaults to 1500 when the player record is created
}
```

Each `MpLobbyConnection` carries `lastKnownReady` and `multiplayerRating` so late joiners receive an accurate snapshot immediately, without waiting for the next `mp:lobby:settings` broadcast or a re-toggle from the already-ready player. Defaults are `isReady: false` and `multiplayerRating: 1500` (standard ELO baseline; the server is not authoritative for rating, just provides a sane non-undefined slot).

The `mp:lobby:player_joined` payload now includes `isReady` and `multiplayerRating` for the joining player too — previously omitted, which left `players[i].multiplayerRating` undefined on the client until the next settings broadcast.

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

**M-023 Steam-build gating:** `startLanServer()`, `stopLanServer()`, `getLanServerStatus()` (lanServerService) and `scanLanForServers()` (lanDiscoveryService) are no-ops when `LAN_DISABLED_IN_STEAM` is true (i.e. `isTauriRuntime() && !?mp && !?lan`). These functions return `null`/empty/false and log `rrLog('mp:lan', 'LAN disabled in Steam build')`. LAN features are only active in Steam builds when the `?lan=1` URL flag is present (explicit developer opt-in).

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

## Steam P2P Session Priming — Fire-and-Forget, NOT Synchronous (2026-04-22)

**Source files:** `src/services/steamNetworkingService.ts` (`primeP2PSessions`), `src-tauri/src/steam.rs` (`steam_prime_p2p_sessions`), `src/services/multiplayerLobbyService.ts` (call sites in `createLobby` / `joinLobby` / `joinLobbyById`), `src/services/multiplayerTransport.ts` (`SteamP2PTransport._sendWithRetry`, `_preSendBuffer`).

### What priming actually does

`steam_prime_p2p_sessions(lobbyId)` enumerates the lobby's other members and sends a single zero-byte `ISteamNetworkingMessages` packet to each one with the `AUTO_RESTART_BROKEN_SESSION` flag. The send returns the moment Steam queues the packet — it does NOT wait for the remote `session_request_callback` to fire on the peer side and it does NOT wait for `Connected` state. The Tauri command resolves with the count of peers it attempted to prime, not the count of sessions that opened.

### Race window — first transport.send may arrive before the session is open

Because priming is fire-and-forget, the very first `transport.send(...)` call after `primeP2PSessions` returns can race the session handshake. Three things absorb the race:

1. **`SteamP2PTransport._preSendBuffer` (cap 64)** — when transport state is `'connecting'`, sends are pushed to the buffer and flushed after `acceptP2PSession` resolves. See `## C4 — Outbound Pre-Connect Buffer`.
2. **`_sendWithRetry` (5 attempts, ~4.4s budget, see `STEAM_P2P_SEND_RETRY_DELAYS_MS`)** — when `steam_send_p2p_message` returns `false` (BUG2 fix made the bool actually visible to TS), retries with backoff. Logs `getSessionError(peerSteamId)` between attempts.
3. **`session_request_callback` registered in `SteamState::new()`** — auto-accepts incoming sessions on the *receiver* side so the second-direction send arc opens without TS intervention.

### Implementer warnings

- **Do not assume priming is complete before the first send.** The Tauri command resolving means "Steam queued the primer," not "session is ready."
- **Do not skip `_sendWithRetry` for `mp:lobby:start` or any other host bootstrap message.** A naked `transport.send` will eat the first session window. BUG 032 was this exact failure mode.
- **Do not call `primeP2PSessions` once and assume both directions are open.** A→B and B→A are two separate session arcs under `ISteamNetworkingMessages`. The receiver-side `session_request_callback` covers the inbound arc; outbound priming covers the local→remote arc. Both are required.
- **Two-tab dev mode does NOT exercise this path** — `BroadcastTransport` has no session concept. Steam-build smoke tests are the only way to catch a regression here.

---

## Production Residue — webBackend / LAN / CSP / VITE_MP_WS_URL on Steam Builds (2026-04-22)

This section catalogs build-time and runtime "dead but compiled" multiplayer surfaces that ship inside the Steam binary. Knowing where each lives prevents future "lobby works but nothing works after start" failure modes (MP-STEAM-AUDIT-2026-04-22-M-022, M-023; MP-STEAM-20260422-010, 013).

### `webBackend` — compiled, gated, never selected on a healthy Steam build

`webBackend` is the Fastify REST + WebSocket lobby backend. On Steam, `pickBackend()` (priority table in `## Three-Backend Architecture`) selects `steamBackend` when `isTauriPresent()` returns `true`, so `webBackend` is never picked in production. However:

- The `webBackend` module is statically imported in `multiplayerLobbyService.ts` and tree-shaken into the Steam bundle anyway. Build size cost ~5 KB gzipped — acceptable.
- If Steam init partially fails (e.g., `steam_appid.txt` missing in a dev iteration of the bundle), `isTauriPresent()` still returns `true` but Steamworks calls fail. The lobby code does NOT currently demote to `webBackend` in that case — `steamBackend` calls fail loudly. This is the desired behavior. **Do not "fall back to webBackend on Steam init failure"** — that path points at `VITE_MP_WS_URL` which on Steam is `ws://localhost:3000/mp/ws` (see below) and silently fails.
- `webBackend` is the legitimate path for web/mobile/CI builds and dev `npm run dev` sessions.

**Operational note:** if a Steam player reports "lobby joins but game never starts," check the browser console for `[multiplayerLobbyService] picked backend = web` — that line means the Steam path was demoted unexpectedly.

### LAN code — compiled-but-hidden in Steam release

`src/services/lanServerService.ts`, `lanDiscoveryService.ts`, `lanConfigService.ts` and the LAN tab UI in `MultiplayerMenu.svelte` are all compiled into the Steam bundle. The LAN tab itself is hidden (commit `f464d3652`), but the underlying code paths still exist and can be reached via:

- Stale `localStorage.rr-lan-server` from a prior dev session — **mitigated by FIX 019**: `pickBackend()` ignores this on Steam builds unless `?lan=1` is in the URL.
- `MultiplayerMenu.svelte` `handleCreateLobby` / `handleJoinLobby` — defensively call `stopLanServer()` and clear persisted LAN URL before any Steam lobby create/join (commit `7a968aae5`).

**Why not strip it out:** A `VITE_STEAM_BUILD` compile-time gate would shave ~30 KB but introduces two build matrices to verify. Decision deferred until LAN is genuinely abandoned for Steam (see MP-STEAM-AUDIT-2026-04-22-M-023). For now, the runtime defenses are the contract — do NOT remove the `isLanMode()` guards or the LAN-clear calls in `MultiplayerMenu.svelte` without first stripping the imports.

### `VITE_MP_WS_URL` — defaults to localhost on Steam, intentionally unused

`multiplayerTransport.ts` defines `DEFAULT_MP_WS_URL = 'ws://localhost:3000/mp/ws'`. In a Steam production build:

- `import.meta.env.VITE_MP_WS_URL` is whatever was set at `npm run build` time. `scripts/steam-build.sh` does NOT set it (verified 2026-04-22). The default wins.
- Steam path uses `SteamP2PTransport`, not `WebSocketTransport`, so the URL is never read.
- If a future change introduces a WebSocket fallback on Steam (NAT-unfriendly recovery, telemetry, live-ops), it will silently point at the player's own `localhost:3000` and fail. **MP-STEAM-20260422-013 logged this trap.**

**Required action before adding any WebSocket code path to Steam builds:**
1. Decide on a real production URL (`wss://mp.recallrogue.com` is the conventional placeholder).
2. Set `VITE_MP_WS_URL=wss://...` in `scripts/steam-build.sh` before the `npm run build` invocation.
3. Update the production CSP `connect-src` to include the URL (see below).
4. Add a fail-fast assertion in `multiplayerTransport.ts`: if Steam build AND WebSocketTransport selected AND URL still points at `localhost`, throw on construction.

### Production CSP — locked to `https://*.recallrogue.com`

`vite.config.ts:31` injects `connect-src 'self' https://*.recallrogue.com https://localhost:*` into the production HTML meta tag. The Steam P2P path goes through Tauri IPC (not `connect-src`), so today this CSP is effectively unused for multiplayer. Implications:

- Adding any WebSocket relay, telemetry endpoint, error reporter, or LAN HTTP probe that targets a domain outside `*.recallrogue.com` will be silently blocked by the browser engine in the Tauri webview. Console will log a CSP violation; the network call will fail. Players will see "lobby works but game never starts" with no obvious cause.
- The Tauri webview enforces meta-tag CSP the same way Chromium does. There is no Tauri-side override that loosens it.
- `tauri.conf.json` does NOT currently set `app.security.csp` (verified 2026-04-22 — the field is absent). Tauri-level CSP enforcement is therefore inactive; only the meta-tag CSP is live. This may change if a future Tauri upgrade enables `app.security.csp` by default — re-verify on every Tauri version bump.

**Required action before adding any non-Tauri-IPC network call:**
1. Add the target origin to the production CSP `connect-src` in `vite.config.ts:31`.
2. Test the call inside a packaged Steam build (NOT `npm run dev` — dev CSP is permissive).
3. Document the new origin in this section.

The dead `src/csp.ts` module that previously held a parallel CSP definition was removed in commit `74fad47` (MP-20260413-003941-MP-012). All CSP lives in `vite.config.ts` and (potentially) `tauri.conf.json`.

---

---

## Settings Merge & Reconciliation (ULTRATHINK wave 2 — 2026-04-22)

**Source files:** `src/services/multiplayerLobbyService.ts`, `src/data/multiplayerTypes.ts`

The host is the authoritative writer of `LobbyState`. Every host-side mutation calls `broadcastSettings()` which sends a full `mp:lobby:settings` snapshot to all guests. Guests merge the snapshot via the `reg('mp:lobby:settings', ...)` handler in `setupMessageHandlers`.

Three rules govern the merge to prevent regressions seen in earlier waves:

### 1. Sequence-number rejection (#037)

Each `broadcastSettings()` call increments `_settingsSeq` (host-only) and stamps the value onto the `mp:lobby:settings` payload. Guests track `_lastSettingsSeqSeen` and **drop any message with `incoming.seq <= _lastSettingsSeqSeen`**. This defends against lossy Steam P2P delivering an older snapshot after a newer one and clobbering fresh state. Both counters reset to 0 in `leaveLobby`. Legacy peers that don't include `seq` are treated as `seq=0` and accepted only on the first broadcast (after that, any future seq>=1 from an upgraded peer takes priority).

### 2. Local-signal preservation (#026)

Before `Object.assign(_currentLobby, settings)` runs, the guest snapshots a per-player `{ isReady, connectionState, multiplayerRating }` map. After the merge, two fields are restored from local truth:

- **`connectionState='reconnecting'`** — driven by the local peer-left poll and the H10 60s grace timer, NOT by the host's snapshot. A host-broadcast `'connected'` value can never overwrite our local `'reconnecting'`.
- **`multiplayerRating`** — if the host's snapshot has the placeholder `1000` and our cached value is a real Elo, our value wins.

`isReady` for the local player still uses the H13 `readyVersion` comparison (newer local toggle wins).

### 3. Periodic full-roster reconciliation (#036)

The host runs a `startRosterReconciliation()` interval that re-broadcasts the full settings snapshot every **5 s** (`ROSTER_RECONCILE_MS`) until the lobby transitions to `status='in_game'` or `leaveLobby` runs. Each beat advances `_settingsSeq`, so guests atomically replace their roster on the next merge. Cheap insurance against accumulated identity drift from lost messages or partial merges.

### Identity model (#025)

The legacy `steam:<hostSteamId>` placeholder host entry was removed from `joinLobby` and `joinLobbyById`. Guests now start with `hostId=''` and a single self-entry; the first `mp:lobby:settings` broadcast (within ~150ms on Steam P2P after the host receives `mp:lobby:join`) bootstraps the real roster with the host's actual `player_xxx` ID. The placeholder format never matched the real ID format and broke the kick-signature check (`issuedBy === hostId`) and the peer-left poll matcher.

### `local_player` regression guard (#058)

`createLobby`, `joinLobby`, and `joinLobbyById` now throw if `playerId === 'local_player'` or empty. The legacy default would cause both peers to treat each other's `senderId` as self and silently drop every message — the classic "each in own game" symptom. Callers (`CardApp.svelte`) must resolve a real Steam ID or generated `player_xxx` ID before invoking the lobby API.

### Per-transport handler-attach guard (#067)

`_handlersAttached` is now scoped per-transport-instance via `_handlersAttachedTransport`. Calling `setupMessageHandlers` twice on the SAME transport remains the bug we want to prevent (doubled handlers); calling it again after the transport changes (singleton rebuilt by `destroyMultiplayerTransport`, or a separate `addLocalBot` transport becomes active) now correctly re-attaches.

### `startGame` connected-player gate (#070)

The pre-broadcast player-count check now filters out `connectionState==='reconnecting'` players. Without this, a partner who dropped during the ready handshake (still in roster, marked reconnecting) lets the count pass; the host clicks Start; the 3s ACK timeout fires; host enters the run alone.

### `onGameStart` subscriber lifecycle (#034)

Subscribers registered via `onGameStart` are intentionally NOT cleared in `leaveLobby` — they survive lobby cycles by design (`CardApp.svelte` registers once on app mount). The CONSUMER is responsible for storing and calling the returned cleanup function in their teardown path (`$effect` cleanup, `onDestroy`, error boundary recovery, HMR dispose). Without consumer cleanup, HMR / error-recovery re-mounts stack OLD subscriber closures on top of new ones, producing double-fire `onGameStart` that re-triggers the scene transition mid-run. The JSDoc on `onGameStart` documents this contract.

### Deck-selection mode switch (#066)

`setDeckSelectionMode` now clears the abandoned variant when switching modes: `host_picks → each_picks` clears the lobby-level `contentSelection` and `selectedDeckId`; `each_picks → host_picks` clears every player's per-player `contentSelection` and `selectedDeckId`. Stale selections from the prior mode no longer leak into the `mp:lobby:start` payload.

---

## CHANGELOG (abbreviated)

| Date | Commits | What |
|------|---------|------|
| 2026-04-22 | (ULTRATHINK wave 2 — agent A: lobbyService) | #025 dropped `steam:<id>` placeholder host entry from joinLobby/joinLobbyById — hostId stays empty until first `mp:lobby:settings` arrives (placeholder ID never matched real `player_xxx` IDs and broke kick-signature + peer-left matchers). #026 `mp:lobby:settings` merge now preserves non-local players' `connectionState='reconnecting'` and real `multiplayerRating` against host's snapshot. #034 `onGameStart` JSDoc now documents that subscriber dedup is the consumer's responsibility (CardApp `$effect` cleanup must call returned unsubscribe; HMR/error-recovery re-mounts otherwise stack closures). #036 host now broadcasts a full settings snapshot every 5s via `startRosterReconciliation` — guests atomically replace roster on each beat; stopped on leaveLobby + status='in_game'. #037 every `mp:lobby:settings` carries a monotonic `seq`; guests reject `incoming.seq <= _lastSettingsSeqSeen`. #057 already resolved (no `as MultiplayerMessageType` cast remains). #058 `createLobby`/`joinLobby`/`joinLobbyById` now throw if `playerId === 'local_player'` or empty (regression guard against the legacy placeholder reaching the lobby and producing self-routed sends). #066 `setDeckSelectionMode` clears the abandoned variant (host_picks↔each_picks) so stale selections don't carry into the start payload. #067 `_handlersAttached` now scoped per-transport-instance (`_handlersAttachedTransport`) — addLocalBot's separate transport correctly re-attaches handlers in a session that already created the Steam transport. #070 `startGame` connected-count gate now excludes `connectionState==='reconnecting'` players (host can no longer start solo when partner is unreachable but still in roster). H-016 verified already fixed in FIX023 (ACK contentHash handshake at lines 1700/1721). PASS1-BUG-12 deferred — requires `transport.send()` returning `Promise<boolean>` (transport.ts owned by another agent in this wave). |
| 2026-04-22 | (MP-STEAM-AUDIT Wave 5) | M-017: seeded RNG already present in catchUpMasteryService (verified). M-025: `BARRIER_TIMEOUT_MS` reduced 45→15s in multiplayerCoopSync (aligns with 30s pong grace; peer-left cancels barrier first). M-022: `pickBackend()` now throws with `console.error` when Steam build context (`isDesktop=true`) but `isTauriPresent()=false`; `rrLog('mp:lobby','backend picked')` added to all three lobby entrypoints. M-023: `LAN_DISABLED_IN_STEAM` constant + gate added to `lanServerService` (startLanServer/stopLanServer/getLanServerStatus) and `lanDiscoveryService` (scanLanForServers); no-ops when `isTauriRuntime() && !?mp && !?lan`. L-029: P2PSessionConnectFail_t callback, `pending_p2p_fail` slot, `steam_get_pending_p2p_fail` Tauri command, and `getPendingP2pFail()` TS wrapper all already present (verified). |
| 2026-04-22 | (ULTRATHINK wave 1) | 7 fixes: FIX016 — mp:lobby:start handler already applied mode/deckId/houseRules (confirmed present); FIX018 — replaced module-load-time `hasSteam` constant with live `isTauriPresent()` calls at all 9 call sites; FIX019 — `pickBackend()` ignores LAN-mode localStorage in Steam builds unless `?lan=1` URL flag present; FIX020 — Fastify `mp:lobby:start` broadcast now forwards full host payload (mode/houseRules/deckId/contentSelection); FIX022 — `startNewRun` maps coop→multiplayer_coop, duel→multiplayer_duel, trivia_night→multiplayer_trivia (prevents coop from triggering race-progress broadcast); FIX023 — `mp:lobby:start` handler is idempotent on re-entry (re-sends ACK, returns early); FIX029 — send-retry exhaustion transitions transport to 'error' state instead of silently logging. |
| 2026-04-22 | (Wave 2 — C-003/C-004/C-005/C-006/C-007/BUG-8/BUG-10) | C-003: race broadcast gated on `multiplayerModeState === 'race'` — coop/duel/same_cards no longer enter race loop. C-004: fork-seed broadcast added for coop — host calls `collectForkSeeds` + `broadcastForkSeeds` after `initRunRng`; guest receives via `mp:sync` handler extended to coop mode in `initGameMessageHandlers`. C-005: `multiplayerPlayerCount` threaded from lobby through `RunState` to `createEnemy` — `getCoopHpMultiplier` now applies 1.6× in 2P coop. C-006: `coopEffects.ts` orphan deleted (zero callers confirmed). C-007: `awaitCoopEnemyReconcile` timeout (5s) + retry via `requestCoopEnemyStateRetry` + 3-attempt auto-retry in `initCoopSync`. BUG-8: host self-fires `onGameStart` immediately on Steam P2P (no loopback); `_hostStartFired` guard prevents double-fire on BroadcastChannel/WS echo. BUG-10: initial `broadcastPartnerState` at encounter start so partner HUD shows correct starting HP. |
| 2026-04-22 | (BUG-1/2/3/4/14 Wave 1) | Guest now applies `mode`/`deckId`/`houseRules` from `mp:lobby:start` payload (fixes independent-game split). BUG-2: defensive abort if mode still undefined after apply. BUG-3: ACK timeout aborts start + fires `onLobbyError` + evicts ghost guests instead of firing onGameStart with unreachable peers. BUG-4: `mp:lobby:start_ack` was already in `MultiplayerMessageType` union — removed stale `as` cast + TODO comment. 3 new regression tests. |
| 2026-04-22 | (MP-STEAM wave) | MP-STEAM-20260422 fix wave: bang-precedence dead guard (003), SteamP2P retry budget 3→5 attempts/4.4s + `STEAM_P2P_SEND_RETRY_DELAYS_MS` export (005), memoized `isTauriPresent()` in platformService replaces two duplicate inline Tauri checks (011), runtime-toggleable `isDebugCoopOn()` replaces `DEBUG_COOP` const + `window.__rrSetDebugCoop` helper (012), H18 `handleCoopPlayerDeath` wired in encounterBridge beat-2 HP commit (015), subscribe-after-send race fix: `_lastBroadcastSnapshot` buffer + `mp:coop:request_initial_state` protocol + auto-retry (001/002/004) |
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


---

## Coop Wiring — Game Start Initialization Order (2026-04-22)

**Source files:** `src/CardApp.svelte`, `src/services/multiplayerGameService.ts`, `src/services/multiplayerCoopSync.ts`

**Fix batch:** C-001, C-002, C-003, C-005, C-007, MP-STEAM-20260422-002, MP-STEAM-20260422-004

### Problem (pre-fix)

After `mp:lobby:start` fired `onGameStart`, the coop/duel game session wiring was incomplete:

1. `initGameMessageHandlers()` — never called for coop/duel. Transport handlers for `mp:duel:turn_start`, `mp:duel:cards_played`, etc. were never installed.
2. `initDuel()` — never called. `_duelState` was always null; `hostCreateSharedEnemy`/`submitDuelTurnAction`/`hostStartNextTurn` were all orphaned.
3. `startNewRun` was called BEFORE `initCoopSync` and `onPartnerStateUpdate` — host's synchronous `broadcastSharedEnemyState` could send before guest's listener was registered.
4. `activeRunMode` was always set to `'multiplayer_race'` for ALL MP modes — coop/duel/same_cards all entered the race broadcast loop.
5. Coop HP scaling: `createEnemy` was called without `playerCount`, so `getCoopHpMultiplier()` always applied 1×.

### Fix — initialization order for coop/duel

In `CardApp.svelte` `onGameStart` callback, subscriptions are now registered **before** `startNewRun`:

```typescript
// 1. Register map node consensus (all modes)
initMapNodeSync(localPlayerId)

// 2. Register coop turn-end barrier + partner heartbeat
if (lobby.mode === 'coop') initCoopSync(localPlayerId)

// 3. Register transport message handlers (duel/coop only — race uses its own loop)
let cleanupGameMessages = null
if (lobby.mode === 'coop' || lobby.mode === 'duel') {
  cleanupGameMessages = initGameMessageHandlers(lobby.mode)
}

// 4. Initialize duel state machine (coop + duel)
if (lobby.mode === 'coop' || lobby.mode === 'duel') {
  initDuel(isLocalHost, localPlayerId, opponentId)
}

// 5. Initialize trivia game state + message handlers (trivia_night only)
// Fix MP-STEAM-20260422-017: without this, _gameState is null and every
// hostNextQuestion / submitAnswer call silently no-ops.
if (lobby.mode === 'trivia_night') {
  const triviaPlayers = lobby.players.map(p => ({ id: p.id, displayName: p.displayName }))
  initTriviaGame(triviaPlayers, DEFAULT_ROUNDS, isLocalHost)
  _pendingTriviaCleanup = initTriviaMessageHandlers()
}

// 6. NOW start the run — host broadcasts are safe, listeners are live
startNewRun({ multiplayerSeed: seed, multiplayerMode: lobby.mode })
```

Cleanup: `_pendingGameMessageCleanup?.()` and `_pendingTriviaCleanup?.()` are both called alongside `destroyCoopSync()` in the effect cleanup.

### Race broadcast gating (C-003)

`gameFlowController.ts` line ~1095 now gates the race broadcast on BOTH conditions:

```typescript
if (activeRunMode === 'multiplayer_race' && multiplayerModeState === 'race') {
  initRaceMode(...)
  stopRaceBroadcastFn = startRaceProgressBroadcast(...)
}
```

Previously coop/duel/same_cards all entered this branch because `activeRunMode` was pinned to `'multiplayer_race'` as a generic "is MP" flag.

### Host enemy creation — duel mode (C-002)

In `encounterBridge.ts` `startEncounterForRoom`, after creating and broadcasting the initial coop enemy state, the host also calls `hostCreateSharedEnemy` for duel mode:

```typescript
if (mpIsHost()) {
  broadcastSharedEnemyState(snapshotEnemy(enemy))  // coop
  if (run.multiplayerMode === 'duel') {
    hostCreateSharedEnemy(ascensionTemplate.id, run.floor.currentFloor, coopPlayerCount)
  }
}
```

---

## Coop HP Scaling — playerCount Threading (C-005, 2026-04-22)

**Source files:** `src/services/runManager.ts`, `src/services/gameFlowController.ts`, `src/services/encounterBridge.ts`

`RunState` now carries `multiplayerPlayerCount?: number`, populated from `getCurrentLobby()?.players.length` in `gameFlowController.ts` at run-start.

`encounterBridge.ts` reads it when creating the enemy:

```typescript
const coopPlayerCount = isCoopRun ? (run.multiplayerPlayerCount ?? 2) : 1;
const enemy = createEnemy(template, floor, { hpMultiplier, difficultyVariance, playerCount: coopPlayerCount });
```

`enemyManager.createEnemy` then calls `getCoopHpMultiplier(playerCount)` — 1.6× for 2 players. The canary multiplier is still disabled in coop (as before).

---

## Coop Enemy Reconcile — Timeout + Retry Protocol (C-007, 2026-04-22)

**Source files:** `src/services/multiplayerCoopSync.ts`, `src/services/encounterBridge.ts`

### awaitCoopEnemyReconcile timeout

`awaitCoopEnemyReconcile()` now has a 5-second hard timeout. On timeout it rejects with `CoopReconcileTimeoutError`.

### mp:coop:request_enemy_state (retry channel)

Guest-side: `requestCoopEnemyStateRetry()` sends `mp:coop:request_initial_state` to ask the host to re-broadcast.

Host-side: `initCoopSync` registers `offRequestInitialState` — on receiving `mp:coop:request_initial_state`, if the host has a buffered `_lastBroadcastSnapshot`, it re-calls `broadcastSharedEnemyState`. Re-broadcast is idempotent — guests that apply it multiple times converge to the same state.

### Guest subscribe-on-init (fix 001/004)

`initCoopSync` on a guest now immediately calls `_requestInitialEnemyState()` after registering all listeners. This ensures any host broadcast that arrived before the guest's handlers were live will be re-requested. The request retries up to 3 times with a 2-second interval; retry is cancelled when any `mp:coop:enemy_state` arrives.

### encounterBridge retry flow

```
Guest:
  initialSnapshot = await awaitCoopEnemyReconcile()   // 5s timeout
    [timeout] → requestCoopEnemyStateRetry()
              → await awaitCoopEnemyReconcile()        // 3s more (second 5s window)
                  [timeout] → fall through to local enemy
                  [success] → hydrateEnemyFromSnapshot
```

---

## Trivia Night — Screen Wiring (L-028, 2026-04-22)

**Source files:** `src/CardApp.svelte`, `src/ui/components/TriviaRoundScreen.svelte`, `src/services/triviaNightService.ts`

### How TriviaRoundScreen receives live state

`TriviaRoundScreen.svelte` is mounted in `CardApp.svelte` under `{#if $currentScreen === 'triviaRound' && _triviaGameState}`. Three `$state` variables drive it:

| Variable | Type | Source |
|---|---|---|
| `_triviaGameState` | `TriviaGameState \| null` | `onTriviaStateChange` subscription |
| `_triviaCurrentQuestion` | `TriviaQuestion \| null` | `onTriviaStateChange` (re-reads `state.currentQuestion`) |
| `_triviaLastRoundResult` | `TriviaRoundResult \| null` | `onTriviaRoundResult` subscription |

A `$effect` block registers these subscriptions for the lifetime of the app (cleanup on unmount). On each state change from the trivia service, the variables update reactively and the component re-renders.

`initTriviaGame()` is called in the `onGameStart` callback (inside the main multiplayer effect) for `trivia_night` mode. It seeds `_gameState` in the service. The `$effect` subscription picks up the initial state via `getTriviaState()` at effect mount time, then tracks mutations.

### Answer submission

`onAnswer={(selectedIndex, timingMs) => { submitAnswer(selectedIndex, timingMs) }}` — the component calls `submitAnswer` from `triviaNightService` directly. The service broadcasts the answer to the host, which resolves the round and emits `mp:trivia:scores`.

### Screen lifecycle

1. `initTriviaGame()` fires → service state goes to `phase: 'waiting'` → `_triviaGameState` set.
2. `initTriviaMessageHandlers()` fires → transport listeners active.
3. `currentScreen.set('triviaRound')` fires (must be called by the trivia mode game flow).
4. `TriviaRoundScreen` mounts, shows "waiting" phase.
5. Host calls `hostNextQuestion()` → broadcasts `mp:trivia:question` → `_triviaCurrentQuestion` updates → screen shows question.
6. Player answers → `submitAnswer()` → service emits `mp:trivia:scores` → `_triviaLastRoundResult` updates → reveal phase.
7. Host calls `hostEndGame()` → `mp:trivia:end` → `phase: 'finished'` → final leaderboard.

Note: `currentScreen.set('triviaRound')` is the caller's responsibility — the trivia service does not navigate. The host must trigger this transition after lobby start, typically from the run's dungeon map flow for trivia_night mode.
