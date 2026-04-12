# Race Mode Test Action Sequences

Pre-built action sequences for the 5 Race Mode test scenarios. These assume lobby setup (S1+S2+S9) is already complete -- both players are in a lobby, both ready.

---

## Prerequisites

Before running race tests, complete lobby scenarios S1 (create), S2 (join), and S9 (both ready). The host and guest should be on `multiplayerLobby` screen with both players showing ready status.

Also ensure a deck/content selection has been made (S5) -- without it, `CardApp.svelte` will reject the game start and redirect back to the lobby.

---

## R1: Race Start

### Host Actions

```json
[
  {"type": "click", "selector": "[data-testid='btn-start-game']", "waitAfter": 4000},
  {"type": "eval", "js": "JSON.stringify({screen: window.__rrPlay?.getScreen()})"},
  {"type": "screenshot", "name": "R1-host-started"}
]
```

### Guest Verification (after host starts)

```json
[
  {"type": "wait", "ms": 4000},
  {"type": "eval", "js": "JSON.stringify({screen: window.__rrPlay?.getScreen()})"},
  {"type": "screenshot", "name": "R1-guest-started"}
]
```

### Pass Criteria
- Both screens are `dungeonMap` (map room) or `combat` (auto-entered first encounter)
- Neither screen is `multiplayerLobby` (start failed) or `hub` (kicked back)
- No console errors related to `contentSelection` being null

### Troubleshooting
- If guest stays on `multiplayerLobby`: the `mp:lobby:start` message didn't carry `contentSelection`. Check Fastify server logs at `/tmp/rr-mp-server.log`.
- If either shows `hub`: the game start was rejected. Likely missing content selection (S5 not run).

---

## R2: Shared Seed Verification

### Both Containers (run on host first, then guest)

```json
[
  {"type": "eval", "js": "JSON.stringify({seed: window.__rrPlay?.getRunState?.()?.seed || null, multiplayerMode: window.__rrPlay?.getRunState?.()?.multiplayerMode || null, floor: window.__rrPlay?.getRunState?.()?.currentFloor || null})"},
  {"type": "screenshot", "name": "R2-run-state"}
]
```

### Pass Criteria
- Both containers report the same `seed` value (non-null number)
- Both show `multiplayerMode: 'multiplayer_race'` (or `'race'`)
- Both are on floor 1

### Troubleshooting
- If seeds differ: the `mp:lobby:start` seed wasn't received by the guest. Check WS relay logs.
- If `multiplayerMode` is null: `startNewRun()` wasn't called with the multiplayer params.

---

## R3: Gameplay (Both Players Play 1-2 Encounters)

### Step 1: Navigate to Combat

If on `dungeonMap`, select the first available node:

```json
[
  {"type": "eval", "js": "JSON.stringify({screen: window.__rrPlay?.getScreen()})"}
]
```

If screen is `dungeonMap`:
```json
[
  {"type": "rrPlay", "method": "selectMapNode", "args": ["r0-n0"]},
  {"type": "wait", "ms": 3000},
  {"type": "eval", "js": "JSON.stringify({screen: window.__rrPlay?.getScreen()})"}
]
```

If that fails (node doesn't exist), try generic:
```json
[
  {"type": "eval", "js": "const nodes = document.querySelectorAll('[data-testid^=\"map-node-\"]'); JSON.stringify({nodeCount: nodes.length, firstNode: nodes[0]?.dataset?.testid})"}
]
```

### Step 2: Play Combat Turns (per container)

Run this action batch 2 times (2 turns):

```json
[
  {"type": "eval", "js": "JSON.stringify({screen: window.__rrPlay?.getScreen()})"},
  {"type": "rrPlay", "method": "getCombatState"},
  {"type": "rrPlay", "method": "quickPlayCard", "args": [0]},
  {"type": "wait", "ms": 1000},
  {"type": "rrPlay", "method": "endTurn"},
  {"type": "wait", "ms": 1500},
  {"type": "rrPlay", "method": "getCombatState"},
  {"type": "screenshot", "name": "R3-turn-end"}
]
```

Run on host first, then guest. Alternate if testing simultaneous play.

### Step 3: Verify Combat State

After each turn, check the `getCombatState` output:

```json
[
  {"type": "eval", "js": "JSON.stringify({state: window.__rrPlay?.getCombatState ? {playerHp: window.__rrPlay.getCombatState().player?.hp, enemyHp: window.__rrPlay.getCombatState().enemy?.hp, turn: window.__rrPlay.getCombatState().turn?.number} : 'NOT_IN_COMBAT'})"}
]
```

### Pass Criteria
- Both containers enter combat successfully
- `quickPlayCard(0)` doesn't crash (card plays, even if quiz is wrong in quick mode)
- `endTurn()` advances the turn counter
- HP values are positive (game hasn't crashed into an invalid state)
- No JS errors in `result.consoleErrors`

### Troubleshooting
- If `quickPlayCard` fails with "no cards": the content selection didn't populate the card pool. Check that S5 (deck selection) was completed before starting.
- If `endTurn` doesn't advance: could be mid-animation. Increase `wait` to 2000ms.

---

## R4: MultiplayerHUD Verification

### Guest Container (after host has played at least 1 turn)

```json
[
  {"type": "wait", "ms": 3000},
  {"type": "eval", "js": "JSON.stringify({hudExists: document.querySelector('[data-testid=\"mp-hud\"]') !== null, hudContent: document.querySelector('[data-testid=\"mp-hud\"]')?.textContent?.trim()?.slice(0, 200), opponentHp: document.querySelector('[data-testid=\"opponent-hp\"]')?.textContent?.trim(), opponentScore: document.querySelector('[data-testid=\"opponent-score\"]')?.textContent?.trim()})"},
  {"type": "screenshot", "name": "R4-guest-hud"}
]
```

### Host Container (check host also sees guest's progress)

```json
[
  {"type": "eval", "js": "JSON.stringify({hudExists: document.querySelector('[data-testid=\"mp-hud\"]') !== null, hudContent: document.querySelector('[data-testid=\"mp-hud\"]')?.textContent?.trim()?.slice(0, 200)})"},
  {"type": "screenshot", "name": "R4-host-hud"}
]
```

### Pass Criteria
- `hudExists` is `true` on at least one container (the one that didn't just play a turn)
- HUD contains opponent data (HP, score, or floor number)
- The HUD data reflects the other player's actual game state (cross-check with R3 combat state)

### Notes
- Race progress broadcasts at 0.5 Hz (every 2 seconds). The 3s wait should be sufficient.
- The `MultiplayerHUD` component dims when the quiz panel is visible -- if a quiz is active, the HUD may be opacity-reduced but still in DOM.
- If HUD is not found: Race Mode might not have activated the progress broadcast. Check `multiplayerGameService.startRaceProgressBroadcast()` was called.

---

## R5: Race End

### Host Retreats

```json
[
  {"type": "rrPlay", "method": "retreat"},
  {"type": "wait", "ms": 3000},
  {"type": "eval", "js": "JSON.stringify({screen: window.__rrPlay?.getScreen(), hasRunEnd: document.querySelector('[class*=run-end], [class*=RunEnd]') !== null})"},
  {"type": "screenshot", "name": "R5-host-retreated"}
]
```

### Guest State After Host Retreats

```json
[
  {"type": "wait", "ms": 3000},
  {"type": "eval", "js": "JSON.stringify({screen: window.__rrPlay?.getScreen(), hudExists: document.querySelector('[data-testid=\"mp-hud\"]') !== null, opponentFinished: document.querySelector('[data-testid=\"mp-hud\"]')?.textContent?.includes('Finished') || false})"},
  {"type": "screenshot", "name": "R5-guest-sees-host-finished"}
]
```

### Guest Also Retreats (to trigger race results)

```json
[
  {"type": "rrPlay", "method": "retreat"},
  {"type": "wait", "ms": 3000},
  {"type": "eval", "js": "JSON.stringify({screen: window.__rrPlay?.getScreen(), hasResults: document.querySelector('[class*=race-result], [class*=RaceResult]') !== null})"},
  {"type": "screenshot", "name": "R5-both-finished"}
]
```

### Pass Criteria
- Host reaches `runEnd` or similar end screen after retreat
- Guest's HUD updates to show host as finished (or HUD disappears)
- After both retreat, race completion is detected
- No crashes during the end-of-race flow

### Known Limitations
- `RaceResultsScreen.svelte` exists but is NOT WIRED into the run-end flow yet (`@wiring-check:skip`). The race end will go through the normal `RunEndScreen` instead of a dedicated results comparison screen.
- The `_tryEmitRaceResults()` function fires when both players report `isFinished: true`, but the result may only be logged to console, not displayed in a UI.
- Mark this as a KNOWN LIMITATION in the report, not a test failure.

---

## Full Race Test Sequence (Orchestrator Cheat Sheet)

1. Ensure S1+S2+S5+S9 are complete (lobby created, joined, deck set, both ready)
2. Run R1 on host (start game), then verify guest
3. Run R2 on both (seed check)
4. Run R3 on host (play 2 turns)
5. Run R4 on guest (HUD check)
6. Run R3 on guest (play 2 turns)
7. Run R4 on host (HUD check)
8. Run R5 (both retreat, check race end)

Total action batches: ~12-14 batches across both containers. At ~15s per batch, expect ~3-4 minutes for the full race test.
