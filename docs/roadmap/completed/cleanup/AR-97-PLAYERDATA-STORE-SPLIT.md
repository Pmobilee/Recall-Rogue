# AR-97: Split playerData Mega-Store

## Overview
`src/ui/stores/playerData.ts` exports 68 functions across 1,916 lines — managing player saves, fact reviews, activations, minerals, streaks, achievements, and more in a single file. Split into domain-focused store modules while maintaining the same reactive behavior.

**Complexity**: Medium-High
**Risk**: Medium (widely imported — careful re-export strategy needed)
**Dependencies**: None

## TODO Checklist

- [x] **1. Audit all exports and their consumers**
  - List all 68 exported functions/stores
  - Map which files import which exports
  - Group into logical domains:
    - **Core player state**: playerName, level, XP, settings
    - **Fact review system**: reviewFact, getNextReview, factHistory, FSRS state
    - **Resource management**: minerals, currency, premium currency
    - **Progression**: achievements, streaks, milestones, ascension level
    - **Deck/collection**: ownedCards, deckSlots, relics

- [x] **2. Extract `factReviewStore.ts`**
  - All FSRS/review-related functions
  - Fact scheduling, review history, mastery tracking
  - Re-export from playerData.ts for backwards compatibility

- [x] **3. Extract `resourceStore.ts`**
  - Minerals, currency, premium currency management
  - Spend/earn/check functions
  - Re-export from playerData.ts

- [x] **4. Extract `progressionStore.ts`**
  - Achievements, streaks, milestones, ascension level
  - Unlock tracking, progression events
  - Re-export from playerData.ts

- [x] **5. Keep `playerData.ts` as facade**
  - Core player identity (name, level, settings)
  - Re-exports all domain stores for backwards compatibility
  - Target: <300 lines (imports + re-exports + core state)

- [x] **6. Gradually migrate imports**
  - New code should import from domain stores directly
  - Existing imports via playerData.ts continue to work
  - Add JSDoc deprecation notices on re-exports pointing to new locations

- [x] **7. Verify save/load round-trip**
  - Ensure SaveManager still serializes/deserializes all player state correctly
  - Test with existing save fixtures in `tests/fixtures/saves/`

## Acceptance Criteria
- `playerData.ts` reduced to <300 lines (facade + core state)
- Each domain store is independently testable
- All existing imports continue to work (re-export strategy)
- Save/load round-trip preserves all data
- No runtime errors in any game flow

## Files Affected
| Action | Path |
|--------|------|
| EDIT | `src/ui/stores/playerData.ts` (slim to facade) |
| CREATE | `src/ui/stores/factReviewStore.ts` |
| CREATE | `src/ui/stores/resourceStore.ts` |
| CREATE | `src/ui/stores/progressionStore.ts` |
| EDIT | `src/game/managers/SaveManager.ts` (if serialization changes) |

## Verification Gate
- [x] `npm run typecheck` passes
- [x] `npm run build` passes
- [x] `npx vitest run` — all tests pass
- [x] Save/load test: create save → reload → all state preserved
- [x] Playwright: full game flow works with store changes
