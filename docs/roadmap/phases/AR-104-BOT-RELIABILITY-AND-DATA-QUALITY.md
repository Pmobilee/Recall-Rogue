# AR-104: Bot Reliability & Data Quality — Zero Waste Runs

## Overview

**Goal:** Fix the three critical issues preventing useful batch data: 57% of runs timeout at Floor 1 (combat init), relic trigger counts are always 0, and completed runs lose all state (relics/gold) on death. Every run must produce usable data.

**Why:** AR-103 proved the bot CAN play real full games (Floor 8-13, 40+ enemies, shops, rest rooms, delve). But 57% of runs waste 5 minutes each on a Floor 1 timeout, relic triggers show 0 (can't evaluate relic balance), and defeat runs lose their final state (can't see what relics/gold they had). We need >90% completion rate and full data capture to do real balance analysis.

**Dependencies:** AR-103 (complete)

---

## Phase 1: Fix Floor 1 Combat Init Timeout (CRITICAL — 57% failure rate)

### The Bug
~40-60% of runs get stuck at Floor 1 with 0 cards played. The bot enters combat (screen = 'combat') but card play API calls all return not-ok. The hand is empty or the turn state isn't initialized. The existing poll (`getCombatState().handSize > 0`) waits up to 15s but still fails.

### Root Cause Investigation
Need to determine: is the combat scene not starting? Is the turn state not being created? Is the hand not being dealt? Is there a race condition between the map node click and the combat scene initialization?

### Investigation Steps
1. Add detailed logging to the combat ready poll — log what `getCombatState()` returns on each poll attempt
2. Check if `activeTurnState` store has data when `handSize` is 0
3. Check if the Phaser CombatScene is actually running (`game.scene.isActive('Combat')`)
4. Check if `__terraPlay.quickPlayCard(0)` returns an error message that explains the failure
5. Compare timing between working seeds and stuck seeds — what's different?

### Potential Fixes (try in order)
1. **Increase first-room retry delay** from 500ms to 1000ms — give more time between map click and state read
2. **Re-navigate on stuck** — if combat poll fails after 15s, navigate back to dungeonMap and retry the map node click
3. **Force turn init** — if turnState exists but hand is empty, call `__terraPlay.endTurn()` to force a new turn deal
4. **Browser context recycle** — if first combat fails, close context and create fresh one (different seed offset)

### Acceptance Criteria
- >90% of runs enter combat successfully (from current ~50%)
- No run should timeout at Floor 1 — either enter combat or fail fast with 'error'

---

## Phase 2: Fix Relic Trigger Tracking

### The Bug
All relics show `triggerCount: 0` in `relicDetails`. 24 unique relics were collected across 40 pickups but none triggered. Either:
1. The `triggerCount` field isn't being incremented in the game code
2. The relics ARE triggering but the counter isn't persisted to `runRelics`
3. The bot reads `relicDetails` at a time when triggers haven't been counted

### Investigation Steps
1. Search game code for where `triggerCount` is incremented on `RunRelic`
2. Check if relic effects fire during combat (add temp console.log to relic effect resolver)
3. Check if `triggerCount` updates in real-time or only at run end
4. Play a manual game, check `__terraPlay.getRelicDetails()` mid-combat — does it show triggers?

### Fix
Once the increment mechanism is identified, ensure the bot reads `relicDetails` at the right time (during combat or immediately after, before state is cleared).

### Acceptance Criteria
- Relics that should trigger (e.g., combo_ring on combo, whetstone on attack) show triggerCount > 0
- Relic tier list in analyzer shows meaningful trigger data

---

## Phase 3: Capture State Before Death

### The Bug
When a run ends in defeat, `finishRunAndReturnToHub()` sets `activeRunState` to null before the bot can read the final state. So `readDetailedState()` returns empty relics, 0 gold, etc.

### Fix: Snapshot State on Combat Exit
In the combat-exit detection block (screen transition from combat → non-combat), capture a snapshot of the run state:

```typescript
// In the screen transition handler, when combat exits:
if (inCombat && lastScreen === 'combat' && state.currentScreen !== 'combat') {
  // Snapshot run state while it's still available
  try {
    const snapshot = await readDetailedState(page);
    lastKnownGold = snapshot.gold;
    lastKnownRelics = snapshot.relicDetails;
    lastKnownDeckSize = snapshot.deckSize;
  } catch { /* non-critical */ }
  // ... existing encounter tracking code ...
}
```

Then at the end of the run, use `lastKnown*` values as fallbacks when `readDetailedState` returns empty.

### Also: Snapshot on Every Screen Transition
Even better — keep a rolling snapshot of the last known good state. Update it on every screen change where the state is available. This way, no matter when the run ends, we have recent data.

### Acceptance Criteria
- Defeat runs show the relics and gold they had when they died
- `finalGold`, `finalRelicCount`, `relicDetails` are populated for all completed runs

---

## Phase 4: Analyzer Improvements

### 4.1 Filter out errors/timeouts by default
The analyzer should exclude `error` and `timeout` runs from all statistics. Add a line at the top:
```
Filtered: X completed runs out of Y total (Z errors/timeouts excluded)
```

### 4.2 Fix "Floor 0 death rate" bug
Floor 0 deaths are actually error/timeout runs, not real deaths. Filter these out of the death rate calculation.

### 4.3 Add encounter-based death tracking
Track which enemy KILLED the bot (last encounter before defeat). This is more useful than floor-based death rates.

### 4.4 Show relic trigger rates
In the relic tier list, show avg triggers per run and what % of runs the relic actually fired.

### Acceptance Criteria
- Balance report excludes error/timeout runs
- Death rate is calculated from real defeats only
- Killer enemy ranking shows which enemies end the most runs

---

## Phase 5: Stress Test

### 5.1 Run 30 games (5 per profile)
After all fixes, run a full batch. Target: >90% completion rate, full relic/gold data on all completed runs.

### 5.2 Validate data quality
- Every completed run has `encounters.length > 0`
- Every completed run that reached Floor 4+ has `relicDetails.length > 0` or `relicsEarned.length > 0`
- Every completed run has `goldEarned > 0`
- Relic trigger counts are > 0 for trigger-based relics

---

## Files Affected

- `tests/playtest/playwright-bot/bot.ts` — combat init fix, state snapshots
- `tests/playtest/playwright-bot/state-reader.ts` — possibly fix state reading
- `tests/playtest/playwright-bot/analyze.ts` — filter errors, death tracking
- `src/services/gameFlowController.ts` — possibly fix relic triggerCount (if game bug)
- `src/data/relics/` — investigate trigger mechanism

## Verification Gate

- [ ] >90% run completion rate (from current ~43%)
- [ ] Relic triggerCount > 0 for combat relics
- [ ] Defeat runs show relics and gold at time of death
- [ ] Analyzer excludes errors/timeouts from statistics
- [ ] 30-run batch produces clean, complete data
