# Full Run Bug Hunter Report - BATCH-2026-05-04-002

**Tester**: Full Run Bug Hunter  
**Orchestrator**: Codex self-playtest using Claude `llm-playtest` workflow  
**Domain**: general_knowledge  
**Target**: 3 floors  
**Docker agent**: llm-playtest-BATCH-2026-05-04-002

## Verdict: FAIL

The run reached multiple room transitions and reward collection without reproducing the earlier `acceptReward` canvas crash. It did find one launch-blocking state-machine failure: after player HP reached 0, the game stayed on `currentScreen = "combat"` with no active combat state and no visible recovery controls instead of routing to `runEnd`.

## Summary

- Smoke test: passed.
- Full-run action file: `/tmp/rr-actions-BATCH-2026-05-04-002-fullrun.json`
- Full-run output: `/tmp/rr-docker-visual/llm-playtest-BATCH-2026-05-04-002_none_1777885980116/`
- Evidence output: `/tmp/rr-docker-visual/llm-playtest-BATCH-2026-05-04-002_none_1777886198377/`
- Final observed screen: `combat`
- Final observed run HP: `0/100`
- `__rrPlay.getCombatState()`: `null`
- Blocking issues found: 1 critical

## Coverage

| Surface | Count | Notes |
|---|---:|---|
| Combat/map combat entries | 5 | Run ended during a later combat after player death. |
| Completed encounters | 2 | Staple Bug and Overdue Golem reached post-combat progression. |
| Reward room | 1 | Reward acceptance did not reproduce the prior canvas crash. |
| Treasure room | 1 | Progressed back to map. |
| Mystery room | 2 | Progressed, but logged a missing transition background asset. |
| Shop/rest/boss/retreat-or-delve | 0 | Not reached because the death transition blocker stopped the run. |

## Transition Log

1. `hub -> deckSelectionHub -> dungeonMap`
2. `dungeonMap -> combat` vs Staple Bug
3. Staple Bug victory: `combat -> rewardRoom`
4. Reward accepted: `rewardRoom -> dungeonMap`
5. Later map selections covered treasure and mystery nodes.
6. Overdue Golem victory returned to `dungeonMap`.
7. Later combat produced player HP `0/100`.
8. Expected `combat -> runEnd`; observed `combat` with no combat state.

## Issues Found

### CRITICAL

#### BUG-001 - Player death leaves the game stuck in combat instead of runEnd

**Impact**: Publishing blocker. A player can lose a run and be trapped on the combat screen with hidden fallback controls, no active encounter state, and no run-end summary.

**Observed evidence**:

- Evidence JSON: `/tmp/rr-docker-visual/llm-playtest-BATCH-2026-05-04-002_none_1777886198377/result.json`
- Evidence screenshot: `/tmp/rr-docker-visual/llm-playtest-BATCH-2026-05-04-002_none_1777886198377/limbo-evidence.rr.jpg`
- Evidence layout: `/tmp/rr-docker-visual/llm-playtest-BATCH-2026-05-04-002_none_1777886198377/limbo-evidence.layout.txt`

Key captured state:

```json
{
  "screen": "combat",
  "combat": null,
  "run": {
    "currency": 80,
    "playerHp": 0,
    "playerMaxHp": 100
  }
}
```

The layout dump still shows `PHASER LAYER (CombatScene)` and enemy HP text, while the DOM fallback says `Waiting for encounter...` and `Return to Hub` but is hidden. Debug state reports `currentScreen: "combat"`, `phaser: null`, and no recent JS errors.

**Source verification**:

- `src/services/encounterBridge.ts` registers and calls `notifyEncounterComplete('defeat')` from a delayed defeat timer after setting `activeTurnState` to `null`.
- `src/services/gameFlowController.ts` registers `onEncounterComplete` and its defeat branch calls `finishRunAndReturnToHub(...)`.
- `finishRunAndReturnToHub(...)` explicitly sets `currentScreen.set('runEnd')`.

The observed state means the defeat completion path did not finish, or was interrupted after clearing combat state but before `runEnd` became visible.

**Reproduction sketch**:

1. Start a normal single-player run in `general_knowledge`.
2. Play through several map nodes, winning at least one encounter and accepting a reward.
3. Continue combat until the player takes lethal damage.
4. Observe that HP reaches `0/100`, `getScreen()` stays `combat`, and `getCombatState()` returns `null`.

**Suggested fix direction**:

Audit the delayed defeat completion in `encounterBridge.handleEndTurn()` and the `onEncounterComplete('defeat')` guard path in `gameFlowController.ts`. The failure shape suggests a race or stale guard where combat state is cleared before the run-end navigation is guaranteed. Add a regression that drives lethal damage through the bridge-level async timer and asserts `currentScreen === "runEnd"` after the timer settles.

### HIGH

(none)

### MEDIUM

(none)

### LOW

- `ParallaxTransition` logged a missing asset for `/assets/backgrounds/mystery/mystery_combat/landscape.webp`. Source check confirmed `public/assets/backgrounds/mystery/mystery_combat/` does not exist. The room still progressed in this run, so it is not counted as a game-breaking blocker.
- Docker/SwiftShader performance fell to very low FPS during extended combat. This matches prior local Docker noise and is not counted as a publishing blocker here.

## Console Notes

The full run logged:

- `[ParallaxTransition] WebGL init failed: Failed to load image: /assets/backgrounds/mystery/mystery_combat/landscape.webp`
- `Texture key already in use: weapon-fade-tome`
- `Texture key already in use: weapon-fade-shield`
- Repeated `net::ERR_CONNECTION_REFUSED` local backend noise

Only BUG-001 is included in the active issue leaderboard because it blocks run progression.
