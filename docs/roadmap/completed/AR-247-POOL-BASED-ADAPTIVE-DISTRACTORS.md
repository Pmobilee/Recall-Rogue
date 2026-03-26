# AR-247: Pool-Based Adaptive Distractors

**Status:** Pending
**Complexity:** Medium (new distractor selection logic, confusion matrix, synonym exclusion)
**Dependencies:** AR-245 (CuratedDeck types, AnswerTypePool), AR-246 (InRunFactTracker for confusion data)
**Spec Reference:** `docs/RESEARCH/DECKBUILDER.md` sections 4.4-4.6

---

## 1. Overview

Replace LLM-generated distractors with pool-based adaptive distractors for study mode. Distractors are drawn from the deck's own answer type pools, weighted by the player's confusion matrix (which answers they've previously confused with each other). Synonym groups prevent unfair questions.

**CRITICAL:** This applies ONLY to study mode. Trivia mode continues using existing pre-generated distractors unchanged.

**REVERSAL OF EXISTING RULE:** The CLAUDE.md rule "NEVER generate distractors from database pools" is REVERSED for study mode per DECKBUILDER.md §6.3. Study mode distractors MUST come from the deck's own fact pool. Trivia mode keeps existing distractors.

---

## 2. Sub-Steps

### 2.1 Create Confusion Matrix Service

**File:** `src/services/confusionMatrix.ts` (NEW)

Persisted across runs in player save. Tracks which facts the player confuses.

```typescript
export interface ConfusionEntry {
  targetFactId: string;     // The correct answer
  confusedFactId: string;   // What the player chose instead
  count: number;            // How many times this confusion occurred
  lastOccurred: number;     // Timestamp
}

export class ConfusionMatrix {
  private entries: ConfusionEntry[] = [];

  /** Record a confusion: player chose wrongFactId when correctFactId was the answer */
  recordConfusion(targetFactId: string, confusedFactId: string): void;

  /** Get all confusions for a target fact */
  getConfusionsFor(targetFactId: string): ConfusionEntry[];

  /** Get reverse confusions (times THIS fact was chosen wrongly for OTHER facts) */
  getReverseConfusionsFor(factId: string): ConfusionEntry[];

  /** Get the confusion score between two facts (0 if never confused) */
  getConfusionScore(factA: string, factB: string): number;

  /** Serialize for player save */
  toJSON(): ConfusionEntry[];

  /** Restore from player save */
  static fromJSON(data: ConfusionEntry[]): ConfusionMatrix;
}
```

**Acceptance:** Matrix records, retrieves, and serializes confusion data correctly.

### 2.2 Implement `selectDistractors()`

**File:** `src/services/curatedDistractorSelector.ts` (NEW)

Per DECKBUILDER.md §4.4, select distractors from the deck's answer type pool.

```typescript
import type { DeckFact, AnswerTypePool, SynonymGroup } from '../data/curatedDeckTypes';
import type { ConfusionMatrix } from './confusionMatrix';
import type { InRunFactTracker } from './inRunFactTracker';

export interface DistractorSelectionResult {
  distractors: DeckFact[];
  sources: ('confusion' | 'reverse_confusion' | 'in_run_struggle' | 'similar_difficulty' | 'pool_fill')[];
}

/**
 * Select distractors from the deck's answer type pool, weighted by confusion matrix.
 *
 * Priority order (§4.4):
 * 1. Synonym group exclusion (MANDATORY — checked first)
 * 2. Known confusions (from confusion matrix)
 * 3. In-run struggles (from in-run FSRS)
 * 4. Same pool, similar difficulty (±1)
 * 5. Same pool, any difficulty (fill remaining)
 */
export function selectDistractors(
  correctFact: DeckFact,
  answerPool: AnswerTypePool,
  allDeckFacts: DeckFact[],
  synonymGroups: SynonymGroup[],
  confusionMatrix: ConfusionMatrix,
  inRunTracker: InRunFactTracker,
  count: number,                    // Determined by mastery level (§4.5)
  cardMasteryLevel: number
): DistractorSelectionResult;
```

**Scoring algorithm per candidate fact in the pool:**

| Factor | Score Addition |
|--------|---------------|
| Known confusion (target → confused) | +10.0 * count |
| Reverse confusion (confused → target) | +5.0 * count |
| In-run struggle (wrongCount > 0) | +3.0 |
| Similar difficulty (±1) | +2.0 |
| High card mastery (>= 3) | Score *= 1.5 |
| Base | 1.0 |

Sort candidates by score descending, take top N.

**Fallback:** If the answer type pool has fewer candidates than needed (after synonym exclusion), fall back to the fact's pre-generated `distractors[]` array to fill remaining slots.

**Acceptance:**
- Synonym group facts are never selected as distractors
- Confusion matrix entries are prioritized
- Correct distractor count per mastery level
- Fallback to pre-generated distractors works

### 2.3 Implement Mastery-Driven Distractor Count (§4.5)

**File:** `src/services/curatedDistractorSelector.ts` (same file)

```typescript
/**
 * Get the number of distractors for a given card mastery level.
 * Per DECKBUILDER.md §4.5.
 */
export function getDistractorCount(cardMasteryLevel: number): number;
```

| Mastery Level | Distractor Count |
|---------------|-----------------|
| 0 | 2 |
| 1 | 3 |
| 2 | 3 |
| 3 | 4 |
| 4 | 4 |
| 5 | 4 |

**Acceptance:** Function returns correct count per mastery level.

### 2.4 Wire Distractor Selection into Quiz Flow

**File:** `src/services/quizService.ts` (MODIFY)

The existing `getQuizChoices(fact: Fact)` function builds multiple-choice answers. Add a study-mode branch:

- If current run is study mode: call `selectDistractors()` with the deck's pool, confusion matrix, and in-run tracker
- If trivia mode: use existing distractor logic (pre-generated `distractors[]` or runtime vocab/bracket generation)

The quiz overlay receives the selected choices and displays them — no UI changes needed.

**Acceptance:**
- Trivia mode quiz choices unchanged
- Study mode quiz choices come from pool-based selection
- Synonym group exclusion prevents unfair options

### 2.5 Persist Confusion Matrix in Player Save

**File:** `src/services/playerSaveService.ts` (MODIFY)

Add `confusionMatrix: ConfusionEntry[]` to the player save structure. Load/save alongside existing FSRS data.

The confusion matrix is updated:
- After every wrong charge answer (from InRunFactTracker's confusion recording in AR-246)
- The `confusedFactId` maps to the fact whose `correctAnswer` matches the wrong option the player selected

**Acceptance:**
- Confusion matrix persists across app restarts
- Data is compact (only stores non-zero confusion pairs)

---

## 3. Files Affected

| File | Action | Purpose |
|------|--------|---------|
| `src/services/confusionMatrix.ts` | CREATE | ConfusionMatrix class with persistence |
| `src/services/curatedDistractorSelector.ts` | CREATE | selectDistractors(), getDistractorCount() |
| `src/services/quizService.ts` | MODIFY | Branch distractor selection for study mode |
| `src/services/playerSaveService.ts` | MODIFY | Persist confusion matrix |

---

## 4. Acceptance Criteria

1. `npm run typecheck` passes
2. `npm run build` succeeds
3. `npx vitest run` — all existing tests pass
4. Synonym group facts NEVER appear as distractors for grouped facts
5. Confusion matrix entries are prioritized as distractors
6. Distractor count scales with mastery level (2 at M0, 3 at M1-2, 4 at M3-5)
7. Fallback to pre-generated distractors works when pool is too small
8. Confusion matrix persists in player save
9. Trivia mode distractor selection is completely unchanged

---

## 5. Verification Gate

- [ ] `npm run typecheck` — passes
- [ ] `npm run build` — succeeds
- [ ] `npx vitest run` — all tests pass
- [ ] Unit tests for `selectDistractors()` — synonym exclusion, confusion weighting, count scaling
- [ ] Unit tests for `ConfusionMatrix` — record, retrieve, serialize, deserialize
- [ ] Manual: Trivia run distractors unchanged
- [ ] Update `docs/GAME_DESIGN.md` — document adaptive distractors, confusion matrix
- [ ] Update `docs/ARCHITECTURE.md` — new services
- [ ] Update `data/inspection-registry.json` — add confusionMatrix, curatedDistractorSelector systems
