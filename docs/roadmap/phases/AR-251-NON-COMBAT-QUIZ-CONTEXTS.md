# AR-251: Non-Combat Quiz Contexts

**Status:** Pending
**Complexity:** Small-Medium (modify existing quiz callsites to support study mode)
**Dependencies:** AR-246 (InRunFactTracker, selectFactForCharge), AR-247 (selectDistractors, ConfusionMatrix)
**Spec Reference:** `docs/RESEARCH/DECKBUILDER.md` section 4.8

---

## 1. Overview

Shop haggling, rest site study, and boss quiz phases all present quizzes outside of combat. In study mode, these must pull from the curated deck pool (not the trivia DB) and update both in-run and global FSRS.

**Key difference from combat charges:** Non-combat quizzes draw from the **full deck pool** (all chain themes), not a specific chain theme subset, since they are not attached to a card.

---

## 2. Sub-Steps

### 2.1 Identify All Non-Combat Quiz Callsites

Audit the codebase for all places that trigger quizzes outside of the combat charge flow. Expected locations:

| Context | File(s) | Current Behavior |
|---------|---------|-----------------|
| Shop haggling | `src/game/scenes/ShopScene.ts` or shop UI component | 1 question per purchase, correct = 30% discount |
| Rest site study | `src/game/scenes/RestSiteScene.ts` or rest UI component | 3 questions, correct raises card slot mastery |
| Boss quiz phase | `src/game/scenes/CombatScene.ts` (boss special phase) | Questions from run pool |
| Mystery room quiz | `src/game/scenes/MysteryRoomScene.ts` or equivalent | Varies by event |

Each callsite currently calls into `quizService` to get a fact and choices.

**Acceptance:** All non-combat quiz callsites identified and documented.

### 2.2 Create Unified Non-Combat Quiz Selector

**File:** `src/services/nonCombatQuizSelector.ts` (NEW)

A single function that handles non-combat quiz fact selection for both modes:

```typescript
import type { DeckFact } from '../data/curatedDeckTypes';
import type { Fact } from '../data/factTypes';

export interface NonCombatQuizQuestion {
  /** The question text */
  question: string;
  /** The correct answer */
  correctAnswer: string;
  /** All choices (correct + distractors), shuffled */
  choices: string[];
  /** The source fact ID (for FSRS update) */
  factId: string;
  /** Whether this is from a curated deck */
  isStudyMode: boolean;
}

/**
 * Select a quiz question for non-combat contexts (shop, rest, boss, mystery).
 *
 * - Trivia mode: uses existing quizService logic (unchanged)
 * - Study mode: selects from full deck pool (all themes), uses pool-based distractors,
 *   applies deck-specific question templates
 *
 * Non-combat quizzes always draw from the FULL deck pool, not a chain theme subset.
 */
export function selectNonCombatQuestion(
  context: 'shop' | 'rest' | 'boss' | 'mystery'
): NonCombatQuizQuestion;
```

**For study mode:**
1. Call `selectFactForCharge()` with the **full deck fact pool** (not filtered by chain theme)
2. Call `selectQuestionTemplate()` (AR-248) for the question format
3. Call `selectDistractors()` (AR-247) for pool-based choices
4. Return assembled question

**For trivia mode:**
1. Delegate to existing `quizService` functions (no change)

**Acceptance:** Both modes produce valid questions for all non-combat contexts.

### 2.3 Update Shop Haggling

**File:** Shop scene/component (MODIFY)

Replace direct `quizService` call with `selectNonCombatQuestion('shop')`.

After answer:
- **Study mode:** Update `inRunFactTracker.recordResult()` AND global FSRS. Record confusion if wrong.
- **Trivia mode:** Existing behavior (global FSRS update only).

**Acceptance:** Shop quiz works in both modes. Study mode updates in-run tracker.

### 2.4 Update Rest Site Study

**File:** Rest site scene/component (MODIFY)

Replace direct quiz calls with `selectNonCombatQuestion('rest')` for each of the 3 questions.

After each answer:
- **Study mode:** Update in-run tracker AND global FSRS. Confusion matrix updates.
- **Trivia mode:** Existing behavior.

Rest site study results that affect card mastery continue working as before — the mastery upgrade is independent of fact source.

**Acceptance:** Rest site study works in both modes. 3 questions served from deck pool in study mode.

### 2.5 Update Boss Quiz Phase

**File:** Boss combat special phase (MODIFY)

If the boss has a quiz phase, replace with `selectNonCombatQuestion('boss')`.

**Acceptance:** Boss quiz phase uses deck pool in study mode.

### 2.6 Update Mystery Room Quiz Events

**File:** Mystery room event handlers (MODIFY)

Any mystery events that present quiz questions should use `selectNonCombatQuestion('mystery')`.

**Acceptance:** Mystery room quizzes use deck pool in study mode.

---

## 3. Files Affected

| File | Action | Purpose |
|------|--------|---------|
| `src/services/nonCombatQuizSelector.ts` | CREATE | Unified non-combat quiz selection |
| Shop scene/component | MODIFY | Use nonCombatQuizSelector |
| Rest site scene/component | MODIFY | Use nonCombatQuizSelector |
| Boss combat phase | MODIFY | Use nonCombatQuizSelector |
| Mystery room events | MODIFY | Use nonCombatQuizSelector |

---

## 4. Acceptance Criteria

1. `npm run typecheck` passes
2. `npm run build` succeeds
3. `npx vitest run` — all tests pass
4. Shop, rest, boss, and mystery quizzes all work in trivia mode (unchanged)
5. Shop, rest, boss, and mystery quizzes all work in study mode (deck pool)
6. Non-combat study mode quizzes draw from FULL deck pool (not chain-theme-filtered)
7. Non-combat study mode quizzes use deck-specific templates
8. Non-combat study mode quizzes use pool-based distractors
9. Both in-run tracker and global FSRS update after non-combat quizzes in study mode
10. Confusion matrix records from non-combat quizzes persist

---

## 5. Verification Gate

- [ ] `npm run typecheck` — passes
- [ ] `npm run build` — succeeds
- [ ] `npx vitest run` — all tests pass
- [ ] Manual: Shop haggling in trivia mode — unchanged
- [ ] Manual: Shop haggling in study mode — deck pool question
- [ ] Manual: Rest site study in both modes
- [ ] Visual inspection of quiz overlay in non-combat contexts
- [ ] Update `docs/GAME_DESIGN.md` — document non-combat quiz behavior per mode
- [ ] Update `docs/ARCHITECTURE.md` — new service, modified callsites
- [ ] Update `data/inspection-registry.json` — update shop, rest, mystery, boss entries
