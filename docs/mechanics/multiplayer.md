# Multiplayer Mechanics

> **Source files:** `src/services/multiplayerGameService.ts`, `src/services/multiplayerLobbyService.ts`, `src/services/multiplayerTransport.ts`, `src/services/coopEffects.ts`, `src/services/coopService.ts`, `src/services/eloMatchmakingService.ts`, `src/services/triviaNightService.ts`, `src/services/steamNetworkingService.ts`, `src/data/multiplayerTypes.ts`, `src/services/enemyManager.ts`, `src/services/multiplayerScoring.ts`
> **Master tracking doc:** `docs/roadmap/AR-MULTIPLAYER.md`
> **Last verified:** 2026-04-20 — 9 logic fixes: race tie-breaker, both-defeated null winner, fork resend on late join, broadcast isActive guard, finishedAt timestamp, real quiz counts, duel action clamping, mode-specific scoring, FSRS batch on race finish. New `multiplayerElo.ts`. See changelog below.

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

TODO(H6-fsrs-wire): If the import path `../ui/stores/playerData` changes, update `_applyRaceFsrsBatch()` accordingly.

### H12 — Scene-lifecycle cleanup guard

`startRaceProgressBroadcast()` now returns `{ stop, isActive }` (plus backward-compat callable). An `_raceProgressActive` flag is checked inside each interval tick — if `stop()` was called before the tick fires, the tick is a no-op instead of calling `getProgress()` on a destroyed object.

### M11 — Mode-specific scoring

`calculateScoreForMode(mode, stats)` computes scores per mode:

| Mode | Formula |
|------|---------|
| `race` / `same_cards` / `coop` | `floors*100 + damage + chain*50 + correct*10 - wrong*5 + perfectEncounters*200` |
| `trivia_night` | `correctCount*100 + speedBonusTotal - wrongCount*25` |
| `duel` | `(survived ? 1000 : 0) + damageDealt - damageTaken + correctCount*50` |

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
- `getLocalMultiplayerRating()` / `persistLocalMultiplayerRating(rating)` — profile integration stubs

TODO(M19-profile-wire): `PlayerProfile` needs a `multiplayerRating: number` field before persistence works. Current stubs return `DEFAULT_RATING` and log a debug message.

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

The gate is implemented as a pure exported function `canStartLobby(lobby, amHost)` in
`src/ui/utils/lobbyStartGate.ts`. This allows unit testing without mounting the Svelte component.

The button label uses a companion function `startButtonLabel(lobby, amHost)` that reflects gate state:

| Gate state | Label |
|---|---|
| Local player is not host | `"Waiting for host..."` |
| No content selected | `"Select Content"` |
| Not all players ready | `"Waiting for players..."` |
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
| `src/services/multiplayerLobbyService.ts` | Lobby lifecycle: create, join, configure, start; `setContentSelection()` for rich content targeting; `addLocalBot()` / `removeLocalBot()` for same-machine dev testing; `generatePlayerId()` for unique tab IDs; `isBroadcastMode()` (exported) for two-tab transport selection and UI indicator |
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
`createLobby()` is called with `'Player 1'` and `joinLobby()` with `'Player 2'` as placeholder display names in `CardApp.svelte`. These will be replaced with real Steam usernames when Steam integration lands. See `docs/roadmap/AR-MULTIPLAYER.md` for the planned integration point.

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

