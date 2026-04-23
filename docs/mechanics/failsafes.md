# Failsafe Watchdogs

> **Source files:** `src/services/failsafeWatchdogs.ts`, `src/services/failsafes.test.ts`
>
> **Last updated:** 2026-04-23

Recall Rogue's failsafe system detects every runtime state where a player could be stuck (no input advances the game, no UI control escapes) and wires a recovery path. Applies to solo and all multiplayer modes (race, duel, coop, same_cards, trivia_night).

---

## Lifecycle

```
encounterBridge.startEncounterForRoom()
  └─ initFailsafeWatchdogs()    ← starts the poll loop

encounterBridge.notifyEncounterComplete()
  └─ destroyFailsafeWatchdogs() ← stops the poll loop

encounterBridge.resetEncounterBridge()
  └─ destroyFailsafeWatchdogs() ← also called on bridge reset
```

The watchdog interval polls every 1,000 ms. All watchdogs emit `rrLog('watchdog:<tag>', ...)` so they appear in the Steam debug.log.

---

## Watchdog Taxonomy (grep cheat sheet)

| Tag | Area | File |
|-----|------|------|
| `watchdog:hand` | Class A: hand/deck/AP stuck | `failsafeWatchdogs.ts` |
| `watchdog:cardPlay` | Class A: card committed stage | `failsafeWatchdogs.ts` |
| `watchdog:enemy` | Class B: enemy state validation | `failsafeWatchdogs.ts` |
| `watchdog:coop` | Class C: coop HP clamping + delta bucket | `failsafeWatchdogs.ts` |
| `watchdog:barrier` | Class C: barrier cancel | `failsafeWatchdogs.ts` |
| `watchdog:reconcile` | Class C: coop reconcile failure | `failsafeWatchdogs.ts` |
| `watchdog:combatScene` | Class E: Phaser scene null during combat | `failsafeWatchdogs.ts` |
| `watchdog:runState` | Class F: run state null during combat | `failsafeWatchdogs.ts` |

Grep for any watchdog in `debug.log`:

```bash
grep 'watchdog:' ~/Library/Logs/Recall\ Rogue/debug.log | tail -50
```

---

## Class A — Combat: hand / deck / AP stuck states

### A1: Empty hand while AP > 0 and turn not ended

**Trigger:** `ts.deck.hand.length === 0 && ts.apCurrent > 0 && ts.phase === 'player_action'` for ≥ 3 seconds.

**Root cause (2026-04-23):** In coop, both players had empty hands and could only end turn. Most likely: host-authoritative state diverged and the draw effect never fired at encounter start, or the deck was exhausted with no reshuffle path.

**Detection:** `_checkEmptyHandStuck()` in the 1 s poll loop. Logs `watchdog:hand / STUCK` after the 3 s window.

**Repair:**
- **Coop:** calls `requestCoopEnemyStateRetry()` to ask the host for a full state resnapshot. The next turn-end reconcile will also resync.
- **Solo/race:** synthesises a new hand from `ts.deck.drawPile` (or discard reshuffle) via `patchTurnState`. Triggers a `card-draw` audio cue so the player notices.

**Escape hatch:** The End Turn button always advances the turn even with an empty hand. Players can end the turn and draw a fresh hand next turn.

---

### A2: Card stuck in 'committed' stage (quiz open)

**Trigger:** `cardPlayStage === 'committed'` in `CardCombatOverlay.svelte` for ≥ 5 minutes.

**Detection:** The UI calls `notifyCardCommitted(cardId)` when entering committed state and `notifyCardResolved(cardId, outcome)` when leaving it. The watchdog polls the stored timestamp.

**Repair:** No auto-resolve (forcing quiz resolution would award credit without a real answer). The watchdog logs `watchdog:cardPlay / STUCK` for post-hoc analysis. The End Turn button cancels the committed quiz.

---

## Class B — Combat: enemy state

### B1: Invalid enemy HP at encounter start

**Trigger:** `createEnemy()` returns an enemy with `currentHP` as NaN, negative, or above `maxHP`; or `maxHP <= 0`.

**Detection:** `validateEnemyState(enemy)` called immediately after `createEnemy()` in `encounterBridge.startEncounterForRoom()`.

**Repair:** Clamps in place:
- `NaN currentHP` → set to `maxHP`
- `currentHP < 0` → clamp to 0
- `currentHP > maxHP` → clamp to `maxHP`
- `maxHP <= 0` → clamp to 1

All clamping emits `watchdog:enemy / INVALID` or `watchdog:enemy / WARN`.

---

### B2: Empty intent pool

**Trigger:** `enemy.template.intentPool.length === 0` at encounter start.

**Detection:** `validateEnemyState()` checks the pool. Logs `watchdog:enemy / WARN`.

**Repair:** No auto-repair — `enemyManager.rollNextIntent()` has its own fallback path for empty pools (returns a no-op intent). The encounter proceeds.

---

## Class C — Coop shared-enemy sync

### C1: Invalid HP on wire (mp:coop:enemy_hp_update)

**Trigger:** Host broadcasts `currentHP > maxHP` or `currentHP < 0` or `NaN`.

**Detection:** `validateCoopHpUpdate(currentHP, maxHP, localMaxHP)` called in `multiplayerCoopSync.ts` on every `mp:coop:enemy_hp_update` receive.

**Repair:** Clamps both values before notifying subscribers. Logs `watchdog:coop / clamp`.

---

### C2: Delta bucket overflow (M-047 regression)

**Trigger:** The delta bucket for a given turn contains more entries than there are players.

**Detection:** `monitorDeltaBucketSize(turnNumber, bucketSize, playerCount)` called in `multiplayerCoopSync.awaitCoopTurnEndWithDelta()` after the local delta is added.

**Repair:** Diagnostic-only — logs `watchdog:coop / delta bucket overflow`. The bucket fix (M-047) prevents the actual overflow; this watchdog confirms it holds.

---

### C3: Initial enemy-state reconcile failure (both retries timed out)

**Trigger:** Guest calls `awaitCoopEnemyReconcile()` twice and both time out.

**Detection / handling:** `handleCoopReconcileFailure(attempt)` called in `encounterBridge.startEncounterForRoom()`. Logs `watchdog:reconcile / FAILED`.

**Repair:** Encounter proceeds with local enemy state (may differ from host by variance). The turn-end reconcile resync corrects HP on the first turn.

---

### C4: Turn-end barrier cancelled (partner dropped or timed out)

**Trigger:** `awaitCoopTurnEndWithDelta()` resolves `'cancelled'` (15 s timeout or partner-left event).

**Detection / handling:** `handleCoopBarrierCancel(reason)` called in `encounterBridge.handleEndTurn()`. Logs `watchdog:barrier / barrier cancelled`.

**Repair:** Resets `coopWaitingForPartner` to `false`. Player retains hand and AP, can attempt end-turn again or leave the encounter.

---

## Class E — Screen / scene transitions

### E1: getCombatScene() null for > 5 s during active combat

**Trigger:** `getCombatScene()` returns null while `activeTurnState` is non-null and encounter is active, for ≥ 5 seconds.

**Detection:** `_checkCombatSceneNull()` called from the 1 s poll loop. Logs `watchdog:combatScene / WARN`.

**Repair:** No auto-repair — the existing `syncCombatScene()` retry loop (25 × 200 ms) handles the transient boot-race case. The watchdog detects the sustained case for post-hoc analysis.

---

## Class F — Save / run state

### F1: activeRunState null while TurnState is active

**Trigger:** `get(activeRunState) === null` while `get(activeTurnState) !== null` and encounter not resolved.

**Detection:** Checked in `_watchdogTick()`. Logs `watchdog:runState / WARN`.

**Repair:** No auto-repair — `startEncounterForRoom()` already guards with `if (!run) return false` preventing new encounters from starting without run state. This watchdog catches the rarer case where run state is cleared mid-encounter.

---

## Classes D, G, H — Status / planned

The following classes have existing service-level guards or are UI-layer tasks:

| Class | Area | Status |
|-------|------|--------|
| D | Multiplayer lobby / transport | Transport error state surfaces via existing `rrLog('mp:tx', ...)`. No player-visible modal. Needs ui-agent to wire a dismissible error banner. |
| G | Quiz / answer-checking | `playCardAction` has null-fact guard in `turnManager.ts`. FSRS lookup failure leaves card in committed state (Class A2 watchdog logs it). |
| H | Audio / asset loading | `playCardAudio` is synchronous and wraps failures internally (see `cardAudioManager.ts`). No watchdog needed. |

---

## Testing

```bash
npx vitest run src/services/failsafes.test.ts
```

29 tests covering: lifecycle (4 tests), Class A card-committed hooks (3 tests), Class B enemy validation (6 tests), Class C HP clamping (5 tests), Class C delta monitoring (4 tests), Class C reconcile failure (2 tests), Class C barrier cancel (3 tests), additional init reset test (1 test).

---

## Adding a new watchdog

1. Add the detection logic to `_watchdogTick()` or as a standalone exported function.
2. Use `rrLog('watchdog:<newtag>', ...)` with a tag not already in the taxonomy above.
3. Update this doc and the grep cheat sheet in `.claude/skills/steam-deploy/SKILL.md`.
4. Add a test in `src/services/failsafes.test.ts`.
5. Run `npm run typecheck` + `npx vitest run src/services/failsafes.test.ts`.
