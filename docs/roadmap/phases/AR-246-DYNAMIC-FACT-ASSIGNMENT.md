# AR-246: Dynamic Fact Assignment at Charge Time

**Status:** Pending
**Complexity:** Large (core gameplay change — charge flow, FSRS integration, fact selection)
**Dependencies:** AR-245 (RunConfig, CuratedDeckStore)
**Spec Reference:** `docs/RESEARCH/DECKBUILDER.md` sections 4.1-4.3, 4.7

---

## 1. Overview

Implement dynamic fact assignment: when a player charges a card in study mode, the system selects a fact from the deck pool at that moment — not at draw time. Facts are weighted by in-run FSRS state so struggling facts appear more often and mastered facts appear less.

**Key principle:** This ONLY activates for `runConfig.mode === 'study'`. Trivia mode continues using the existing fact-card binding system unchanged.

---

## 2. Sub-Steps

### 2.1 Create InRunFactState Tracker

**File:** `src/services/inRunFactTracker.ts` (NEW)

```typescript
export interface InRunFactState {
  factId: string;
  correctCount: number;         // Times answered correctly this run
  wrongCount: number;           // Times answered wrong this run
  lastSeenEncounter: number;    // Encounter number when last seen
  confusedWith: string[];       // Fact IDs this was confused with (wrong answer selections)
  averageResponseTimeMs: number;
  streak: number;               // Current consecutive correct (resets on wrong)
}

export class InRunFactTracker {
  private states: Map<string, InRunFactState> = new Map();
  private cooldownSet: Set<string> = new Set();
  private cooldownDuration: number = 3; // encounters before a fact can repeat

  /** Initialize from global FSRS at run start (DECKBUILDER.md §4.3) */
  seedFromGlobalFSRS(
    factIds: string[],
    globalStates: Map<string, PlayerFactState>
  ): void;

  /** Get state for a fact (undefined if never seen this run) */
  getState(factId: string): InRunFactState | undefined;

  /** Record a charge result */
  recordResult(
    factId: string,
    correct: boolean,
    responseTimeMs: number,
    encounterNumber: number,
    selectedWrongFactId?: string  // What distractor the player picked (for confusion tracking)
  ): void;

  /** Check if a fact is on cooldown */
  isOnCooldown(factId: string): boolean;

  /** Get the cooldown set */
  getCooldownSet(): Set<string>;

  /** Advance encounter — move cooldowns forward */
  advanceEncounter(): void;

  /** Reset cooldown for a specific chain theme (pool exhaustion recovery §4.7) */
  clearCooldownForTheme(themeId: number, deckFacts: DeckFact[]): void;
}
```

**Seeding logic (§4.3):**
- Facts with global stability < 2 days: start with `wrongCount: 1` (treat as struggling)
- Facts with global stability > 30 days: start with `correctCount: 1` (treat as somewhat known)
- All others: start fresh (empty state)

**Acceptance:** Class instantiates, seeding works, cooldown tracking works.

### 2.2 Create Fact Selection Service

**File:** `src/services/curatedFactSelector.ts` (NEW)

Implements `selectFactForCharge()` per DECKBUILDER.md §4.2.

```typescript
import type { DeckFact } from '../data/curatedDeckTypes';
import type { InRunFactTracker } from './inRunFactTracker';

export interface FactSelectionResult {
  fact: DeckFact;
  selectionReason: 'struggling' | 'unseen' | 'moderate' | 'known' | 'random';
}

/**
 * Select a fact for a card charge in study mode.
 *
 * @param factPool - Chain theme subset (knowledge decks) or full pool (vocabulary decks)
 * @param tracker - In-run FSRS tracker
 * @param cardMasteryLevel - Current card slot mastery (0-5)
 * @param runSeed - Deterministic seed for weighted random
 * @returns Selected fact and reason
 */
export function selectFactForCharge(
  factPool: DeckFact[],
  tracker: InRunFactTracker,
  cardMasteryLevel: number,
  runSeed: number
): FactSelectionResult;
```

**Weighting logic (§4.2):**
| State | Weight | Reason |
|-------|--------|--------|
| Never seen this run | 1.5 | Moderate priority — introduce new facts |
| wrongCount > correctCount | 3.0 | HIGH priority — struggling |
| correctCount >= 2, wrongCount === 0 | 0.2 | LOW priority — hot streak suppression |
| correctCount === 1 | 0.7 | Moderate-low — seen once, got right |
| Default | 1.0 | Baseline |

At high card mastery (>= 3), additionally multiply:
- Facts with `wrongCount > 0`: weight *= 1.5
- Others: weight *= 0.8

**Pool exhaustion recovery (§4.7):**
If available facts in the pool (after cooldown filtering) drop below 3, clear cooldown for that chain theme. If still < 3 (theme has fewer than 3 total facts), make all theme facts available.

**Acceptance:**
- Function returns a fact from the pool
- Struggling facts are selected more often (verifiable via test with fixed seed)
- Cooldown filtering works
- Pool exhaustion recovery triggers at < 3 available

### 2.3 Modify Charge Flow for Study Mode

**File:** `src/services/turnManager.ts` (MODIFY)

The charge flow currently:
1. Player charges a card → card already has a `factId`
2. Quiz overlay shows with that fact
3. Result updates mastery

**New flow for study mode:**
1. Player charges a card → card has NO fact (or fact is placeholder)
2. Check `runConfig.mode === 'study'`
3. Call `selectFactForCharge()` with the card's chain theme pool
4. Assign the selected fact to the card for this charge
5. Quiz overlay shows with the dynamically selected fact
6. Result updates both in-run tracker AND global FSRS

**Changes needed in turnManager.ts:**
- In the charge/quiz initiation code, add a branch for study mode
- Import and use `curatedFactSelector.selectFactForCharge()`
- Import and use `InRunFactTracker` instance (stored on RunState or as module-level singleton)
- After quiz result, call `tracker.recordResult()` AND existing `reviewFact()` for global FSRS
- Pass the selected wrong answer's factId to `recordResult()` for confusion tracking

**Critical:** The existing trivia flow (fact bound at draw time) MUST remain completely unchanged when `mode === 'trivia'` or `mode` is undefined.

**Acceptance:**
- Trivia runs work exactly as before
- Study mode charges dynamically select facts
- In-run tracker is seeded at run start
- Both in-run and global FSRS are updated on charge results

### 2.4 Initialize InRunFactTracker at Run Start

**File:** `src/services/runManager.ts` (MODIFY)

When a study mode run starts:
1. Load the selected deck from `curatedDeckStore`
2. Get all fact IDs (or sub-deck fact IDs if sub-deck selected)
3. Fetch global FSRS states for those fact IDs
4. Create `InRunFactTracker` and call `seedFromGlobalFSRS()`
5. Store tracker on `RunState` (add `inRunFactTracker?: InRunFactTracker` field)

For trivia mode runs, skip all of this — no tracker needed.

**Acceptance:**
- Study run creates and seeds tracker
- Trivia run does not create tracker
- Tracker accessible from turnManager during charges

### 2.5 Card Pool Setup for Study Mode

**File:** `src/services/runManager.ts` or `src/data/card-types.ts` (MODIFY)

In study mode, the `CardRunState.factPool` field is populated differently:
- **Trivia:** Populated from `facts.db` filtered by domain selections (existing behavior)
- **Study:** Populated from the curated deck's fact IDs

Cards drawn in study mode get a `chainThemeId` (generic 0-5 slot) but NO `factId` — the fact is assigned at charge time.

**Acceptance:**
- Study mode cards have chainThemeId but no pre-bound factId
- Trivia mode cards still get factId at draw time (unchanged)

---

## 3. Files Affected

| File | Action | Purpose |
|------|--------|---------|
| `src/services/inRunFactTracker.ts` | CREATE | InRunFactState tracking, cooldown, seeding |
| `src/services/curatedFactSelector.ts` | CREATE | selectFactForCharge() weighted selection |
| `src/services/turnManager.ts` | MODIFY | Branch charge flow for study mode |
| `src/services/runManager.ts` | MODIFY | Initialize tracker at run start, populate study mode fact pool |
| `src/data/card-types.ts` | MODIFY | Add optional fields for study mode card state |

---

## 4. Acceptance Criteria

1. `npm run typecheck` passes
2. `npm run build` succeeds
3. `npx vitest run` — all existing tests pass
4. Trivia mode runs are completely unchanged in behavior
5. Study mode charges select facts dynamically from deck pool
6. In-run tracker correctly weights struggling facts higher
7. Pool exhaustion recovery triggers when < 3 facts available
8. Global FSRS is updated after every charge (both modes)
9. In-run tracker records confusion data (which wrong answer was selected)

---

## 5. Verification Gate

- [ ] `npm run typecheck` — passes
- [ ] `npm run build` — succeeds
- [ ] `npx vitest run` — all tests pass
- [ ] Unit tests for `selectFactForCharge()` with fixed seeds verify weighting
- [ ] Unit tests for `InRunFactTracker` seeding from global FSRS
- [ ] Unit tests for pool exhaustion recovery
- [ ] Manual: Start a trivia run — works exactly as before
- [ ] Update `docs/GAME_DESIGN.md` — document dynamic fact assignment, in-run FSRS
- [ ] Update `docs/ARCHITECTURE.md` — new services, modified charge flow
- [ ] Update `data/inspection-registry.json` — add inRunFactTracker, curatedFactSelector systems

---

## 6. Notes

- The `confusedWith` tracking in InRunFactState feeds into AR-247 (adaptive distractors) but is collected here because we need it at charge-result time.
- The cooldown system prevents the same fact from appearing in consecutive encounters. Duration of 3 encounters is a starting value — balance testing may adjust.
- For vocabulary decks, the fact pool is the FULL deck (not chain-theme-filtered) since vocabulary uses generic chain types. The selector must check the deck type to determine pool scope.
