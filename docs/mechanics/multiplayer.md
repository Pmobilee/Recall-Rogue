# Multiplayer Mechanics

> **Source files:** `src/services/multiplayerGameService.ts`, `src/services/multiplayerLobbyService.ts`, `src/services/multiplayerTransport.ts`, `src/services/coopEffects.ts`, `src/services/coopService.ts`, `src/services/eloMatchmakingService.ts`, `src/services/triviaNightService.ts`, `src/services/steamNetworkingService.ts`, `src/data/multiplayerTypes.ts`, `src/services/enemyManager.ts`, `src/services/multiplayerScoring.ts`, `src/services/multiplayerWorkshopService.ts`
> **Master tracking doc:** `docs/roadmap/AR-MULTIPLAYER.md`
> **Last verified:** 2026-04-20 (#79/#80/#81 wave-5 fixes + M23 typed IPC + L4 kick scaffolding) — Previous: #71/#73/#74/#75/#76 wave-4. Latest: #79 initRaceMode wired into gameFlowController, #80 real opponent Elo rating from lobby, #81 workshop deck gate wired in MultiplayerLobby.svelte. M23: typed invokeSteam IPC wrapper. L4: kickPlayer + vote-kick stubs + onLobbyError callback. See changelog section below.

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
  | { type: 'study'; deckId: string; subDeckId?: string; deckName: string }       // @deprecated
  | { type: 'trivia'; domains: string[]; subdomains?: Record<string, string[]> }  // @deprecated
  | { type: 'custom_deck'; customDeckId: string; deckName: string }
  | {
      type: 'study-multi';
      decks: Array<{ deckId: string; deckName: string; subDeckIds: string[] | 'all' }>;
      triviaDomains: string[];
    }
```

| Variant | Use case | Status |
|---------|----------|--------|
| `study` | Single curated deck, optionally narrowed to one sub-deck | @deprecated — use `study-multi` |
| `trivia` | Trivia Dungeon — one or more knowledge domains | @deprecated — use `study-multi` |
| `custom_deck` | Player-owned personal/Anki-imported deck | Active |
| `study-multi` | Multi-deck selection: one or more curated study decks (optionally narrowed to sub-deck ID lists) plus optional trivia domains. Introduced Issue 2 (2026-04-11). Use for all new lobby content code. | Active (preferred) |

`study-multi` is produced by `buildStudyMultiSelection()` in `src/ui/utils/lobbyDeckSelection.ts`.
Selection state persists across tab switches in `LobbyDeckPicker.svelte` via a `Map<deckId, Set<subDeckId> | "all">` — reassignment-based (never in-place mutation) to trigger Svelte 5 reactivity.

**Fact-pool mapping — `study-multi` to `DeckMode`** (Issue 2 game-logic followup, 2026-04-11):

`DeckMode` now has a native `study-multi` variant in `src/data/studyPreset.ts`. The `mp:lobby:start` handler in `CardApp.svelte` wires it directly:

```typescript
playerSave.update(s => s ? {
  ...s,
  activeDeckMode: { type: 'study-multi', decks: sel.decks, triviaDomains: sel.triviaDomains },
} : s)
```

Pool assembly in `encounterBridge.ts` (`study-multi` branch):

| Source | Pool builder used |
|--------|------------------|
| Curated deck entry (`subDeckIds === 'all'`) | `buildLanguageRunPool` or `buildGeneralRunPool`, same logic as `custom_deck` |
| Curated deck entry (partial subdeck list) | Same builder, then filtered to the matching subdeck fact IDs |
| Trivia domain | `buildPresetRunPool({ [domain]: [] })` per domain |
| Combined | All cards merged and deduplicated by `factId` (first-seen insertion order) |

Empty `decks` + empty `triviaDomains` → empty pool, no crash. Trivia-domain facts are resolved via `factsDB` (not `curatedDeckStore`) in narrative lookups and wowFactorService.

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

## Race Mode Fixes & Improvements (2026-04-20)

### H1 — Deterministic tie-breaker

`determineRaceWinner(a, b, startMs)` in `multiplayerGameService.ts` replaces the old `localScore >= opponentScore ? localId : opponentId` one-liner. Hierarchy (both clients produce identical results):

1. Higher `score`
2. Higher `floor`
3. Higher `accuracy`
4. Lower duration (`finishedAt - startMs`), lower is better
5. Lexicographic `playerId` (tiebreaker of last resort)

Returns `null` only when every axis is identical (true tie — astronomically unlikely).

### M8 — Opponent finishedAt timestamp

`RaceProgress` now carries `finishedAt?: number` (epoch ms). Set at the exact moment `isFinished` flips `true` — both the interval tick path and the `updateLocalProgress()` path stamp it. `_tryEmitRaceResults()` uses `opponentProgress.finishedAt` for the opponent's duration (not local clock), giving an accurate wall-clock measurement.

### M9 — Real correct/wrong counts

`RaceProgress` now carries `correctCount?: number` and `wrongCount?: number`. `_tryEmitRaceResults()` uses these when present; falls back to the `encountersWon * 3` proxy only for old peers that don't send counts.

Call `recordRaceAnswer(factId, correct)` on each quiz answer during a race run to populate the tracker.

### H6 — FSRS batch update on race finish

Race quiz answers now update the local FSRS scheduler. `recordRaceAnswer()` accumulates correct/wrong fact IDs during the run. On race finish (when `isFinished` flips true), `_applyRaceFsrsBatch()` calls `updateReviewState()` from `playerData.ts` for each fact — one shot, not per-answer.

Race results DO update the FSRS scheduler — answers count toward long-term learning, batch-written on race finish.

**Wiring site (H6, 2026-04-20):** `handlePlayCard()` in `encounterBridge.ts` now routes through `recordRaceAnswer(factId, correct)` instead of `updateReviewStateByButton()` when `run.multiplayerMode === 'race'` or `'same_cards'`. Single-write semantics: the per-answer `updateReviewStateByButton` path (which carries timing and speed-bonus metadata) is skipped entirely in race modes; FSRS is written once at race end by `_applyRaceFsrsBatch()`. The richer metadata is not available at batch time — acceptable per the H6 design intent.

Note: if the import path `../ui/stores/playerData` changes, update `_applyRaceFsrsBatch()` accordingly.

### H12 — Scene-lifecycle cleanup guard

`startRaceProgressBroadcast()` now returns `{ stop, isActive }` (plus backward-compat callable). An `_raceProgressActive` flag is checked inside each interval tick — if `stop()` was called before the tick fires, the tick is a no-op instead of calling `getProgress()` on a destroyed object.

### M11 — Mode-specific scoring

`calculateScoreForMode(mode, stats)` computes scores per mode:

| Mode | Formula |
|------|---------|
| `race` / `same_cards` / `coop` | `floors*100 + damage + chain*50 + correct*10 - wrong*5 + perfectEncounters*200` |
| `trivia_night` | `correctCount*100 + speedBonusTotal - wrongCount*25` |
| `duel` | `(survived ? 1000 : 0) + damageDealt - damageTaken + correctCount*50` |

### H10 — Message type union + peer-presence monitoring (2026-04-20)

**Union additions.** Five message types were missing from `MultiplayerMessageType` in `multiplayerTransport.ts`, requiring `as MultiplayerMessageType` casts at every call site. They are now first-class members:

| Type | Used by |
|------|---------|
| `mp:lobby:peer_left` | `multiplayerLobbyService.ts` — marks player `connectionState='reconnecting'`, starts 60s grace timer |
| `mp:lobby:peer_rejoined` | `multiplayerLobbyService.ts` — cancels grace timer |
| `mp:lobby:start_ack` | Guest clients ACK the game-start event (H5) |
| `mp:workshop:deck_check` | `multiplayerWorkshopService.ts` — host verifies all players have the workshop deck |
| `mp:workshop:deck_check_ack` | Workshop deck-check response |

**`initPeerPresenceMonitor(localPlayerId, getPeerIds, transport): () => void`** — exported from `multiplayerTransport.ts`. Implements a JS-only fallback for detecting disconnected peers without server-side or Rust callback involvement:

1. Every `PEER_PING_INTERVAL_MS` (15 s), sends `mp:ping` to all known peers.
2. Auto-responds to incoming `mp:ping` with `mp:pong` (so the remote side's monitor sees us as alive).
3. Updates `_peerLastSeen` Map on each `mp:pong` received.
4. On each interval tick, any peer whose last-seen timestamp is `> PEER_PONG_TIMEOUT_MS` (30 s) stale gets a locally-emitted `mp:lobby:peer_left` — triggering the lobby service's grace timer.

Returns a cleanup function — call it when leaving the lobby to cancel the interval and clear peer state.

**`updatePeerLastSeen(peerId)`** — call this whenever the lobby service receives any message from a peer to reset the stale-timer (e.g. on `mp:lobby:peer_rejoined`).

```
TODO(H10-transport): Replace with Fastify server-side broadcast on WS onclose and
Rust P2PSessionConnectFail_t callback once those plumbing changes ship.
```

## Wave-4 Bug Fixes (2026-04-20)

### #74 — initRaceMode: prevent fact leakage between races

`initRaceMode(localPlayerId: string): void` — new export from `multiplayerGameService.ts`. Clears all
race-session accumulators before a race starts:
- `_raceLocalPlayerId` ← `localPlayerId`
- `_raceCorrectFactIds` ← `[]`
- `_raceWrongFactIds` ← `[]`
- `_opponentProgress` ← `null`
- `_localProgress` ← `null`
- `_localFinished` ← `false`
- `_localStartMs` ← `0`

Previously, if a player ran two back-to-back races in the same session, fact IDs from the first race
accumulated in `_raceCorrectFactIds` / `_raceWrongFactIds`. The FSRS batch at the end of the second
race would double-count those facts. Call `initRaceMode()` before the race starts (not `startRaceProgressBroadcast`,
which also resets some state but is called later in the flow).

### #75 — Double-init guard for initPeerPresenceMonitor

`initPeerPresenceMonitor()` in `multiplayerTransport.ts` now stores its cleanup in module-level
`_peerMonitorCleanup`. On each new call, the previous cleanup is invoked first — preventing duplicate
ping intervals and listener accumulation if `initPeerPresenceMonitor` is called more than once
(e.g. on lobby rejoin or transport re-init).

The returned cleanup function self-nulls `_peerMonitorCleanup` only when the reference matches the
current cleanup (avoids nulling a newer monitor if re-init raced).

### #76 — Peer presence monitor wired from multiplayerLobbyService

`initPeerPresenceMonitor(localPlayerId, getPeerIds, transport)` is now called from all three
lobby entry points in `multiplayerLobbyService.ts` immediately after `transport.connect()`:

- `createLobby()` — host side
- `joinLobby()` — join by code
- `joinLobbyById()` — join by browser entry

The returned cleanup is stored in module-level `_peerMonitorTeardown`. `leaveLobby()` calls
`_peerMonitorTeardown()` before clearing transport state.

The `getPeerIds` callback reads `_currentLobby.players`, filtering out the local player ID, so the
monitor always has an up-to-date peer list even as players join/leave.

### #73 — Elo rating applied at race and duel end

When `getCurrentLobby()?.isRanked === true`, Elo is now applied at the end of each match:

| Location | Applies to |
|---|---|
| `_tryEmitRaceResults()` | Race mode (both local and opponent finish) |
| `hostResolveTurn()` (inside `if (isOver)`) | Duel — host path |
| `mp:duel:end` handler (inside `!_duelState?.isHost` guard) | Duel — client path |

Uses `applyEloResult(localRating, oppRating, outcome)` from `multiplayerElo.ts`. Opponent rating
is read from `lobby.players.find(p => p.id === opponentId)?.multiplayerRating ?? 1500` (resolved
by fix #80 — see Wave-5 section below).

Outcome mapping: `winnerId === localId` → `'win'`; `winnerId === null` → `'tie'`; else → `'loss'`.

### #71 — Workshop deck gate + host self-check fix

**`canStartLobby` / `startButtonLabel` — `workshopDecksReady` parameter:**
Both functions in `src/ui/utils/lobbyStartGate.ts` now accept an optional third parameter
`workshopDecksReady: boolean = true`. When `false`, `canStartLobby` returns `false` and
`startButtonLabel` returns `"Waiting for Workshop deck..."`. Callers without the third argument
are fully backward-compatible.

**`checkAllPlayersHaveWorkshopDeck` host self-check fix:**
`checkAllPlayersHaveWorkshopDeck(workshopItemId, playerIds, localPlayerId?)` in
`multiplayerWorkshopService.ts` now accepts an optional third parameter `localPlayerId`. When
provided:
- If `localPlayerId` is in `playerIds` AND `getInstalledWorkshopDecks()` finds the deck locally,
  the host is pre-added to `confirmed` before broadcasting `mp:workshop:deck_check`.
- This fixes the bug where the host was always listed as `missing` because transport messages
  don't loop back to the sender — the host never received its own `deck_check_ack`.

## Wave-5 Bug Fixes (2026-04-20)

### #79 — initRaceMode wired into gameFlowController before broadcast

Previously `initRaceMode()` was an exported function in `multiplayerGameService.ts` (added in #74) but was never called from `gameFlowController.ts`. The START path of `onArchetypeSelected()` entered `startRaceProgressBroadcast()` without first clearing the fact accumulators, so back-to-back races in the same session leaked `_raceCorrectFactIds` / `_raceWrongFactIds` from the previous run into the FSRS batch at the end of the new run.

**Fix:** Inside the `if (activeRunMode === 'multiplayer_race')` block in `onArchetypeSelected()`, `initRaceMode(getLocalMultiplayerPlayerId())` is now called **before** `stopRaceBroadcastFn = startRaceProgressBroadcast(...)`. This ensures accumulators and the stored `_raceLocalPlayerId` are fresh for every new race.

Two new imports in `gameFlowController.ts`:
- `initRaceMode` added to the named import from `./multiplayerGameService`
- `getLocalMultiplayerPlayerId` added to the named import from `./multiplayerLobbyService`

**Test coverage:** `src/services/gameFlowController.race-init.test.ts` — 5 source-invariant assertions:
1. `initRaceMode` is in the named import from `multiplayerGameService`
2. `getLocalMultiplayerPlayerId` is in the named import from `multiplayerLobbyService`
3. `initRaceMode(getLocalMultiplayerPlayerId())` is present in source
4. `initRaceMode` call appears before `startRaceProgressBroadcast` in source order
5. Both calls are inside the same `if (activeRunMode === 'multiplayer_race')` conditional

### #80 — Real opponent Elo rating broadcast in LobbyPlayer

Elo deltas at match end were computed with a hardcoded opponent rating of `1500` at all three apply
sites (`_tryEmitRaceResults`, `hostResolveTurn`, `mp:duel:end` handler). All `TODO(opp-rating-broadcast)`
comments are removed.

**`LobbyPlayer` — new optional field:**
```typescript
multiplayerRating?: number;  // populated from getLocalMultiplayerRating() on join
```
Back-compat: field is optional; peers that have not updated omit it and the `?? 1500` fallback applies.

**`multiplayerLobbyService.ts` — populated on join:**
`getLocalMultiplayerRating()` (from `multiplayerElo.ts`) is written into `multiplayerRating` on the
local player object in `createLobby()`, `joinLobby()`, and `joinLobbyById()`. All three lobby-entry
paths populate the field so every peer broadcasts their real rating immediately on join.

**`multiplayerGameService.ts` — three hardcoded `1500` values replaced:**
```typescript
// before
const oppRating = 1500;

// after
const oppRating = lobby.players.find(p => p.id === opponentId)?.multiplayerRating ?? 1500;
```
Applied in `_tryEmitRaceResults()`, `hostResolveTurn()` (duel-end block), and the `mp:duel:end`
message handler.

**Test coverage:** `src/services/multiplayerGameService.test.ts` — `describe('#80: ...)`:
- Fallback expression returns `1500` when `multiplayerRating` field is absent
- Returns real rating when field is present (e.g. 1750)
- `getCurrentLobby` mock returns `multiplayerRating: 1800` when configured

### #81 — Workshop deck gate wired in MultiplayerLobby.svelte

Previously `canStartLobby` accepted a `workshopDecksReady` parameter (#71) but `MultiplayerLobby.svelte`
never passed it — always defaulting to `true`, so the gate was silently bypassed.

**`src/ui/components/MultiplayerLobby.svelte` — new state and effect:**
```svelte
let workshopDecksReady = $state(true)
let workshopMissingPlayerIds = $state<string[]>([])

$effect(() => {
  // Re-fires when lobby.players.length or contentSelection.workshopItemId changes
  // Calls checkAllPlayersHaveWorkshopDeck(), sets both state vars
})
```

The `$effect` fires whenever `lobby.players.length` or `contentSelection.workshopItemId` changes.
For non-workshop content types the effect short-circuits, leaving `workshopDecksReady = true`.

`canStart` derived value and both `startButtonLabel()` call-sites now pass `workshopDecksReady`.

**Warning text:** When `workshopMissingPlayerIds.length > 0`, an orange warning block renders below
the Start button listing which players still need to install the Workshop deck by display name.


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
| Race broadcast start | After `initRunRng()` in `onArchetypeSelected()` | `initRaceMode(getLocalMultiplayerPlayerId())` first (#79), then `startRaceProgressBroadcast()`; cleanup stored in `stopRaceBroadcastFn` |
| `perfectEncountersCount` | `onEncounterComplete()` after flawless check | Incremented whenever encounter ends with 0 wrong answers |
| Race finish send | `finishRunAndReturnToHub()` before cleanup | `updateLocalProgress({ isFinished: true, result })` broadcasts final state |
| Cleanup | `finishRunAndReturnToHub()` | `stopRaceBroadcastFn?.()`, then `multiplayerSeed = null`, `multiplayerModeState = null` |
| **M18: ascension level** | `onArchetypeSelected()` | When `multiplayerModeState !== null`, reads `getCurrentLobby()?.houseRules?.ascensionLevel` (clamped to [0, 20]) instead of the local player's saved ascension level. Falls back to `getAscensionLevel(ascensionMode)` for solo runs. |

`stopRaceProgressBroadcast` is exported from `multiplayerGameService.ts` (was previously module-private).

### M18 — Lobby ascension level (2026-04-20)

In multiplayer, ascension difficulty is set by the host in `HouseRules.ascensionLevel` (0 = off, 1–20). `onArchetypeSelected()` in `gameFlowController.ts` now reads this when `multiplayerModeState !== null` and a lobby is active, clamping to [0, 20] and using it as `selectedAscensionLevel` for `createRunState()`. Solo runs continue to use `getAscensionLevel(ascensionMode)` unchanged.

This ensures all players in the same lobby run identical ascension modifiers regardless of their local solo settings.

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

## Co-op Real-Time Enemy HP Broadcast (2026-04-10)

In co-op mode, the partner's enemy HP display was previously only updated at turn-end reconciliation. During the active player's turn, the passive partner saw stale enemy HP values until the full `mp:coop:enemy_state` snapshot arrived at barrier completion.

**Fix:** After each card play in `handlePlayCard` (`encounterBridge.ts`), a lightweight `mp:coop:enemy_hp_update` message is sent when `run.multiplayerMode === 'coop'`. The passive partner receives it and immediately updates their Phaser scene and TurnState.

**Message type:** `mp:coop:enemy_hp_update` — payload `{ currentHP: number; maxHP: number }`

**Functions added to `multiplayerCoopSync.ts`:**
- `broadcastEnemyHpUpdate(currentHP, maxHP)` — sends the lightweight message; called from `handlePlayCard`
- `onEnemyHpUpdate(cb)` — subscribe to incoming updates; returns unsubscribe function

**Subscriber wiring in `encounterBridge.ts`:**
- `startEncounterForRoom` subscribes at encounter start, stores unsub in `_unsubCoopEnemyHpUpdate`
- The subscriber updates `activeTurnState` and calls `liveScene.updateEnemyHP()` immediately
- Old subscriber is cleaned up on each new encounter start

**Message ordering:** The lightweight per-play HP update and the full `mp:coop:enemy_state` turn-end reconcile coexist. The turn-end reconcile is authoritative — it overwrites any optimistic HP state from the per-play updates. This maintains host-authoritative correctness while providing real-time visual feedback.

## Co-op End-Turn Cancel Flow (Issue 9, 2026-04-11)

In co-op mode, ending a turn has two phases:

**Phase A — Announce:** `handleEndTurn()` (in `encounterBridge.ts`) sends the turn-end signal via `awaitCoopTurnEndWithDelta(delta)` and enters a barrier wait. At this point the player's hand **has not been discarded** and the enemy phase **has not run**. `coopWaitingForPartner` is set to `true`.

**Phase B — Apply:** After all players signal (barrier releases), `endPlayerTurn()` runs: block decay, enemy phase, discard, draw. This is the same code as solo mode.

**Cancel path:** While in Phase A, if the player wants to resume play (e.g. they forgot to play a card), `cancelEndTurnRequested()` in `encounterBridge.ts` returns the player to normal play.

| Return value | Meaning |
|---|---|
| `'cancelled'` | Success — barrier cancelled, hand intact, `coopWaitingForPartner` cleared |
| `'not_in_coop'` | Run is not co-op mode — cancel not applicable |
| `'no_barrier'` | No barrier in flight — safe to call idempotently |
| `'empty_hand'` | Player ended their turn with an empty hand — nothing to restore, cancel disabled |

**Empty-hand rule:** If the player played all their cards before ending the turn, `cancelEndTurnRequested()` returns `'empty_hand'` and the barrier continues. The UI should show "Waiting…" (disabled) instead of a "Cancel" button.

**Network message:** On success, `mp:coop:turn_end_cancel` is broadcast to partners via `cancelCoopTurnEnd()` in `multiplayerCoopSync.ts`. The receiving partner's `mp:coop:turn_end_cancel` handler removes the cancelling player from `_turnEndSignals`, preventing the barrier from releasing until they re-signal.

**Functions added (2026-04-11):**
- `cancelEndTurnRequested()` in `encounterBridge.ts` — the UI-callable cancel with empty-hand guard
- `sendTurnEndCancel()` in `multiplayerCoopSync.ts` — explicit alias for `cancelCoopTurnEnd()` per Issue 9 naming convention

**Key architectural property:** No snapshot or restore is needed. The hand was never discarded. When `awaitCoopTurnEndWithDelta` resolves with `'cancelled'`, `handleEndTurn()` returns early (line 1437) and the TurnState is unchanged.

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

### H2 — Both-defeated outcome

When both players die simultaneously from the same enemy attack, `DuelTurnResolution.winnerId` is `null` (was: arbitrary tie-break using total damage). `reason` is `'both_defeated'`. Result consumers (UI, scoring) must treat `null` winner as **"Tie"**.

`DuelTurnResolution.winnerId` type is now `string | null`.

### M10 — Duel action validation

`submitDuelTurnAction()` and the `mp:duel:cards_played` incoming handler both clamp:
- `damageDealt = Math.max(0, action.damageDealt)`
- `blockGained = Math.max(0, action.blockGained)`

A `console.warn` is logged if the original value was negative. Prevents bad network payloads from corrupting the host's accumulated damage totals.

### H7 — Fork seed resend on late guest join

`onPlayerJoinMidGame(playerId)` re-broadcasts the current fork seeds to all players. Guests that already applied the seeds treat the re-broadcast as idempotent (same fork positions overwrite with same values — no divergence).

`applyReceivedForkSeeds()` is safe to call multiple times with the same seeds.

## Co-op Partner State Broadcasting

**Source:** `src/services/multiplayerCoopSync.ts`, `src/CardApp.svelte`

Partner HP, block, score, and accuracy are broadcast to the other player's HUD via `mp:coop:partner_state`.

### Broadcast sources

| Source | Timing | What triggers it |
|--------|--------|------------------|
| `CardApp.svelte $effect` | Any change to `$activeRunState` or `$activeTurnState` | Live mid-turn (card plays, damage, block changes) |
| `encounterBridge.handleEndTurn()` | Mid-beat-2 (after HP commit) | Turn end, damage confirmed |

The `$effect` in `CardApp.svelte` is the primary broadcast path for live updates. It fires whenever `activeRunState.playerHp`, `activeTurnState.playerState.shield`, or any scoring field changes:

```typescript
$effect(() => {
  if (currentLobby?.mode !== 'coop') return
  const run = $activeRunState
  if (!run) return
  const turn = $activeTurnState
  const block = turn?.playerState?.shield ?? 0
  broadcastPartnerState({ hp: run.playerHp, maxHp: run.playerMaxHp, block, score, accuracy })
})
```

The turn-end broadcast (in `encounterBridge`) is retained as a supplemental broadcast — it fires specifically when HP commits at Beat 2 and is the authoritative post-damage value.

### PartnerState vs RaceProgress

- `PartnerState` (from `multiplayerCoopSync`) — live wire from the transport layer: `{ playerId, hp, maxHp, block, score?, accuracy? }`
- `RaceProgress` (from `multiplayerTypes`) — UI-facing state in `CardApp`: includes `playerBlock?: number` (added 2026-04-09) for the MultiplayerHUD shield display
- The `onPartnerStateUpdate` callback in `CardApp` maps `PartnerState` → `RaceProgress` including `playerBlock: partner.block`

## Deterministic Enemy Assignment (Map Generation RNG Purity)

**Source:** `src/services/mapGenerator.ts`, `src/services/floorManager.ts`

Both co-op peers must produce identical `node.enemyId` assignments from the same `runSeed`. This requires map generation to use a **purely local RNG** — not the global `getRunRng('enemies')` fork.

### Fix (2026-04-09)

`pickCombatEnemy(floor, rngFn?)` and `getMiniBossForFloor(floor, rngFn?)` accept an optional `rngFn: () => number` parameter. When provided, it is used instead of `getRunRng('enemies')`. Existing call sites that pass no `rngFn` keep their current runtime behavior.

`assignEnemyIds()` in `mapGenerator.ts` passes the local `mulberry32(seed)` RNG through:

```typescript
// mapGenerator.ts — assignEnemyIds
case 'combat': node.enemyId = pickCombatEnemy(derivedFloor, rng); break
case 'elite':  node.enemyId = getMiniBossForFloor(derivedFloor, rng); break
case 'boss':   node.enemyId = pickBossForFloor(bossFloor, rng()); break
```

**Result:** identical `runSeed` → identical map → identical `node.enemyId` on both peers, regardless of any asymmetric global fork consumption (UI hovers, tooltip previews, etc.).

**Test coverage:** `src/services/mapGenerator.test.ts` — `'enemy IDs are identical when generated with the same seed regardless of global fork consumption'`; `src/services/floorManager.test.ts` — isolation tests for `pickCombatEnemy` and `getMiniBossForFloor`.

## ELO System

Two ELO implementations co-exist:

### eloMatchmakingService.ts (matchmaking)

Starting rating 1000, K-factor split at 20 games. Manages match history and rank tiers. Used for pre-game matchmaking queue.

### multiplayerElo.ts (per-match deltas)

Simple per-match Elo for applying deltas at race/duel end. `DEFAULT_RATING = 1500`, `K_FACTOR = 32` (fixed, no split).

API:
- `computeEloDelta(localRating, opponentRating, outcome)` — signed integer delta
- `applyEloResult(localRating, opponentRating, outcome)` — `{ newLocal, newOpponent, localDelta, opponentDelta }`
- `getLocalMultiplayerRating()` — reads `ProfileService.getActiveProfile().multiplayerRating`; returns `DEFAULT_RATING` (1500) when no profile is active.
- `persistLocalMultiplayerRating(rating)` — writes via `profileService.updateProfile(id, { multiplayerRating })` and persists immediately; no-op when no profile is active.

Ratings persist in `PlayerProfile.multiplayerRating` (default 1500). Profiles created before this field was added auto-migrate to 1500 on next load via `migrateProfile()` in `profileService.ts`.

When `lobby.isRanked === true`, apply Elo delta at race/duel end by calling `applyEloResult()`.

### eloMatchmakingService.ts rank tiers (for ranked lobby display)

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
| Speed bonus formula | `round(500 * max(0, 1 - clamp(timingMs,1,timeLimitMs+2000) / timeLimitMs))` |
| Total max per question | 1500 |
| Default rounds | 15 (range: 5-30) |
| Default time limit | 15s per question |
| Reveal delay | 3s between rounds |
| Late-answer grace window | 2s beyond time limit (`ANSWER_GRACE_MS`) |

### Fact pool deduplication

When the host calls `initTriviaGame(players, rounds, true, factPool)` with a non-undefined
`factPool`, the service tracks used fact IDs per game and refuses to repeat any fact. If all
facts have been asked and the host requests another question, `onTriviaPoolExhausted` fires
and the game transitions to `finished` with `reason: 'empty_pool'` in the broadcast.

`factPool = undefined` (default) disables the guard entirely.

### allIncorrect flag

`TriviaRoundResult.allIncorrect` is `true` when every player timed out or answered wrong.
Included in the `mp:trivia:scores` broadcast for UI feedback (e.g. "Nobody knew that one!").

### Late-answer handling

Answers with `timingMs > timeLimitMs + ANSWER_GRACE_MS (2000ms)` are forced to `selectedIndex = -1`
(timeout, 0 points). `calculateTriviaPoints` clamps timing before computing the speed bonus to
prevent bogus values from 0ms, negative, or over-limit inputs.

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

### Start Game UI Gate (Issue 1, 2026-04-11)

The "Start Game" button in `MultiplayerLobby.svelte` is disabled until **all three** conditions are met:

1. The local player is the host (`lobby.hostId === localPlayerId`).
2. At least 2 players are present (`lobby.players.length >= 2`).
3. All players have marked themselves ready (`lobby.players.every(p => p.isReady)`).
4. Content has been selected (`lobby.contentSelection !== null`).

The gate is implemented as a pure exported function `canStartLobby(lobby, amHost, workshopDecksReady?)` in
`src/ui/utils/lobbyStartGate.ts`. This allows unit testing without mounting the Svelte component.

`workshopDecksReady` defaults to `true` so non-Workshop lobbies are unaffected. Pass `false` while
`checkAllPlayersHaveWorkshopDeck()` is running or returned a non-empty `missing` array (#71).

The button label uses a companion function `startButtonLabel(lobby, amHost, workshopDecksReady?)` that reflects gate state:

| Gate state | Label |
|---|---|
| Local player is not host | `"Waiting for host..."` |
| No content selected | `"Choose Content First"` |
| Not all players ready | `"Waiting for players..."` |
| `workshopDecksReady === false` | `"Waiting for Workshop deck..."` |
| All gates pass | `"Start Game"` |

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
| `src/services/multiplayerLobbyService.ts` | Lobby lifecycle: create, join, configure, start; `setContentSelection()` for rich content targeting; `addLocalBot()` / `removeLocalBot()` for same-machine dev testing; `generatePlayerId()` for unique tab IDs; `isBroadcastMode()` (exported) for two-tab transport selection and UI indicator; `clearLanModeOnHubEntry()` (C4); `leaveMultiplayerLobbyForSoloStart()` (M20) |
| `src/ui/utils/lobbyStartGate.ts` | Pure predicates `canStartLobby(lobby, amHost)` and `startButtonLabel(lobby, amHost)` — gate for "Start Game" button; unit-tested in `src/ui/utils/lobbyStartGate.test.ts` |
| `src/services/multiplayerTransport.ts` | Transport abstraction (WebSocket + Steam P2P + Local + BroadcastChannel) |
| `src/services/multiplayerGameService.ts` | Race / Duel / Same Cards game sync + `DuelTurnAction` / `DuelTurnResolution` |
| `src/services/coopEffects.ts` | 6 co-op exclusive effects, damage multiplier computation |
| `src/services/coopService.ts` | Client-side REST + WebSocket facade for co-op lobby REST API |
| `src/services/eloMatchmakingService.ts` | ELO calculation, 8 rank tiers, matchmaking queue with band widening |
| `src/services/triviaNightService.ts` | Trivia Night game logic: rounds, scoring, standings |
| `src/services/steamNetworkingService.ts` | Tauri bridge for Steam P2P (10 Tauri commands) |
| `src/services/enemyManager.ts` | `getCoopHpMultiplier()`, `getCoopBlockMultiplier()`, `getCoopDamageCapMultiplier()` |
| `src/services/gameFlowController.ts` | Race mode wiring: `startNewRun()` options, broadcast lifecycle, `perfectEncountersCount` tracking |
| `src/services/multiplayerWorkshopService.ts` | Workshop deck browsing, voting, Deck of the Day, post-match ratings; `checkAllPlayersHaveWorkshopDeck()` pre-flight (H16); `validateWorkshopDeckMetadata()` (M14); `initWorkshopMessageHandlers()` transport listener wiring |

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

## Co-op Turn Synchronization

`src/services/multiplayerCoopSync.ts` manages the turn-end barrier between co-op players.

### PartnerState interface

```typescript
export interface PartnerState {
  playerId: string;
  hp: number;
  maxHp: number;
  block: number;
  score?: number;    // Current run score (computeRaceScore result), broadcast at turn-end
  accuracy?: number; // Answer accuracy 0-1 (factsCorrect/factsAnswered), broadcast at turn-end
}
```

`score` and `accuracy` are included in the `mp:coop:partner_state` broadcast so the partner's HUD can show their performance stats without a separate broadcast channel.

### awaitCoopTurnEnd return type

`awaitCoopTurnEnd(timeoutMs?)` now returns `Promise<'completed' | 'cancelled'>` instead of `Promise<void>`. Callers MUST check the result:

```typescript
const result = await awaitCoopTurnEnd();
if (result === 'cancelled') {
  coopWaitingForPartner.set(false);
  return; // Restore turn control — do not run enemy phase
}
```

### cancelCoopTurnEnd

```typescript
export function cancelCoopTurnEnd(): void
```

Cancels a pending turn-end signal. Removes local signal from the set, broadcasts `mp:coop:turn_end_cancel` to peers (so they remove the local player from their signal set), and resolves the in-flight `awaitCoopTurnEnd()` promise with `'cancelled'`. No-op if no barrier is in flight.

### isLocalTurnEndPending

```typescript
export function isLocalTurnEndPending(): boolean
```

Returns `true` when the local player has signaled turn-end and is waiting for consensus. Use this to conditionally show a "Cancel" button in the UI during the wait.

### Message types added

- `mp:coop:turn_end_cancel` — sent when local player cancels a pending turn-end signal. Receivers remove the sender from their `_turnEndSignals` set. Registered in `MultiplayerMessageType` union.

### RNG determinism invariant

Enemy intent rolls use a named fork `'enemyIntents'` of the run RNG via `getRunRng('enemyIntents')`. Enemy pool selection (boss/mini-boss/elite/common) uses fork `'enemyPool'`. Both fall back to `Math.random()` when no run RNG is active (tests, dev contexts).

**Invariant:** Two co-op clients with the same `runSeed` will produce identical enemy intent sequences and identical enemy pool picks for the same encounter, because both use the same seeded fork. This is what makes client-side enemy simulation deterministic without a host-authoritative server.

---

## Co-op Sync Primitives (2026-04-20)

New helpers in `src/services/multiplayerCoopSync.ts` providing barrier guards, solo-survivor enforcement, AFK detection, and HUD shape bridging.

### hasPendingBarrier

```typescript
export function hasPendingBarrier(): boolean
```

Returns `true` when a turn-end barrier promise is in flight. Equivalent to `isLocalTurnEndPending()` — exposed for test assertions and diagnostic UI.

### H18 — Solo-survivor rule and handleCoopPlayerDeath

**Rule:** When any player's HP reaches 0 mid-encounter in co-op, the encounter ends for ALL players immediately. Both players receive a loss. There is no solo-survivor path.

```typescript
export function handleCoopPlayerDeath(playerId: string): void
```

(a) Broadcasts `mp:coop:player_died` so peers see the event.
(b) Resolves any in-flight barrier with `'cancelled'` immediately so the encounter-end path is unblocked.

**Wiring (TODO):** Call `handleCoopPlayerDeath(_localPlayerId)` from `encounterBridge.ts` at the HP-commit site inside `handleEndTurn` when `run.multiplayerMode === 'coop' && newHp <= 0`.

Message type `mp:coop:player_died` is registered in `MultiplayerMessageType` union.

### H19/M5 — AFK / unresponsive partner detection

```typescript
export function onPartnerUnresponsive(cb: (playerId: string) => void): () => void
export function markPartnerUnresponsive(playerId: string): void
```

`onPartnerUnresponsive` subscribes to partner-AFK events. The callback receives the unresponsive `playerId`. Returns an unsubscribe function.

`markPartnerUnresponsive` fires all callbacks immediately (e.g. triggered by a lobby-disconnect event from upstream).

The sync module runs a heartbeat poll every 5 seconds. If no `mp:coop:partner_state` is received from a known partner for 90 seconds, `onPartnerUnresponsive` callbacks fire. This does NOT kick the player — upstream decides the action (show warning, auto-resolve, etc.).

| Constant | Value | Purpose |
|---|---|---|
| `PARTNER_HEARTBEAT_POLL_MS` | 5 000 ms | How often the poll checks heartbeat ages |
| `PARTNER_UNRESPONSIVE_TIMEOUT_MS` | 90 000 ms | Absence duration before declaring unresponsive |

### M17 — partnerStateToRaceProgressShape

```typescript
export function partnerStateToRaceProgressShape(state: PartnerState): Partial<RaceProgress>
```

Maps a `PartnerState` (transport layer) into the `Partial<RaceProgress>` shape the `MultiplayerHUD` consumes:

| PartnerState field | RaceProgress field |
|---|---|
| `playerId` | `playerId` |
| `hp` | `playerHp` |
| `maxHp` | `playerMaxHp` |
| `block` | `playerBlock` |
| `score` (default 0) | `score` |
| `accuracy` (default 0) | `accuracy` |

`floor`, `encountersWon`, `isFinished`, `result` are NOT populated — the caller (`CardApp.svelte`) fills those from its own run-progress tracking. HUD wire-up is a UI-wave task.

### Message types added (2026-04-20)

- `mp:coop:player_died` — broadcast by `handleCoopPlayerDeath(playerId)`. Signals encounter-end to all peers. Registered in `MultiplayerMessageType` union.

---

## Known Placeholders (2026-04-09)

### Player Display Names
~~`createLobby()` is called with `'Player 1'` and `joinLobby()` with `'Player 2'` as placeholder display names in `CardApp.svelte`.~~

**Resolved (C2, 2026-04-21):** `CardApp.svelte` now calls `getLocalPersonaName()` from `steamNetworkingService.ts` before creating or joining a lobby. The display name resolves in priority order: Steam persona name → `authStore.displayName` → `'Player'`. See the C2 section below.

---

## Co-op Cancel UX (updated Issue 9, 2026-04-11)

When a player taps "End Turn" in co-op mode, `coopWaitingForPartner` becomes `true`. The **End Turn button transforms** into one of two cancel states:

### State 1 — CANCEL END TURN (hand non-empty)
- Rendered when `$coopWaitingForPartner && handHasCards` — `handHasCards = $derived(handCards.length > 0)`
- Button label: **CANCEL END TURN**
- CSS class `.cancel-state`: amber/dark-orange `background: #92400e`, `color: #fcd34d`, `min-width: calc(160px * var(--layout-scale, 1))`, `cancelPulse` animation
- `data-testid="btn-cancel-end-turn"`
- `onclick` calls `handleCancelEndTurn()` → `cancelEndTurnRequested()` from `encounterBridge`
- On `'cancelled'` result: `coopWaitingForPartner` store clears automatically via the bridge's finally block; button returns to END TURN

### State 2 — WAITING… (hand empty)
- Rendered when `$coopWaitingForPartner && !handHasCards`
- Button label: **WAITING…**, `disabled`
- Native `title` tooltip: "You played all your cards — waiting for your partners"
- `data-testid="btn-end-turn"` (same testid as default — there is no cancel action available)

### Default — END TURN
- Rendered when `!$coopWaitingForPartner` (solo or before turn-end signal)
- Unchanged from pre-Issue-9 behavior: `endTurnDisabled`, `end-turn-pulse`, `has-ap-remaining` classes all apply normally

### Secondary cancel path (banner)
The `.coop-waiting-banner` with `.coop-cancel-btn` (`data-testid="coop-cancel-btn"`) is retained as a secondary entry point. `handleCoopCancel()` now routes through `cancelEndTurnRequested()` (same bridge function) instead of calling `cancelCoopTurnEnd()` directly. The banner remains for screen-reader / accessibility access and as a familiar control for players who notice it first.

**API summary:** `cancelEndTurnRequested()` in `encounterBridge.ts` is the sole UI-callable cancel function. It checks `not_in_coop`, `no_barrier`, and `empty_hand` guards before calling `cancelCoopTurnEnd()` on the sync layer.

---

## RNG Determinism Enforcement — Commit-Time Lint (2026-04-11)

The `no-bare-math-random` lint (`scripts/lint/no-bare-math-random.mjs`) enforces the RNG determinism invariant at commit time. Run via `npm run lint:rng`.

**What it catches:** Bare `Math.random()` calls in gameplay code with no seeded-RNG fallback check. These cause co-op delta desync — both clients roll independently, producing divergent game state for the same card play.

**What it allows:** Guarded patterns are explicitly whitelisted. The correct form is:
```typescript
const _rng = isRunRngActive() ? getRunRng('relicEffects') : null;
const isCrit = (_rng ? _rng.next() : Math.random()) < 0.25;
// OR:
const roll = isRunRngActive() ? getRunRng('bucket').next() : Math.random();
```

Both forms pass the lint. The fallback to `Math.random()` in the non-run context (dev tools, tests, headless sim preview) is intentional and harmless.

**Cluster D (BATCH-2026-04-11-ULTRA):** Three CRITICALs were found and fixed before this lint shipped:
- `relicEffectResolver.ts:1647` — `crit_lens` 25% crit chance → now guarded with `_critRng`
- `relicEffectResolver.ts:1712` — `obsidian_dice` multiplier roll → now guarded with `_diceRng`
- `relicAcquisitionService.ts:73,93` — rarity roll and candidate pick → now guarded with `_relicRng` / `_pickRng`

**Pre-existing violations:** 87 bare calls remain after the Wave C allowlist expansion (2026-04-11). The original 169 calls were categorized: 82 allowlisted as genuinely cosmetic (particles, audio synthesis, UI ghost data, network simulation, ID generation), leaving 87 genuine co-op desync risks for the gradual migration. The lint runs as soft-warn in the pre-commit hook until the count reaches zero.

**Allowlist governance:** The allowlist in `no-bare-math-random.mjs` is printed on every run so code reviewers can audit what is granted. The two mechanisms are:
-  — whole files or directories (cosmetic FX, audio, dev-only code)
-  — specific line numbers for files with mixed safe/unsafe calls (e.g.  lobby ID generation vs run seed creation)

Every allowlist entry requires a rationale comment explaining WHY it is safe.

---

## Lobby Browser (Phase 7 — 2026-04-11)

### Player-Facing UX Flow

From the Multiplayer Hub, click **Browse Lobbies** to see a live list of open public games. The browser refreshes every 5 seconds while mounted.

**Browse screen elements:**
- Header: "Browse Lobbies" + back button (escape hatch) + refresh button + transport badge (Steam / Web / Dev).
- Filter bar: mode filter (All / Race / Duel / Co-op / Trivia Night), fullness filter (Available / All).
- Lobby grid: each tile shows host name, mode icon + label, `currentPlayers / maxPlayers`, visibility icon (🔒 for password-protected, 👥 for friends-only), fairness rating if present, and a ✨ "new" pulse for lobbies created within the last 15 seconds.
- Empty state: "No lobbies available — be the first!" with a "Create Lobby" shortcut button.

**Joining a password-protected lobby:** Clicking a 🔒 lobby opens a password modal. The entered password is SHA-256 hashed client-side before being sent. If the hash does not match the stored hash, the server returns a 403 and the modal shakes.

**Friends-only lobbies:** On Steam, these do not appear in the browser list (Steam handles the friends-graph filter natively). On web builds, friends-only lobbies are code-join only and are not visible to non-friends. Steam friends can still receive a direct lobby invite.

### Hosting Options

When creating a lobby, the host configures:

**Visibility (tri-state toggle):**
- **Public** — Listed in the browser, open to all. No icon.
- **Password** — Listed in the browser with a 🔒 icon. Joiners must enter the correct password.
- **Friends Only** — Hidden from the browser. Steam friends can still join via invite. On non-Steam builds, this option is disabled with a tooltip ("Steam only — invite friends via code instead").

**Max players (mode-specific pill selector):**
- Race Mode: 2, 3, or 4 (capped at `MODE_MAX_PLAYERS['race'] = 4`).
- Trivia Night: 2 through 8 (capped at `MODE_MAX_PLAYERS['trivia_night'] = 8`).
- Duel / Co-op: always 2 (fixed — selector disabled with a tooltip).

The selector is floored at `MODE_MIN_PLAYERS[mode]` (always 2) and capped at `MODE_MAX_PLAYERS[mode]`. Non-host players see the settings as read-only badges.

**Password UX:** When "Password" is selected, a password input appears with a show/hide eye toggle. The host's plaintext password is never sent over the network — only the SHA-256 hash reaches the backend.

---

## LAN Multiplayer (Embedded Server) — 2026-04-20

LAN play uses an embedded Fastify-equivalent HTTP+WebSocket server started from the Tauri desktop process. Players on the same network can find and connect to a host's game without Steam or the cloud backend.

### Key source files

| File | Role |
|------|------|
| `src-tauri/src/lan.rs` | Rust embedded server (axum), Tauri commands |
| `src-tauri/src/main.rs` | Tauri app setup, exit hook (C5) |
| `src-tauri/src/steam.rs` | SteamState with active_lobby_id tracking (C5) |
| `src/services/lanServerService.ts` | Tauri IPC wrappers (`startLanServer`, `stopLanServer`, `getLanServerStatus`, `getLocalIps`) |
| `src/services/lanDiscoveryService.ts` | Subnet scanner (`scanLanForServers`, `probeLanServer`, `toSubnetPrefix`) |
| `src/services/lanConfigService.ts` | localStorage persistence (`setLanServerUrl`, `getLanServerUrls`, `isLanMode`, `validatePrivateNetworkAddress`) |

### C5 — Steam lobby cleanup on app exit

`SteamState` in `steam.rs` carries an `active_lobby_id: Arc<Mutex<Option<u64>>>` field. It is set by the `steam_create_lobby` and `steam_join_lobby` Steamworks callbacks, and cleared by `steam_leave_lobby` or `steam_force_leave_active_lobby`.

`main.rs` uses the Tauri v2 `.build(...).run(|app_handle, event| {...})` pattern to register a `RunEvent::Exit` handler. On exit:
1. Locks `active_lobby_id` and calls `slot.take()`.
2. If a lobby ID was present, calls `client.matchmaking().leave_lobby(lobby_id)` via the Steamworks client.
3. The Steamworks SDK issues the leave message to Steam before the process terminates.

A JS-callable command `steam_force_leave_active_lobby` is also exported for graceful shutdown paths (e.g. "Quit to Desktop" flow in the UI). It returns `true` when a lobby was left, `false` when none was active.

Both paths guard against poisoned mutexes — the exit path logs a warning and skips the leave rather than panicking.

### M1 — LAN bound-address reporting

`lan_start_server` in `lan.rs` returns `LanStartResult`:

```rust
pub struct LanStartResult {
    pub port: u16,
    pub local_ips: Vec<String>,
    pub lan_server_url: String,           // "http://192.168.1.42:19738"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub warning: Option<String>,          // "local-only" when no LAN NIC found
}
```

Bind behaviour:
- `collect_local_ips()` returns routable interfaces → bind to `0.0.0.0:port`; `lan_server_url` uses the first routable IP; `warning` is absent.
- No routable interfaces → bind to `127.0.0.1:port`; `lan_server_url` is `"http://127.0.0.1:<port>"`; `warning = "local-only"`.

The TypeScript `LanStartResult` interface in `lanServerService.ts` mirrors this:

```typescript
export interface LanStartResult {
  port: number;
  localIps: string[];
  lanServerUrl: string;
  warning?: 'local-only' | string;
}
```

`startLanServer()` logs a console warning when `result.warning === 'local-only'` so developers notice immediately.

### M2 — IPv6 subnet parsing in `toSubnetPrefix()`

`toSubnetPrefix(ip: string): string | null` (exported from `lanDiscoveryService.ts`):

| Input | Output | Notes |
|-------|--------|-------|
| `"192.168.1.42"` | `"192.168.1"` | IPv4 /24 prefix |
| `"10.0.0.5"` | `"10.0.0"` | IPv4 /24 prefix |
| `"192.168"` | `null` | Malformed IPv4 — too few parts |
| `""` | `null` | Empty |
| `"fe80::1"` | `null` | IPv6 link-local (fe80::/10) — skip, non-routable |
| `"fd12:3456:789a:0001::1"` | `"fd12:3456:789a:0001"` | IPv6 ULA fd prefix — /64 prefix |
| `"fc00:0:0:1::1"` | `"fc00:0:0:1"` | IPv6 ULA fc prefix — /64 prefix |
| `"2001:db8::1"` | `null` | Global unicast IPv6 — skip |
| `"::1"` | `null` | Loopback — skip |

`resolveSubnets()` calls `toSubnetPrefix()` on each IP returned by `getLocalIps()` and filters nulls, so link-local and non-ULA IPv6 addresses are silently skipped.

### M3 — Reduced LAN probe fan-out

`scanLanForServers(opts?)` in `lanDiscoveryService.ts` uses a two-phase strategy by default:

**Phase 1 — Gateway quick probe (300ms timeout):**
Probes `<subnet>.1` for each subnet concurrently. If any subnet returns a valid server, the full list is returned immediately without continuing to Phase 2.

**Phase 2 — Compact scan:**
If Phase 1 finds nothing, probes the compact range (`COMPACT_RANGES`):

| Range | Octets | Rationale |
|-------|--------|-----------|
| `.2–.32` | 31 | DHCP pool start — most home routers |
| `.100–.110` | 11 | Common static reservation band |
| `.200–.210` | 11 | Alternate static band |
| `.254` | 1 | ISP-router gateway alternate |

Total: ≤55 probes per subnet (including the Phase 1 `.1` probe), well within browser socket pool limits. `COMPACT_RANGES` starts at `.2` — `.1` is already covered by Phase 1, preventing double-probing.

**`fullScan: true` option:**
Probes all 254 hosts (`.1–.254`) directly with no gateway pre-probe. Use for background refresh where latency is not critical.

**Result:** Sorted ascending by IP string.

### M21 — RFC1918 whitelist for LAN config

`validatePrivateNetworkAddress(ip: string): AddressValidationResult` (exported from `lanConfigService.ts`) rejects public IPs before they can be stored. `setLanServerUrl()` calls it and throws if the address is not private.

Accepted addresses:

| Range | Type |
|-------|------|
| `127.0.0.0/8` | IPv4 loopback |
| `10.0.0.0/8` | RFC1918 Class A private |
| `172.16.0.0/12` | RFC1918 Class B private (172.16–172.31) |
| `192.168.0.0/16` | RFC1918 Class C private |
| `169.254.0.0/16` | IPv4 link-local (APIPA) |
| `::1` | IPv6 loopback |
| `fe80::/10` | IPv6 link-local |
| `fc00::/7` | IPv6 ULA (fc/fd prefix) |

Public IPv4 and global unicast IPv6 are rejected with a descriptive error string containing `"private-network"`. Malformed input is also rejected. Port validation is the caller's responsibility.

```typescript
export type AddressValidationResult =
  | { ok: true }
  | { ok: false; reason: string };
```


## Workshop Integration

**Source:** `src/services/multiplayerWorkshopService.ts`

Enables Workshop-backed deck selection, deck voting, Deck of the Day, and post-match ratings in multiplayer lobbies.

### H16 — Deck Install Pre-Flight Check

Before the host can start a game with a Workshop deck, every player must have that deck installed locally. The `checkAllPlayersHaveWorkshopDeck()` function implements a 2-second ACK protocol:

**Protocol:**

1. Host calls `checkAllPlayersHaveWorkshopDeck(workshopItemId, playerIds)`.
2. Function sends `mp:workshop:deck_check { workshopItemId, requestId }` to all peers.
3. Each client's `initWorkshopMessageHandlers()` listener responds with `mp:workshop:deck_check_ack { requestId, playerId, installed }`.
4. After 2 seconds, any player who did not respond with `installed: true` is counted as missing.

**Return type:**

```typescript
interface WorkshopDeckCheckResult {
  missing: string[]; // player IDs who lack the deck or did not ACK in time
}
```

**UI contract:** If `missing.length > 0`, the lobby UI must block game start and name the missing players. The service returns structured data only — the player-visible message is the UI agent's responsibility.

**New message types** (string-typed; not yet in `MultiplayerMessageType` union — transport `on()` accepts `string`):
- `mp:workshop:deck_check` — host → all clients
- `mp:workshop:deck_check_ack` — client → host

**ACK timeout:** `DECK_CHECK_ACK_TIMEOUT_MS = 2000` ms.

### M14 — Metadata Validation

`validateWorkshopDeckMetadata(meta)` validates all deck metadata received over the wire before it is applied to local lobby state. Called from the `mp:lobby:deck_select` handler inside `initWorkshopMessageHandlers()`.

**Constraints:**

| Field | Type | Constraint |
|-------|------|-----------|
| `title` | string | Required; 1–100 chars; no HTML tags |
| `description` | string | Optional; ≤500 chars; no HTML tags |
| `factCount` | integer | Required; 1–5000 |
| `author` | string | Optional; ≤64 chars |

HTML detection: `/<[^>]+>/` regex. Any `<…>` sequence causes the whole payload to be dropped.

**Return type:**

```typescript
type WorkshopMetaValidationResult =
  | { ok: true }
  | { ok: false; reason: string };
```

**Drop behavior:** Invalid payloads are logged at `console.warn` level and silently discarded. The `onDeckSelect` callback is not invoked. The reason string is dev-facing (not shown to the player verbatim).

### initWorkshopMessageHandlers — Signature Update

The function now accepts two optional parameters:

```typescript
initWorkshopMessageHandlers(
  localPlayerId?: string,        // used when replying to deck_check requests
  onDeckSelect?: (deck: WorkshopDeckPreview) => void  // fired after validation passes
): () => void
```

Callers that previously called `initWorkshopMessageHandlers()` with no arguments still compile and work — the new params are optional.

### Message Types Summary

| Message | Direction | Purpose |
|---------|-----------|---------|
| `mp:lobby:deck_select` | host → all | Host selected a Workshop deck; receivers validate metadata (M14) |
| `mp:workshop:vote_submit` | any → all | Player nominates a deck in a vote round |
| `mp:workshop:vote_result` | host → all | Vote resolved; winner announced |
| `mp:workshop:deck_check` | host → all | Pre-flight: do you have this deck? (H16) |
| `mp:workshop:deck_check_ack` | client → host | Pre-flight response: installed true/false (H16) |

## Lobby Service Robustness Fixes (2026-04-21)

Source: `src/services/multiplayerLobbyService.ts`, `src/data/multiplayerTypes.ts`.

### L2 — Lobby code collision retry

`generateLobbyCode()` now maintains a module-level `_recentLobbyCodes: Set<string>`. On each call it retries up to 5 times before returning a code not in the set. On the 6th consecutive collision (astronomically rare — 32^6 ≈ 1B combinations), it logs a warning and returns the code anyway. The set grows with active sessions and is not explicitly cleared (entries have session lifetime).

### M4 — Broadcast directory TTL tightened

`BC_ENTRY_TTL_MS` reduced from 30 000 ms to 15 000 ms. This halves the ghost-lobby window for entries whose host disconnects without sending `mp:lobby:leave`. The heartbeat cadence `BC_HEARTBEAT_MS` stays at 5 000 ms — the TTL remains 3× the heartbeat, which is the minimum ratio that tolerates one missed heartbeat without pruning live entries.

### M6 — hasPassword derivation — DEFERRED

Removing the denormalized `hasPassword` field from `LobbyState` requires touching > 10 call sites across tests and UI. Deferred to a dedicated refactor wave. `hasPassword` is always co-set with `visibility` via `setVisibility()` and `setPassword()` — never mutate directly.

### M16 — Reset `_passwordHash` on lobby entry

`createLobby()`, `joinLobby()`, and `joinLobbyById()` now reset `_passwordHash = null` before any other mutation. Prevents a stale hash from a prior session leaking into a new one when the module is long-lived (e.g. HMR or SPA navigation without a full reload).

### M22 — Player count re-validation in startGame

`startGame()` re-checks `players.length >= 2` after `allReady()` returns true. In single-threaded JS this check is unreachable via a real race, but it serves as a defensive assertion and documents the contract. If triggered, throws `'Cannot start game — not enough players ready.'`.

### H13 — Timestamped ready-state merge

`setReady()` now increments `_localReadyVersion` and broadcasts it alongside the ready flag in `mp:lobby:ready`. The `mp:lobby:settings` handler compares the incoming player's `readyVersion` against the local version: if local is newer, the local ready state is preserved. Prevents a late-arriving settings broadcast from overwriting a fresh toggle-off.

`LobbyPlayer` gains an optional `readyVersion?: number` field (default absent / 0).

### H5 — Race seed ACK handshake

`startGame()` now initiates an ACK handshake after broadcasting `mp:lobby:start`:

1. Host stores a `_pendingStartAcks: Set<playerId>` of all guests.
2. Host retries the broadcast every 750 ms as long as any ACK is pending.
3. When all guests ACK via `mp:lobby:start_ack`, host cancels timers and fires `_onGameStart`.
4. After 3 000 ms, host fires `_onGameStart` anyway with a `console.warn` listing the unresponsive players.

Guest path: on receiving `mp:lobby:start`, guest immediately sends `mp:lobby:start_ack { playerId, seed }`.

Note: `mp:lobby:start_ack` is not yet in the `MultiplayerMessageType` union in `multiplayerTransport.ts`. The lobby service casts it as `MultiplayerMessageType` — this is safe because all transport `on()` callbacks accept `string` and `send()` routes unknown types without special handling. The type should be added to the union when `multiplayerTransport.ts` is next edited.

### H10 — Reconnect grace timer

On `mp:lobby:peer_left`, the player is NOT immediately removed. Instead:

1. `player.connectionState` is set to `'reconnecting'` (new optional field on `LobbyPlayer`).
2. A 60-second timer (`RECONNECT_GRACE_MS = 60_000`) is started.
3. On `mp:lobby:peer_rejoined`, `connectionState` flips back to `'connected'` and the timer is cancelled.
4. On timer expiry (still `'reconnecting'`), the player is removed from `players` and a `console.info` is logged.

UI consumption (showing a reconnecting badge) is a downstream task for `ui-agent`.

`LobbyPlayer` gains an optional `connectionState?: 'connected' | 'reconnecting'` field (default absent / `'connected'`).

### C4 — LAN mode clear hook

`clearLanModeOnHubEntry()` is exported from `multiplayerLobbyService.ts`. It calls `clearLanServerUrl()` from `lanConfigService` if LAN mode is active. Wiring point: the `ui-agent` will call this from `CardApp.svelte` on Hub navigation.

### M20 — Solo-start hook

`leaveMultiplayerLobbyForSoloStart(): Promise<void>` is exported from `multiplayerLobbyService.ts`. It calls `leaveLobby()` if a lobby is active, otherwise is a no-op. Wiring point: `CardApp.svelte` solo-start path (owned by `ui-agent`).

### New message types (H5, H10)

| Message | Direction | Purpose |
|---------|-----------|---------|
| `mp:lobby:start_ack` | guest → host | Guest acknowledges receipt of seed in `mp:lobby:start` (H5) |
| `mp:lobby:peer_left` | transport → lobby service | Peer connection dropped; starts reconnect grace timer (H10) |
| `mp:lobby:peer_rejoined` | transport → lobby service | Peer reconnected within grace window (H10) |

## M23 — Typed IPC contract (2026-04-20)

`steamNetworkingService.ts` now exposes a compile-time-safe IPC wrapper that eliminates the silent arg-mismatch failure mode (camelCase vs. snake_case keys) discovered in `docs/gotchas.md 2026-04-20`.

### SteamCommandArgs interface

Maps every known Tauri command to its expected argument shape. All keys are camelCase — Tauri v2 translates automatically to snake_case before dispatching to Rust.

```typescript
interface SteamCommandArgs {
  steam_create_lobby:        { lobbyType: SteamLobbyType; maxMembers: number };
  steam_join_lobby:          { lobbyId: string };
  steam_leave_lobby:         { lobbyId: string };
  steam_set_lobby_data:      { lobbyId: string; key: string; value: string };
  steam_get_lobby_data:      { lobbyId: string; key: string };
  steam_get_lobby_members:   { lobbyId: string };
  steam_send_p2p_message:    { steamId: string; data: string; channel?: number };
  steam_accept_p2p_session:  { steamId: string };
  steam_request_lobby_list:  Record<string, never>;
  steam_get_lobby_member_count: { lobbyId: string };
  steam_force_leave_active_lobby: Record<string, never>;
  steam_check_lobby_membership:  { lobbyId: string; steamId: string };
  // … plus polling/internal commands
}
```

A matching `SteamCommandReturn` interface maps each command to its return type.

### invokeSteam\<K\>(cmd, args?)

```typescript
export async function invokeSteam<K extends keyof SteamCommandArgs>(
  cmd: K,
  args?: SteamCommandArgs[K],
): Promise<SteamCommandReturn[K] | null>
```

- TypeScript will error at compile time if args don't match the expected shape for `cmd`.
- All internal call sites in `steamNetworkingService.ts` (formerly `tauriInvoke(...)`) now use `invokeSteam(...)`.
- `tauriInvoke` remains as the internal implementation but is no longer the public API.

### Adding new Steam commands

1. Add an entry to `SteamCommandArgs` with the command name and camelCase arg shape.
2. Add an entry to `SteamCommandReturn` with the expected return type.
3. Call via `invokeSteam('steam_new_command', { ... })`.

---

## L4 — Host Moderation / Kick scaffolding (2026-04-20)

Reserves the transport infrastructure for host-initiated player removal. **UI is post-MVP** — the service primitives are shipped so future UI work can light them up without touching the transport or lobby service.

### New message types

| Message | Payload | Direction | Purpose |
|---------|---------|-----------|---------|
| `mp:lobby:kick` | `{ targetPlayerId, reason?, issuedBy }` | host → all peers | Host removes a player. Receivers must verify `issuedBy === hostId`. |
| `mp:lobby:vote_kick_start` | `{ targetPlayerId, initiatedBy }` | TBD | Stub — future vote-to-kick open. |
| `mp:lobby:vote_kick_vote` | `{ targetPlayerId, vote, voterId }` | TBD | Stub — future per-player vote. |

### Payload interfaces (multiplayerTransport.ts)

`KickPayload`, `VoteKickStartPayload`, `VoteKickVotePayload` — exported for type-safe message construction.

### kickPlayer(targetPlayerId, reason?) — multiplayerLobbyService.ts

Host-only. Throws if:
- Not in a lobby (`[kickPlayer] Not in a lobby.`)
- Local player is not host (`[kickPlayer] Only the host can kick players.`)
- Target is self (`[kickPlayer] Host cannot kick themselves.`)

Behavior on success:
1. Broadcasts `mp:lobby:kick` with `issuedBy = _localPlayerId`.
2. Removes the player from local lobby state immediately.
3. Cancels any pending reconnect grace timer for that player.
4. Calls `notifyLobbyUpdate()`.

### onLobbyError(cb) — multiplayerLobbyService.ts

Registers a callback that fires when the **local** player is kicked. The error key is currently only `'kicked_by_host'`. Cleared in `leaveLobby()`.

```typescript
const unsub = onLobbyError((error) => {
  if (error === 'kicked_by_host') showKickedDialog();
});
```

### Receiver logic (setupMessageHandlers)

On `mp:lobby:kick`:
1. **Spoof guard:** if `issuedBy !== _currentLobby.hostId` → log warning and return.
2. **Self-targeted:** if `targetPlayerId === _localPlayerId` → fire `_onLobbyError('kicked_by_host')`, call `leaveLobby()`.
3. **Other player targeted:** remove from `_currentLobby.players`, cancel reconnect timer, call `notifyLobbyUpdate()`.

### vote_kick_start / vote_kick_vote

Stubs only. Message types are in the union and payload interfaces are defined, but no logic is wired. Reserved for a future vote-to-kick feature (requires UI, quorum logic, and timer state).


---

## B1 — LAN Bind Error Surfacing + Auto-Port-Retry (2026-04-21)

**Source files:** `src-tauri/src/lan.rs`, `src/services/lanServerService.ts`, `src/ui/components/MultiplayerMenu.svelte`

### Problem (pre-B1)

`lan_start_server` in `lan.rs` returned a formatted string error on `TcpListener::bind` failure, but the TypeScript-side `tauriInvoke` swallowed all IPC errors into `null`. `startLanServer()` returned `null`, and `handleStartServer` in `MultiplayerMenu.svelte` showed a generic "Couldn't start the server. Try again." regardless of the actual cause.

### Fix

1. **`lan.rs` auto-port-retry:** When `TcpListener::bind` fails with `AddrInUse`, the server retries once with `port=0` so the OS assigns a free port. Any other error (permission denied, no NIC) is returned immediately without retry.

2. **`lanServerService.ts` throwing invoke:** `startLanServer()` now uses `tauriInvokeOrThrow` — a direct `invoke` call that does NOT catch the rejection. Bind failures propagate as thrown `Error` instances with the real Rust error string.

3. **`MultiplayerMenu.svelte` error surface:** The `catch (err)` block now shows `Server failed to start: ${detail}` where `detail` is `err.message`. Players see the real cause rather than the generic fallback.

### Error strings a player might see

- `Port 19738 is already in use and auto-assign also failed: ...` — rare; means the OS couldn't find ANY free port
- `Failed to bind port 19738: permission denied` — macOS firewall or system policy is blocking the bind

### macOS local-network permission

On first launch, macOS shows an "Allow 'Recall Rogue' to find and connect to devices on your local network?" dialog. The LAN server bind succeeds; the OS blocks outbound discovery packets until the user approves. If a player dismisses the dialog:

- The server binds and starts (localhost reachable).
- Guests on other machines cannot connect via LAN discovery.
- The player must re-enable in System Settings → Privacy & Security → Local Network.

No code change is needed — this is an OS-level policy. Document this to players in the FAQ.

---

## C2 — Real Steam Persona Name (2026-04-21)

**Source files:** `src-tauri/src/steam.rs`, `src-tauri/src/main.rs`, `src/services/steamNetworkingService.ts`, `src/CardApp.svelte`

### New Rust command: `steam_get_persona_name`

```rust
#[tauri::command]
pub fn steam_get_persona_name(state: State<SteamState>) -> Result<Option<String>, String>
```

Returns the Steam display name of the locally signed-in user via `ISteamFriends::GetFriendPersonaName`. Synchronous — no callback or polling required. Returns `None` when Steam is unavailable.

Registered in `main.rs` `.invoke_handler`.

### TypeScript bridge: `getLocalPersonaName()`

Added to `SteamCommandArgs` and `SteamCommandReturn` typed IPC contract in `steamNetworkingService.ts`:

```typescript
// SteamCommandArgs
steam_get_persona_name: Record<string, never>;

// SteamCommandReturn
steam_get_persona_name: string | null;
```

New export:

```typescript
export async function getLocalPersonaName(): Promise<string | null>
```

Returns null on non-Tauri builds (web, mobile, CI).

### CardApp.svelte wiring

`getLocalPersonaName` is imported in `CardApp.svelte`. A module-level `localDisplayName` state variable is populated in `onMount`. Both `handleCreateLobby` and `handleJoinLobby` call `getLocalDisplayName()` before creating or joining, which resolves: Steam persona name → `authStore.displayName` → `'Player'`.

The `localDisplayName` state variable is also passed as the prop to `LobbyBrowserScreen` so the browser shows the real name when the player joins by browsing.

## Steam Overlay Requirements

The Steam overlay (Shift+Tab) requires all of the following conditions to be met:

1. **Launch via Steam client.** Run the game from the Steam library — do not launch the bundled `.exe` directly. The Steam client injects `SteamAppId=4547570` (or `SteamGameId`) into the process environment when launching from the library. The overlay injector uses these vars to identify the process. Direct exe execution bypasses this injection.

2. **Overlay enabled in Steam settings.** Steam Settings → In-Game → "Enable the Steam Overlay while in-game" must be checked. Per-game overrides also apply (right-click the game in Steam library → Properties → General → "Enable the Steam Overlay while in-game").

3. **Tauri/WebView known limitation.** Tauri desktop apps render through WebView2 (Windows) or WKWebView (macOS). Steam's overlay traditionally hooks DirectX/Vulkan/OpenGL render surfaces, not browser compositors. Overlay support on this stack is best-effort — it may work on some Windows GPU/driver combinations but fail on others. If it cannot hook our compositor, that is a known upstream limitation, not a bug in our wiring.

### Dev diagnostic

Enable `?dev=true` and open the Multiplayer menu to see the Steam Overlay status panel. It shows:

| Field | Meaning |
|-------|---------|
| Client init | `steam_initialized` — was Steam running at app launch? |
| Launched via Steam | `launched_via_steam` — `SteamAppId`/`SteamGameId` env present? |
| Overlay reports enabled | `overlay_enabled` — does `ISteamUtils::BIsOverlayEnabled()` return true? |

**Definitive hook test:** The `GameOverlayActivated` callback (wired in `SteamState::new()`) fires a `[Steam] GameOverlayActivated: active=true` stdout line when the user presses Shift+Tab. If this line never appears in stdout, the overlay is not hooked — no amount of config change will fix it on the current build.

### IPC

```typescript
// Returns the status struct, or null on non-Tauri builds.
import { getSteamOverlayStatus } from 'src/services/steamNetworkingService'
const status = await getSteamOverlayStatus()
// status: { overlayEnabled: boolean|null, launchedViaSteam: boolean, steamInitialized: boolean }
```

Rust command: `steam_overlay_status` in `src-tauri/src/steam.rs`.

## SteamNetworkingMessages Session Handshake (2026-04-22)

### The ConnectFailed Problem

`ISteamNetworkingMessages` — the API underlying all Steam P2P messaging in Recall Rogue — requires the **receiver** to have accepted a session before messages are delivered. The accept can happen in one of three ways:

1. The receiver calls `AcceptSessionWithUser(identity)` explicitly.
2. The receiver sends any message to the requester (implicit accept).
3. The receiver has a registered `session_request_callback` that calls `request.accept()`.

Without one of these, every inbound message returns `EResultNoConnection` (`ConnectFailed`) to the sender.

**On the host side:** the `LobbyChatUpdate` callback (registered since Wave 21) fires when the guest enters the lobby and sends a zero-byte message back, implicitly accepting the guest's future session. This covers the **host accepting the guest's direction**.

**On the guest side:** the guest receives no `LobbyChatUpdate` for the host (the host was already in the lobby). If the guest opens a session toward the host without the host having a `session_request_callback` registered, the host's Steam network layer rejects the guest's first outbound message. The guest then calls `send_message_to_user` which returns `ConnectFailed`.

### Fix

`SteamState::new()` now registers two persistent callbacks on `client.networking_messages()`:

**`session_request_callback`** — fires when any peer opens a fresh `SteamNetworkingMessages` session toward us. The callback calls `request.accept()` immediately. This replaces the manual `steam_accept_p2p_session` round-trip for the common case. Log line: `[Steam] SessionRequest: accepting from peer <id>`.

**`session_failed_callback`** — fires when a session fails to establish or drops. Logs full `NetConnectionInfo` (state, end_reason, identity_remote) to `debug.log`. Previously these failures were silent — sends returned `ConnectFailed` with no further diagnostics.

**`steam_prime_p2p_sessions` Tauri command** — called by `multiplayerLobbyService` immediately after every successful lobby create/join. Sends a zero-byte `RELIABLE | AUTO_RESTART_BROKEN_SESSION` message to every other lobby member, proactively opening sessions in both directions.

### Send Flags

All `send_message_to_user` calls in `steam_send_p2p_message` now use:
```rust
SendFlags::RELIABLE | SendFlags::AUTO_RESTART_BROKEN_SESSION
```

`AUTO_RESTART_BROKEN_SESSION`: when the connection hits `NoConnection` (e.g., after a NAT hole-punch failure or relay drop), Steam automatically closes the stale connection, opens a fresh one, and requeues the message. Without this flag, a single `NoConnection` error is returned and the message is lost permanently.

### Send Retry (TS layer)

`SteamP2PTransport._sendWithRetry()` retries failed sends with backoff (0ms, 200ms, 500ms). Between attempts it calls `getP2PConnectionState(peerId)` to log the connection state. After 3 failures it logs `send exhausted retries` with the connection state diagnostic — surfaced in `debug.log` via the `rrLog` bridge.

### New IPC Commands

| Command | Description |
|---------|-------------|
| `steam_prime_p2p_sessions(lobbyId)` | Send zero-byte primer to all other lobby members; returns count primed |
| `steam_get_p2p_connection_state(steamId)` | Returns diagnostic string: `state=Connected rtt=42 end_reason=None` |
| `steam_get_session_error(steamId)` | Returns most recent session failure reason from `last_session_errors` map, or `null` if none. Persistent (not one-shot). Written by `session_failed_callback`. |

### Session Failure State Slot

`SteamState.last_session_errors: Arc<Mutex<HashMap<u64, String>>>` — keyed by peer raw SteamID (u64). Written by `session_failed_callback` on every session failure. Read by `steam_get_session_error` Tauri command. The TS `_sendWithRetry` calls `getSessionError(peerId)` on each failure to enrich retry log lines.

**Why not one-shot?** The error is diagnostic. The retry path may call it multiple times on consecutive attempts. It stays in the map until overwritten by a newer failure or the app exits.

### TS helpers

```typescript
import { primeP2PSessions, getP2PConnectionState, getSessionError } from 'src/services/steamNetworkingService'
const count = await primeP2PSessions(lobbyId)    // call after create/join
const diag = await getP2PConnectionState(peerId) // call in retry path
const err = await getSessionError(peerId)        // enriched failure reason from session_failed_callback
```

---

## LobbyChatUpdate — Entered and Left handling

The `LobbyChatUpdate` callback in `src-tauri/src/steam.rs` fires for every lobby membership change. As of 2026-04-22e it handles both directions:

### Entered (session auto-accept)

When `member_state_change == ChatMemberStateChange::Entered`, the host sends a zero-byte `RELIABLE | AUTO_RESTART_BROKEN_SESSION` message to the entering peer. This implicitly accepts the reverse P2P session direction under Steam's rules, ensuring messages from the guest start delivering immediately rather than waiting for the host's next peer-poll (previously up to 300ms of drops).

Self-enter events (host creating their own lobby) are filtered by checking `peer == me`.

### Left / Disconnected / Kicked / Banned (ungraceful exit detection)

When `member_state_change` is anything other than `Entered` (i.e., Left, Disconnected, Kicked, Banned), the callback writes the departing peer's 64-bit SteamID to `SteamState.pending_peer_left: Arc<Mutex<Option<u64>>>`.

The TypeScript side polls this slot every 1 second while in a lobby (via `getPendingPeerLeft()` → `steam_get_pending_peer_left` Tauri command). When a non-null SteamID is returned, the lobby service searches `_currentLobby.players` for a matching entry (exact ID, `steam:<id>`, or ID ending with the SteamID) and removes it, then calls `notifyLobbyUpdate()`.

This closes the ghost-player bug: previously a peer who crashed or lost network would stay in `_currentLobby.players` forever because they never sent `mp:lobby:leave`.

### New IPC command

| Command | Semantics |
|---------|-----------|
| `steam_get_pending_peer_left()` | One-shot (take()): returns 64-bit decimal SteamID string of ungraceful-exit peer, or null. |

---

## LAN on macOS — Permission and Firewall

### Local Network Permission (macOS 15+)

macOS 15 (Sequoia) requires `NSLocalNetworkUsageDescription` in `Info.plist` for any app that binds a local-network socket. This key is injected at build time via `src-tauri/Info.plist` (referenced by `bundle.macOS.infoPlist` in `tauri.conf.json`). On first LAN server start, macOS shows a system permission prompt:

> "Recall Rogue would like to find and connect to devices on your local network."

The player **must click Allow**. If they click Don't Allow (or the prompt is dismissed), macOS silently refuses the `TcpListener` bind and `lan_start_server` fires the 10s timeout with a generic timeout message.

**To re-enable after denying:** System Settings → Privacy & Security → Local Network → find Recall Rogue and flip the toggle.

### Firewall Allow

macOS Firewall (System Settings → Network → Firewall) may block inbound TCP on port 19738. If the self-probe log line shows `self-probe FAILED` or `self-probe TIMEOUT`, the firewall is blocking inbound connections. Options:

1. System Settings → Network → Firewall → Options → Add Recall Rogue → Allow Incoming Connections.
2. Turn off Firewall (for LAN gaming sessions).
3. Use the LAN server on the guest's machine (they host instead).

### LAN TCP Probe

The `lan_tcp_probe` Tauri command lets a guest independently verify host reachability:

```typescript
import { lanTcpProbe } from 'src/services/steamNetworkingService'
const result = await lanTcpProbe('192.168.1.42', 19738, 2000)
// "ok" on success; "refused", "timeout", or "host_unreachable:..." on failure
```

This is a pure TCP connect — it does not send any application data and does not require a running LAN server on the guest side.

---

## Message Routing: LAN/Fastify Server vs Steam P2P (BUG8 — 2026-04-22)

This is a critical architectural difference that has caused several bugs.

### LAN / Fastify server path

```
Guest                     Fastify / lan.rs server               Host + other clients
-----                     ----------------------               --------------------
send('mp:lobby:join', …)
                          receives mp:lobby:join
                          adds player to lobby state
                          rebroadcast as 'mp:lobby:player_joined'
                                                               on('mp:lobby:player_joined') fires
                                                               adds player to local players array
```

The server acts as a relay and **transforms** `mp:lobby:join` → `mp:lobby:player_joined`. The client's `setupMessageHandlers()` only handles `mp:lobby:player_joined`.

### Steam P2P path

```
Guest                     Host (no server)
-----                     ----------------
send('mp:lobby:join', …)
                          receives mp:lobby:join directly
                          NEEDS to handle it here (no server to relay)
                          → on('mp:lobby:join') handler in setupMessageHandlers()
                          adds player to _currentLobby.players
                          calls broadcastSettings() so all peers get updated player list
```

**Rule:** When Steam P2P is active (`isTauriRuntime() && !isBroadcastMode() && !isLanMode()`), the host must handle every message type that a server would normally intercept and transform. If you add a new server-side intercept, add the corresponding host-side P2P handler.

Both `mp:lobby:join` (host-side P2P handler) and `mp:lobby:player_joined` (all-client LAN/Fastify handler) are registered in `setupMessageHandlers()` and coexist safely.

### Rich Presence: connect key (BUG12 — 2026-04-22)

When the host creates a Steam lobby, `setRichPresence('connect', '+connect_lobby <lobbyId>')` is called. Steam maps this to the `steam://joinlobby/…` URL handler, which shows a "Join Game" button in the Steam friends list overlay. The `+connect_lobby ` prefix is required by Steam's documented format — without it the button appears but the join silently fails.

`clearRichPresence()` is called in `leaveLobby()` so friends no longer see a stale "Join Game" button after the host leaves.

Both helpers (`setRichPresence`, `clearRichPresence`) are in `src/services/steamNetworkingService.ts`. The underlying Rust commands (`steam_set_rich_presence`, `steam_clear_rich_presence`) were already implemented and registered in `src-tauri/src/main.rs`.
