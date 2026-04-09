# Multiplayer Mechanics

> **Source files:** `src/services/multiplayerGameService.ts`, `src/services/multiplayerLobbyService.ts`, `src/services/multiplayerTransport.ts`, `src/services/coopEffects.ts`, `src/services/coopService.ts`, `src/services/eloMatchmakingService.ts`, `src/services/triviaNightService.ts`, `src/services/steamNetworkingService.ts`, `src/data/multiplayerTypes.ts`, `src/services/enemyManager.ts`, `src/services/multiplayerScoring.ts`
> **Master tracking doc:** `docs/roadmap/AR-MULTIPLAYER.md`
> **Last verified:** 2026-04-07 — co-op enemy attacks now hit ALL players for full damage (was round-robin single target). `targetPlayerId` in `DuelTurnResolution` and `SharedEnemyState` intents is now `string | 'all'`.

## Modes

| Mode | Players | Sync | Key Mechanic |
|------|---------|------|--------------|
| Race | 2-4 | 0.5 Hz progress broadcast | Same seed, independent play, compare final scores |
| Same Cards | 2 | 0.5 Hz progress broadcast | Shared fork seeds for identical card draws |
| Real-Time Duel | 2 | Per-turn (host-authoritative) | Shared enemy, simultaneous turns, damage attribution |
| Co-op | 2 | Per-turn (host-authoritative) | Shared enemy, co-op exclusive effects |
| Trivia Night | 2-8 | Per-round | Pure quiz, speed bonus scoring, no combat |

## Mode Display Constants

All mode metadata lives in `src/data/multiplayerTypes.ts`. Three exports cover UI needs:

| Export | Purpose | Example (race) |
|--------|---------|----------------|
| `MODE_DISPLAY_NAMES` | Short title for cards/headers | `'Race Mode'` |
| `MODE_DESCRIPTIONS` | 1-2 sentence player-friendly description | `'Both players run the same dungeon independently. Same enemies, same layout — race to the highest score.'` |
| `MODE_TAGLINES` | Ultra-short tagline for mode cards | `'Race to the highest score'` |

`MODE_TAGLINES` was added alongside the `multiplayerMenu` screen registration (2026-04-07). UI components should prefer `MODE_TAGLINES` for compact contexts (mode cards, tooltip headers) and `MODE_DESCRIPTIONS` for full description panels.

## Content Selection

`LobbyContentSelection` (in `src/data/multiplayerTypes.ts`) is a discriminated union that replaces bare `deckId` strings for richer content targeting:

```typescript
export type LobbyContentSelection =
  | { type: 'study'; deckId: string; subDeckId?: string; deckName: string }
  | { type: 'trivia'; domains: string[]; subdomains?: Record<string, string[]> }
  | { type: 'custom_deck'; customDeckId: string; deckName: string }
```

| Variant | Use case |
|---------|----------|
| `study` | Curated Study Temple deck, optionally narrowed to a sub-deck |
| `trivia` | Trivia Dungeon — one or more knowledge domains, optional subdomain filters |
| `custom_deck` | Player-owned personal/Anki-imported deck |

Both `LobbyState` and `LobbyPlayer` carry an optional `contentSelection?: LobbyContentSelection` field. The legacy `selectedDeckId?: string` fields are retained on both interfaces but marked `@deprecated` — use `contentSelection` for new code.

### Setting content in the lobby service

`setContentSelection(selection: LobbyContentSelection)` in `src/services/multiplayerLobbyService.ts` mirrors `selectDeck()` but accepts the full union type. It also backfills `selectedDeckId` for backwards-compatibility:

- `type: 'study'` → `selectedDeckId = selection.deckId`
- `type: 'custom_deck'` → `selectedDeckId = selection.customDeckId`
- `type: 'trivia'` → `selectedDeckId = undefined` (no single deck ID applies)

Respects `deckSelectionMode`: host-only writes to `LobbyState.contentSelection` when `host_picks`; per-player writes to the local `LobbyPlayer.contentSelection` when `each_picks`.

`broadcastSettings()` includes `contentSelection` in the settings payload so non-host clients receive it via `mp:lobby:settings`.

### contentSelection in mp:lobby:start (fix 2026-04-09)

`startGame()` includes `contentSelection` directly in the `mp:lobby:start` payload. The `mp:lobby:start` handler on guest clients reads this value and assigns it to `_currentLobby.contentSelection` BEFORE invoking `_onGameStart`.

**Why both mp:lobby:settings and mp:lobby:start carry contentSelection:**
`mp:lobby:settings` is broadcast on every settings change and is the primary sync mechanism during lobby configuration. `mp:lobby:start` is the authoritative game-start event — it must be self-contained because it may arrive before or instead of a late/dropped settings broadcast in high-latency or lossy conditions. Having contentSelection in the start payload guarantees the guest always has the definitive value at run-start time regardless of message ordering.

### Mixed custom-deck language filter (fix 2026-04-09)

`buildPresetRunPool()` in `src/services/presetPoolBuilder.ts` accepts an `allowLanguageFacts?: boolean` option. When true, the `factIsTrivia` filter is skipped — language, vocabulary, and grammar facts are included alongside non-language domain facts.

`buildGeneralRunPool()` forwards this option to `buildPresetRunPool()`.

In `encounterBridge.ts`, the `custom_deck` pool-assembly branch computes:
```typescript
const hasLanguageItem = run.deckMode.items.some((item) => {
  const deckPrefix = item.deckId.indexOf('_') > 0
    ? item.deckId.substring(0, item.deckId.indexOf('_'))
    : item.deckId;
  return LANG_PREFIX_TO_CODE[deckPrefix] !== undefined;
});
```
and passes `allowLanguageFacts: hasLanguageItem` into `buildGeneralRunPool`. This ensures that when a custom deck intentionally mixes a Japanese vocab deck with a World History deck, the language facts are not stripped from the pool.

## Race Mode Scoring

Pure function `computeRaceScore()` in `src/services/multiplayerScoring.ts`. Uses a structural type — does not import `RunState` directly so it remains testable in isolation.

**Formula (AR-86 v1):**
```
score = (floor × 100) + (bestCombo × 50) + (correct × 10)
      − (wrong × 5) + (perfectEncounters × 200) + (totalDamage × 1)
```

| Term | Weight | Notes |
|------|--------|-------|
| `floor.currentFloor × 100` | 100/floor | Dominant term — progression is primary axis |
| `bestCombo × 50` | 50/combo | Rewards knowledge chains |
| `factsCorrect × 10` | 10/correct | Accumulates through run |
| `(factsAnswered − factsCorrect) × −5` | −5/wrong | Penalizes guessing |
| `perfectEncountersCount × 200` | 200/encounter | Bonus for 0-wrong-answer fights |
| `totalDamageDealt × 1` | 1/damage | Low weight; meaningful once wired, negligible before |

The `totalDamageDealt` weight (1) is intentionally negligible vs `floor × 100` so scoring is valid even before `turnManager` damage-tracking is wired to `RunState.totalDamageDealt`.

### RunState fields added for scoring

Three optional fields added to `RunState` in `src/services/runManager.ts`:

| Field | Type | Init | Purpose |
|-------|------|------|---------|
| `totalDamageDealt` | `number?` | `0` | Cumulative damage dealt — incremented by turnManager on hit |
| `perfectEncountersCount` | `number?` | `0` | Encounters completed with 0 wrong answers — incremented by `onEncounterComplete()` in `gameFlowController.ts` when `encounterWasFlawless` is true |
| `multiplayerMode` | `MultiplayerMode?` | `undefined` | Mode for this run; `undefined` for single-player runs |

### createRunState options added

Two optional fields added to the `options` argument of `createRunState()`:

| Option | Type | Effect |
|--------|------|--------|
| `providedSeed` | `number?` | If present, used as `runSeed` instead of `crypto.getRandomValues()`. Required for Race and Same Cards modes to ensure all players share the same seed. |
| `multiplayerMode` | `MultiplayerMode?` | Stored on `RunState.multiplayerMode`. |

## gameFlowController Race Mode Wiring

Race mode is wired into `src/services/gameFlowController.ts`. The `ActiveRunMode` union includes `'multiplayer_race'`. Module-level state:

```typescript
let multiplayerSeed: number | null = null
let multiplayerModeState: MultiplayerMode | null = null
let stopRaceBroadcastFn: (() => void) | null = null
```

| Hook | Location | Behavior |
|------|----------|----------|
| `startNewRun()` options | Expanded with `multiplayerSeed?` and `multiplayerMode?` | Sets `activeRunMode = 'multiplayer_race'` when `multiplayerMode` is provided |
| `createRunState()` call | `onArchetypeSelected()` | Passes `providedSeed` and `multiplayerMode` from module state |
| Race broadcast start | After `initRunRng()` in `onArchetypeSelected()` | `startRaceProgressBroadcast()` called; cleanup stored in `stopRaceBroadcastFn` |
| `perfectEncountersCount` | `onEncounterComplete()` after flawless check | Incremented whenever encounter ends with 0 wrong answers |
| Race finish send | `finishRunAndReturnToHub()` before cleanup | `updateLocalProgress({ isFinished: true, result })` broadcasts final state |
| Cleanup | `finishRunAndReturnToHub()` | `stopRaceBroadcastFn?.()`, then `multiplayerSeed = null`, `multiplayerModeState = null` |

`stopRaceProgressBroadcast` is exported from `multiplayerGameService.ts` (was previously module-private).

`restoreRunMode()` in `gameFlowController.ts` also accepts `'multiplayer_race'` as a valid `runMode` parameter. `runSaveService.ts` includes `'multiplayer_race'` in all three `runMode` type annotations.

## Co-op Enemy Scaling

Designed for sublinear scaling — two players at 70% quiz accuracy deal ~1.4x effective DPS, not 2x,
so HP does not scale to 2x. The 0.6 coefficient (vs naive 0.5) accounts for co-op synergy effects
pushing combined DPS above raw accuracy alone. Source: `getCoopHpMultiplier()` in `enemyManager.ts`.

| Stat | 1P | 2P | 3P | 4P |
|------|----|----|----|----|
| HP | 1.0x | 1.6x | 2.2x | 2.3x (cap) |
| Block | 1.0x | 1.6x | 2.2x | 2.8x |
| Damage Cap | 1.0x | 1.6x | 2.2x | 2.8x |
| Enemy Damage | 1.0x | 1.0x | 1.0x | 1.0x |

All three scale with formula `1.0 + (playerCount - 1) * 0.6`, with HP capped at 2.3.
Block and damage cap use the same 0.6 coefficient to stay in lockstep with HP.

Functions: `getCoopHpMultiplier()`, `getCoopBlockMultiplier()`, `getCoopDamageCapMultiplier()` in `src/services/enemyManager.ts`.

`hostCreateSharedEnemy()` in `multiplayerGameService.ts` passes `{ playerCount }` to `createEnemy()`, which calls `getCoopHpMultiplier()` internally — scaling is fully delegated to the canonical function, not computed inline.

## Co-op Enemy Attack Targeting

In co-op mode, enemy attacks hit **ALL players simultaneously** for the full (1.0×) solo damage value. This is intentional — the "scaling" comes from hitting multiple targets, not from inflating per-player damage numbers. There is no round-robin targeting in co-op.

**Implementation details (`hostResolveTurn()` in `multiplayerGameService.ts`):**
- Both `p1Hp` and `p2Hp` are decremented by `attackValue` each attack turn
- `DuelTurnResolution.enemyIntent.targetPlayerId` is always `'all'` (not a specific player ID)
- `SharedEnemyState.nextIntent.targetPlayerId` is always `'all'` — UI reads this to show attack indicators on all players
- The `targetPlayerId` field type on both interfaces is `string | 'all'`
- `DuelSession` no longer tracks a per-turn `targetPlayerId` — the field was removed when round-robin was eliminated

**Why 1.0× damage per player:** The co-op HP multiplier (1.6× for 2P) already accounts for two players hitting the same enemy. Reducing per-player attack damage would make the enemy feel weak against survivors once one player is low. Full damage keeps combat tension consistent across both players throughout the encounter.

## Co-op Exclusive Effects

All multipliers are **additive** — max combined bonus is +1.25x over base. This prevents excessive
variance that multiplicative stacking would produce. Source: `src/services/coopEffects.ts`.

| Effect | Trigger | Bonus | Duration |
|--------|---------|-------|----------|
| Synapse Link | Both players charge the same chain type | +0.5x damage | This turn |
| Guardian Shield | Play a card tagged `guardian_shield` (charged) | Block redirected to partner | This turn |
| Knowledge Share | Partner answers their quiz correctly | +0.25x damage | 1 turn |
| Team Chain Bonus | Both players have active chains | +0.5x damage | While both chains active |
| Fog Contagion | Either player answers wrong | +1 fog to BOTH players | Permanent |
| Shared Surge | Combined turn counter divisible by 4 | AP surcharge waived for both | This turn |

Active only in `coop` and `duel` modes. Initialized by `initCoopEffects()`, processed by
`processTurnActions()`, ticked by `tickEndOfTurn()`.

## Real-Time Duel Turn Flow

Host-authoritative model prevents desync. Both players submit actions each turn; host resolves:

1. Host sends `mp:duel:turn_start` with `turnNumber`
2. Both players play cards, each sends `mp:duel:cards_played`
3. Both face quiz — each sends `mp:duel:quiz_result`
4. Host collects both `DuelTurnAction` objects, calls `hostResolveTurn()`
5. `hostResolveTurn()` combines damage, applies to shared enemy, rolls next intent, broadcasts `mp:duel:turn_resolve` and `mp:duel:enemy_state`
6. Enemy attacks — ALL players take full damage simultaneously (co-op mode); `targetPlayerId: 'all'` signals this to UI
7. If enemy or player defeated, host sends `mp:duel:end`

Source: `src/services/multiplayerGameService.ts`.

## ELO System

Starting rating 1000. Standard ELO formula: `E = 1 / (1 + 10^((Rb - Ra) / 400))`.

| Constant | Value |
|----------|-------|
| Starting ELO | 1000 |
| K-factor (first 20 games) | 32 |
| K-factor (after 20 games) | 16 |
| K-factor threshold | 20 games |

Rank tiers (ascending):

| Rank | ELO Floor |
|------|-----------|
| Novice | < 800 |
| Bronze | 800 |
| Silver | 1000 |
| Gold | 1200 |
| Platinum | 1400 |
| Diamond | 1600 |
| Master | 1800 |
| Grandmaster | 2000 |

Matchmaking queue widening:

| Time in Queue | ELO Band |
|---------------|----------|
| 0-30s | ±200 |
| 30-60s | ±400 |
| 60-90s | Anyone |
| 90s+ | AI fallback |

v1 stores ratings in `localStorage`. Server-side persistence is planned when the Fastify backend ships.
Source: `src/services/eloMatchmakingService.ts`.

## Trivia Night Scoring

No combat, no cards. Pure quiz party mode for 2-8 players.

| Constant | Value |
|----------|-------|
| Base points (correct) | 1000 |
| Max speed bonus | 500 |
| Speed bonus formula | `round(500 * (1 - timingMs / timeLimitMs))` |
| Total max per question | 1500 |
| Default rounds | 15 (range: 5-30) |
| Default time limit | 15s per question |
| Reveal delay | 3s between rounds |

Source: `src/services/triviaNightService.ts`.

## Networking Architecture

- **Lobbies and matchmaking:** Fastify backend (REST + WebSocket)
- **Gameplay transport:** Steam P2P (Steamworks Networking Sockets) primary, WebSocket fallback
- **Same-screen local play:** LocalMultiplayerTransport (in-memory, no networking)
- **Two-tab dev testing:** BroadcastChannelTransport (same-origin BroadcastChannel, `?mp` URL param)
- **Anti-cheat:** Host validates quiz answers; ranked uses post-hoc replay audit

### Transport Abstraction

`src/services/multiplayerTransport.ts` defines a `MultiplayerTransport` interface with four implementations:

- `SteamP2PTransport` — wraps Tauri `steamNetworkingService.ts` bridge (10 Tauri commands)
- `WebSocketTransport` — WebSocket fallback for web/mobile
- `LocalMultiplayerTransport` — in-memory event bus for same-screen multiplayer (Race Mode or Trivia Night hot-seat, no networking required)
- `BroadcastChannelTransport` — browser BroadcastChannel for two-tab dev testing, activated by `?mp` URL param

`createTransport(mode?)` selects the implementation:
- `mode === 'local'` → `LocalMultiplayerTransport`
- `mode === 'broadcast'` → `BroadcastChannelTransport`
- `hasSteam === true` → `SteamP2PTransport`
- otherwise → `WebSocketTransport`

For same-screen play, use `createLocalTransportPair()` which returns two pre-linked instances (`[t1, t2]`). Messages sent on `t1` arrive on `t2`'s listeners via `queueMicrotask`, and vice versa.

`getMultiplayerTransport(mode?)` accepts `'auto' | 'local' | 'broadcast'` and returns the lazily-created singleton.

## Local Testing (Dev-Only)

### `addLocalBot` / `removeLocalBot` — same-machine bot testing

Two functions in `src/services/multiplayerLobbyService.ts` allow same-machine multiplayer testing without a second client, network connection, or Steam running.

#### `addLocalBot(botName?: string): void`

Call after `createLobby()`. The function:

1. Creates a linked `LocalMultiplayerTransport` pair via `createLocalTransportPair()`
2. Generates a bot player ID (`bot_<timestamp36>`) and calls `connect()` on both sides
3. Pushes the bot entry directly into `_currentLobby.players` and fires `_onLobbyUpdate`
4. Schedules a 500 ms `setTimeout` that sets `bot.isReady = true` and fires another update

The bot transport reference is held in the module-level `_botTransport` variable to prevent garbage collection while the lobby is active.

**Preconditions:** A lobby must exist (`_currentLobby !== null`) and the caller must be the host (`isHost() === true`). The function is a no-op otherwise.

#### `removeLocalBot(): void`

Filters all `bot_*` players from `_currentLobby.players`, calls `disconnect()` on the stored bot transport, nulls `_botTransport`, and fires `_onLobbyUpdate`.

#### Example usage

```typescript
import { createLobby, addLocalBot, removeLocalBot } from './multiplayerLobbyService';

const lobby = createLobby(myPlayerId, 'Host', 'race');
addLocalBot('Test Bot');    // bot appears in lobby, ready-ups in 500ms
// ... test lobby UI, allReady(), startGame() ...
removeLocalBot();           // clean up before leaving
```

### Two-Tab Testing (BroadcastChannel)

Test multiplayer with two browser tabs — no server or Steam needed.

1. Start the dev server: `npm run dev`
2. Open **Tab 1**: `http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial&mp`
3. Open **Tab 2**: `http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial&mp`
4. Tab 1: Multiplayer → Create Lobby → copy the 6-char code
5. Tab 2: Multiplayer → Join Lobby → paste the code
6. Both tabs are now in the same lobby via BroadcastChannel

The `&mp` URL parameter activates `BroadcastChannelTransport` instead of WebSocket/Steam. Both `createLobby()` and `joinLobby()` in `multiplayerLobbyService.ts` check `isBroadcastMode()` and pass `'broadcast'` to `getMultiplayerTransport()` automatically.

#### Network simulation (dev-only)

`BroadcastChannelTransport` simulates real network conditions so timing bugs that only appear on Steam relay are caught during two-tab dev testing:

| Simulation | Value | Purpose |
|-----------|-------|---------|
| Outbound latency | 30–150 ms per message | Mimics typical Steam relay RTT |
| Packet loss | 2% drop rate | Exercises retry/tolerance logic |
| Receive jitter | 5–20 ms | Mimics OS/network scheduling variance |

Constants are defined at the top of the BroadcastChannel section in `multiplayerTransport.ts` (`BC_MIN_LATENCY_MS`, `BC_MAX_LATENCY_MS`, `BC_PACKET_LOSS_RATE`) and can be tuned for stress-testing.

`isBroadcastMode()` is exported from `multiplayerLobbyService.ts` so the UI layer can show a dev-mode indicator badge when running in this simulated-network mode.

#### Player ID uniqueness

Each tab needs a distinct player ID — `generatePlayerId()` (exported from `multiplayerLobbyService.ts`) produces collision-resistant IDs using `player_<timestamp36>_<4 random chars>`. Use this instead of hardcoded strings like `'local_player'` when two tabs may be open simultaneously.

```typescript
import { generatePlayerId } from './multiplayerLobbyService';
const myId = generatePlayerId(); // e.g. 'player_lk3x2a_f7z9'
```

#### Channel naming

The BroadcastChannel name is `rr-mp:<target>` where `<target>` is the lobby ID (host) or lobby code (joiner). Self-echo is suppressed by comparing `senderId` to `localId` on each incoming message.


## Lobby Flow

1. Host creates lobby via `coopService.createLobby()` — returns `roomId` and 6-char invite code
2. Players join via code or Steam invite (`joinLobby()`)
3. Host configures mode, deck, house rules, fairness options
4. All players ready up
5. Host starts game → shared seed distributed
6. Mode service takes over (`multiplayerGameService` for Race/Duel/Co-op, `triviaNightService` for Trivia Night)

Lobby lifecycle managed by `src/services/multiplayerLobbyService.ts`.

## Screen Flow

```
hub → multiplayerMenu → (mode selected) → multiplayerLobby → (game start) → [mode-specific game]
```

`multiplayerMenu` is registered as a hub screen in `screenController.ts` (`HUB_SCREENS` set). It is accessible from the hub without an active run.

## Key Files

| File | Role |
|------|------|
| `src/data/multiplayerTypes.ts` | All shared types, constants, `MultiplayerMode` union, lobby/fairness/race types, `LobbyContentSelection`, `MODE_DESCRIPTIONS`, `MODE_TAGLINES` |
| `src/services/multiplayerScoring.ts` | `computeRaceScore()` — pure race score formula (AR-86 v1) |
| `src/services/multiplayerLobbyService.ts` | Lobby lifecycle: create, join, configure, start; `setContentSelection()` for rich content targeting; `addLocalBot()` / `removeLocalBot()` for same-machine dev testing; `generatePlayerId()` for unique tab IDs; `isBroadcastMode()` (exported) for two-tab transport selection and UI indicator |
| `src/services/multiplayerTransport.ts` | Transport abstraction (WebSocket + Steam P2P + Local + BroadcastChannel) |
| `src/services/multiplayerGameService.ts` | Race / Duel / Same Cards game sync + `DuelTurnAction` / `DuelTurnResolution` |
| `src/services/coopEffects.ts` | 6 co-op exclusive effects, damage multiplier computation |
| `src/services/coopService.ts` | Client-side REST + WebSocket facade for co-op lobby REST API |
| `src/services/eloMatchmakingService.ts` | ELO calculation, 8 rank tiers, matchmaking queue with band widening |
| `src/services/triviaNightService.ts` | Trivia Night game logic: rounds, scoring, standings |
| `src/services/steamNetworkingService.ts` | Tauri bridge for Steam P2P (10 Tauri commands) |
| `src/services/enemyManager.ts` | `getCoopHpMultiplier()`, `getCoopBlockMultiplier()`, `getCoopDamageCapMultiplier()` |
| `src/services/gameFlowController.ts` | Race mode wiring: `startNewRun()` options, broadcast lifecycle, `perfectEncountersCount` tracking |

## Implementation Status

Phases 1-3 complete as of 2026-04-07. Phase 4 (Polish) in progress.

| Phase | Status |
|-------|--------|
| Phase 1: Foundation (Steam P2P + Race Mode) | DONE |
| Phase 2: Competitive Core (Duel + Same Cards + ELO) | DONE |
| Phase 3: Social (Co-op effects + Trivia Night) | DONE |
| Phase 4: Polish (Workshop, fairness, local play) | IN PROGRESS |

See `docs/roadmap/AR-MULTIPLAYER.md` for full task breakdown.

---

## Map Node Consensus (2026-04-08)

In any multiplayer mode that shares a map, both players must agree on the next room before either client transitions. Owned by `src/services/multiplayerMapSync.ts`.

Flow:
1. Player clicks a node in `DungeonMap.svelte` → `CardApp.handleMapNodeSelect(nodeId)`.
2. If `isMultiplayerRun`, the click calls `pickMapNode(nodeId)` instead of committing immediately. This broadcasts `mp:map:node_pick` and updates the local picks store.
3. Each player's pick renders as a small initial-bearing badge above the corresponding node (`MapNode.svelte` `pickedBy` prop, threaded through `DungeonMap.nodePicks`).
4. When `_checkConsensus()` sees that every player in `getCurrentLobby().players` has picked the SAME `nodeId`, it fires the `onMapNodeConsensus` callback.
5. CardApp's consensus handler resets the picks (clearing badges) and calls `commitMapNodeSelection(nodeId)`, which runs the existing `onMapNodeSelected` + `startEncounterForRoom` flow.

Picking a different node before consensus simply replaces the previous pick — no need to "unpick" first.

Source: `src/services/multiplayerMapSync.ts`, `src/CardApp.svelte` (`handleMapNodeSelect` / `commitMapNodeSelection`), `src/ui/components/MapNode.svelte` (`pickedBy` prop), `src/ui/components/DungeonMap.svelte` (`nodePicks` prop).

### Subscription lifecycle invariant (fix 2026-04-09)

`onMapNodeConsensus()` and `onMapNodePicksChanged()` are registered ONCE by the consumer (`CardApp.svelte`) at component mount, BEFORE the game-start callback fires. They persist across `initMapNodeSync()` / `destroyMapNodeSync()` re-init cycles (which only reset run-level state — picks, local player ID, transport listener). Subscribers tear themselves down via the unsubscribe functions returned from the registration APIs when the consumer unmounts.

`destroyMapNodeSync()` MUST NOT null these UI subscription slots. Only run-level state belongs to teardown: `_picks`, `_localPlayerId`, and the transport listener cleanup. If a registration API returns an unsubscribe function, that is a strong signal the caller owns the subscription lifetime — the module must not null it from inside teardown helpers.

---

## Co-op Turn Synchronization (2026-04-08)

Co-op combat now waits for every player to end their turn before any enemy phase runs. Owned by `src/services/multiplayerCoopSync.ts`.

Flow:
1. `encounterBridge.handleEndTurn()` reads `runState.multiplayerMode`. If it's `'coop'`, sets `coopWaitingForPartner` to true and calls `awaitCoopTurnEnd()`.
2. `awaitCoopTurnEnd` sends `mp:coop:turn_end` with the local player ID, then awaits a barrier promise that resolves when every player in the lobby has signaled.
3. While waiting, the End Turn button shows `WAITING…` and is disabled, plus a `coop-waiting-banner` pulses above it.
4. Once both signals are in, the existing `endPlayerTurn(turnState)` runs locally on each client. The 2-second pre-attack visual delay still applies (`turboDelay(2000)`).
5. After the local player's HP is updated post-damage, `broadcastPartnerState({hp, maxHp, block})` sends `mp:coop:partner_state`. Each receiving client updates its `MultiplayerHUD` with the partner's new HP via the `onPartnerStateUpdate` callback wired in `CardApp.svelte`.

Key invariants:
- Each client runs its OWN enemy locally (no host-authoritative resolution). Determinism comes from the shared run seed plus the new `'enemyVariance'` RNG fork — both clients see the same enemy template AND the same HP for that enemy.
- The barrier has a 30s timeout safety net. If a partner disconnects, the local turn resolves anyway after the timeout to avoid hanging.
- Partner HP appears in the existing `MultiplayerHUD` panel by writing into the `opponentProgress` Svelte state (just the `playerHp`/`playerMaxHp` fields).

Source: `src/services/multiplayerCoopSync.ts`, `src/services/encounterBridge.ts` (`handleEndTurn`, `coopWaitingForPartner` store), `src/CardApp.svelte` (init/destroy + partner subscription), `src/ui/components/CardCombatOverlay.svelte` (`coopWaitingForPartner` UI binding).

---

## Enemy Variance Determinism (2026-04-08)

Common and elite enemies receive a `0.85-1.15×` HP/damage variance roll in `encounterBridge.ts`. Until 2026-04-08 this used unseeded `Math.random()`, which broke co-op enemy parity (both players saw the same enemy template at the same node but with different HP values).

The variance now reads from a dedicated `'enemyVariance'` seeded RNG fork via `getRunRng('enemyVariance')`. Two clients with the same shared run seed produce identical enemy HP for every node. Boss enemies still use a flat `1.0` variance.

Source: `src/services/encounterBridge.ts:586` (`difficultyVariance` calculation), `src/services/seededRng.ts` (`getRunRng` fork API). Tests: `tests/unit/multiplayerSync.test.ts`.

---

## Future Co-op Combat Enhancements

> **Status: NOT IMPLEMENTED — design ideas for post-launch co-op depth.**
> These are recorded here for design continuity. None of these systems exist in source code yet.

### Aggro / Taunt Mechanics

Players would be able to intentionally draw enemy focus — creating a "tank" role in co-op encounters.

- A player who taunts becomes the enemy's preferred attack target for N turns
- Cards tagged `taunt` or a dedicated co-op card mechanic would activate aggro
- Synergizes with the existing `guardian_shield` effect: tank builds block, shields partner
- Tactical depth: decide which player absorbs punishment so the other can deal damage freely
- Implementation scope: new intent targeting logic in `enemyManager.ts`, new `coopEffects.ts` entry, taunt status effect

### Co-op-Specific Enemy Intents

Enemies in co-op encounters could have distinct multi-target attack patterns that do not exist in single-player:

| Intent Pattern | Description |
|---------------|-------------|
| "Attacks both players for 5" | Each player takes 5 damage — total 10 outgoing |
| "Attacks one player for 8" | Enemy picks a target (or taunted player); partner unharmed |
| "Cleaves all for 6" | Hits every player, distributed or full depending on split rules |

This creates genuine tactical decisions around positioning (who blocks, who attacks) that are absent from the current "enemy attacks one target round-robin" model.

Implementation scope: extend the `EnemyIntent` type with a `targeting` field (`'single' | 'aoe_full' | 'aoe_split'`) and update `hostResolveTurn()` in `multiplayerGameService.ts` to dispatch damage accordingly.

### Split Damage AoE Attacks

A subset of AoE attacks would divide their total damage pool across all players rather than dealing full damage to each:

- Enemy with "Volcanic Slam — 12 split" hits two players for 6 each (not 12 each)
- Incentivizes spreading out rather than everyone playing defensively
- Differentiates from cleave attacks (which deal full damage to each target)
- Prevents AoE from being trivially punishing at 4P (total incoming would be ×4 otherwise)
- Implementation scope: `targeting: 'aoe_split'` intent variant + `splitDamageAcrossPlayers()` helper in `multiplayerGameService.ts`

### Design Notes

These three systems are designed to work together as a coherent co-op combat layer:

1. Taunt lets a tank player absorb split AoE predictably
2. Co-op intents create varied combat puzzles where the answer changes based on who is targeted
3. Split damage keeps AoE from feeling punishing at higher player counts

None of these require changes to the quiz or card systems — they are purely enemy-side targeting upgrades and one new status effect (taunt).
