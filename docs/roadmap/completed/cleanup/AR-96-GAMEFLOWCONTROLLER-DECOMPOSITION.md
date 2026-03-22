# AR-96: Decompose gameFlowController.ts

## Overview
`gameFlowController.ts` is 2,095 lines with 124+ functions — a monolithic state machine handling screen routing, run lifecycle, reward generation, relic acquisition, encounter completion, and event handling. Decompose into domain-specific controllers while keeping the same public API surface.

**Complexity**: High
**Risk**: Medium (central game flow — must not break any screen transitions)
**Dependencies**: None

## TODO Checklist

- [x] **1. Map the current function graph**
  - Read `src/services/gameFlowController.ts` fully
  - Group functions by responsibility domain:
    - **Run lifecycle**: startRun, finishRun, abandonRun, etc.
    - **Encounter flow**: startEncounter, onEncounterComplete, retreatFromCombat
    - **Reward flow**: openCardReward, proceedAfterReward, skipReward
    - **Relic flow**: offerRelic, acquireRelic, showRelicSelection
    - **Room selection**: presentRoomChoices, onRoomSelected
    - **Screen routing**: navigateTo, returnToHub, showScreen
  - Document which functions call which (call graph)

- [x] **2. Extract `rewardFlowController.ts`**
  - All reward-related functions: openCardReward, proceedAfterReward, skipReward, card upgrade flow
  - Clean interface: receives game state, emits state transitions
  - ~200-300 lines

- [x] **3. Extract `encounterFlowController.ts`**
  - Encounter start/complete/retreat logic
  - `onEncounterComplete` (134 lines — largest function) broken into sub-functions
  - ~300-400 lines

- [x] **4. Extract `relicFlowController.ts`**
  - Relic offer, selection, acquisition flow
  - ~150-200 lines

- [x] **5. Extract `roomSelectionController.ts`**
  - Room choice presentation, selection handling, special room routing
  - ~150-200 lines

- [x] **6. Keep `gameFlowController.ts` as thin orchestrator**
  - Imports domain controllers
  - Handles run lifecycle (start/finish/abandon)
  - Routes between domain controllers
  - Target: <400 lines

- [x] **7. Update all imports**
  - If public API changes, update all importing files
  - Prefer re-exporting from gameFlowController to minimize churn

- [x] **8. Comprehensive flow testing**
  - Start run → combat → reward → room choice → next floor → cash out
  - Start run → combat → defeat → run end
  - Relic acquisition at all trigger points
  - Retreat flow
  - Verify with Playwright end-to-end

## Acceptance Criteria
- `gameFlowController.ts` reduced to <400 lines (orchestration only)
- No function exceeds 80 lines in any extracted file
- All screen transitions work identically
- Zero runtime errors during any game flow path
- All existing tests pass without modification (or minimal adaptation)

## Files Affected
| Action | Path |
|--------|------|
| EDIT | `src/services/gameFlowController.ts` (slim to orchestrator) |
| CREATE | `src/services/flow/rewardFlowController.ts` |
| CREATE | `src/services/flow/encounterFlowController.ts` |
| CREATE | `src/services/flow/relicFlowController.ts` |
| CREATE | `src/services/flow/roomSelectionController.ts` |
| EDIT | Any files importing from gameFlowController (if API changes) |

## Verification Gate
- [x] `npm run typecheck` passes
- [x] `npm run build` passes
- [x] `npx vitest run` — all tests pass
- [x] Full game flow verified via Playwright (start → combat → reward → room → cash out)
- [x] Retreat flow verified
- [x] Run defeat flow verified
- [x] No console errors during any flow
