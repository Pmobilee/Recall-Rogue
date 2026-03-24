# AR-250: FSRS Progress Service & Knowledge Visualization Prep

**Status:** Partially Implemented (deckProgressService.ts already exists; confusion matrix persistence and LastDungeonSelection persistence still needed)
**Complexity:** Small-Medium (progress computation service, save integration)
**Dependencies:** AR-245 (DeckRegistry, DeckFactIndex)
**Spec Reference:** `docs/RESEARCH/DECKBUILDER.md` section 7; AR-244 section 6

---

## 1. Overview

Create the progress service that computes per-deck and per-sub-deck mastery percentages from global FSRS data. This powers the deck tiles' progress bars in the Study Temple UI (AR-244) and prepares data structures for future knowledge visualization (§7.3).

---

## 2. Sub-Steps

### 2.1 Create Deck Progress Service

**File:** `src/services/deckProgressService.ts` (NEW)

```typescript
import type { DeckRegistryEntry } from '../data/deckRegistry';

export interface DeckProgress {
  deckId: string;
  totalFacts: number;
  factsEncountered: number;      // facts seen at least once (have FSRS state)
  factsMastered: number;         // facts at stability >= 21 days
  averageStability: number;      // avg FSRS stability across encountered facts
  progressPercent: number;       // factsMastered / totalFacts * 100
}

export interface SubDeckProgress {
  subDeckId: string;
  parentDeckId: string;
  totalFacts: number;
  factsEncountered: number;
  factsMastered: number;
  progressPercent: number;
}

/** Mastery threshold: stability >= 21 days (3 weeks) */
const MASTERY_STABILITY_THRESHOLD = 21;

/**
 * Compute progress for a single deck.
 * Looks up global FSRS state for each fact ID in the deck.
 */
export function getDeckProgress(deckId: string): DeckProgress;

/**
 * Compute progress for a specific sub-deck within a deck.
 */
export function getSubDeckProgress(deckId: string, subDeckId: string): SubDeckProgress;

/**
 * Compute progress for all registered decks.
 * Returns a Map for efficient UI rendering of deck tiles.
 */
export function getAllDeckProgress(): Map<string, DeckProgress>;

/**
 * Get all sub-deck progress for a deck.
 * Used when rendering the DeckDetail panel.
 */
export function getAllSubDeckProgress(deckId: string): SubDeckProgress[];
```

**Implementation approach:**
1. Get fact IDs from `deckFactIndex` (AR-245)
2. For each fact ID, look up global FSRS state from `playerSaveService`
3. Count: encountered (has state), mastered (stability >= 21)
4. Compute averages and percentages

**Performance:** Cache results and invalidate when FSRS state changes. Deck progress doesn't change during a run — only between runs.

**Acceptance:**
- Correct progress computation for decks with 0%, partial, and 100% mastery
- Sub-deck progress is a proper subset of deck progress
- Returns 0% for decks with no FSRS data (brand new)

### 2.2 Wire Confusion Matrix Persistence

**File:** `src/services/playerSaveService.ts` (MODIFY — extends AR-247)

Ensure the confusion matrix from AR-247 is properly integrated into the save/load cycle:

```typescript
interface PlayerSave {
  // ... existing fields ...
  confusionMatrix?: ConfusionEntry[];
  lastDungeonSelection?: LastDungeonSelection;  // From AR-245 RunConfig
}
```

**Acceptance:** Confusion matrix and last dungeon selection persist across app restarts.

### 2.3 Expose Progress Data for UI Consumption

Create a reactive wrapper (Svelte store or getter) that the DeckTile and DeckDetail components (AR-244) can subscribe to.

**File:** `src/services/deckProgressService.ts` (same file, add reactive wrapper)

```typescript
import { writable, derived } from 'svelte/store';

/** Reactive store of all deck progress — updates when FSRS data changes */
export const deckProgressStore = writable<Map<string, DeckProgress>>(new Map());

/** Refresh progress data (call after runs complete or FSRS data changes) */
export function refreshDeckProgress(): void;
```

**Acceptance:** UI components can subscribe to `deckProgressStore` for reactive updates.

---

## 3. Files Affected

| File | Action | Purpose |
|------|--------|---------|
| `src/services/deckProgressService.ts` | CREATE | Progress computation + reactive store |
| `src/services/playerSaveService.ts` | MODIFY | Add confusionMatrix, lastDungeonSelection |

---

## 4. Acceptance Criteria

1. `npm run typecheck` passes
2. `npm run build` succeeds
3. `npx vitest run` — all tests pass
4. `getDeckProgress()` returns correct values for empty, partial, and full mastery
5. `getSubDeckProgress()` returns correct subset progress
6. `getAllDeckProgress()` returns progress for all registered decks
7. Mastery threshold is stability >= 21 days
8. Progress cache invalidates correctly
9. Confusion matrix and last dungeon selection persist in player save

---

## 5. Verification Gate

- [ ] `npm run typecheck` — passes
- [ ] `npm run build` — succeeds
- [ ] `npx vitest run` — all tests pass
- [ ] Unit tests for progress computation with mock FSRS data
- [ ] Unit tests for mastery threshold edge cases (stability = 20.9 vs 21.0)
- [ ] Update `docs/GAME_DESIGN.md` — document deck progress, mastery threshold
- [ ] Update `docs/ARCHITECTURE.md` — new service, save structure changes
- [ ] Update `data/inspection-registry.json` — add deckProgressService system
