# AR-253: Anki-Faithful Fact Selection for Curated Decks

**Status:** In Progress
**Priority:** Critical
**Complexity:** Medium
**Depends on:** AR-252 (Solar System deck)

---

## Problem

The curated deck fact selection keeps showing the same questions or burns through all new cards first before reviewing. The current implementation is a rough approximation of Anki. We need to match Anki's actual algorithm faithfully.

---

## Anki's Actual Algorithm (from source code analysis)

### Three Card States (not queues — states with timers)

1. **NEW** — never seen this session. Sits in the new card pool waiting to be introduced.
2. **LEARNING** — seen but not yet graduated. Has a **step counter** and a **due timer**. Cards progress through learning steps on correct answers, reset to step 1 on wrong answers.
3. **GRADUATED (review)** — completed all learning steps. Has a longer due timer before it appears again.

### Learning Steps (Anki default: 1min, 10min, then graduate)

Adapted to our charge-based context (charges ≈ time intervals):

| Event | Result |
|-------|--------|
| New card answered **correctly** | Enters LEARNING step 1. Due in **2 charges**. |
| Learning step 1 answered **correctly** | Advances to step 2. Due in **5 charges**. |
| Learning step 2 answered **correctly** | **GRADUATES** to review. Due in **10 charges**. |
| ANY card answered **wrong** | Goes to LEARNING step 1. Due in **2 charges**. (Anki "Again" button) |
| Graduated card answered **correctly** | Stays graduated. Due in **10 charges**. |
| Graduated card answered **wrong** | **Un-graduates**. Back to LEARNING step 1. Due in **2 charges**. |

### Queue Priority (exactly Anki)

Every time a fact is needed, check in this order:

1. **Due learning cards** — any card in LEARNING state whose timer has expired. ALWAYS shown first. This is Anki's core insight: learning cards are time-critical.
2. **Main queue (Intersperser)** — mix of due graduated reviews + new cards, proportionally interleaved.
3. **Ahead learning** — learning cards not yet due. Only shown if nothing else is available.

### Intersperser (Anki's proportional mixing of new + review)

NOT a probability roll. Anki uses a deterministic interleaving pattern:

```
ratio = (reviewCount + 1) / (newCount + 1)
```

At each position, compare `(idx_new + 1) * ratio` vs `(idx_review + 1)`. If the review index is behind, yield a review; otherwise yield a new card.

For simplicity, we can use the probability approximation:
```
P(pick review) = reviewCount / (reviewCount + newCount)
P(pick new) = newCount / (reviewCount + newCount)
```

This ensures:
- Early run (70 new, 0 review): all new — correct, you need to SEE cards first
- After ~8 cards seen (62 new, 3 review, 5 learning): mostly new but reviews start appearing
- Mid-run (40 new, 20 review): ~33% reviews, ~67% new
- Late run (5 new, 60 review): ~92% reviews, ~8% new

### New Card Introduction Limit

Anki caps simultaneous learning cards (default ~20/day). For our game runs:
- **Max 8 cards in LEARNING state simultaneously**
- If 8 cards are already learning, don't introduce new ones until some graduate
- This prevents overwhelming the player with too many cards at once

### Never repeat immediately

The last shown card is ALWAYS excluded from selection, regardless of state.

---

## Current Code (what needs to change)

### `src/services/inRunFactTracker.ts`

**Remove:**
- `chargeCooldowns: Map<string, number>` — replaced by learning step tracking
- `isChargeOnCooldown()` — replaced by state-based queries
- `recordCharge()` — rewritten with learning step logic

**Add:**
- `learningCards: Map<string, { step: number, dueAtCharge: number }>` — tracks cards in learning with their current step and when they're due
- `graduatedCards: Map<string, number>` — tracks graduated cards with their due-at-charge number
- `STEP_DELAYS = [2, 5]` — charges before learning card is due again (step 1 = 2, step 2 = 5)
- `GRADUATE_DELAY = 10` — charges before graduated card is due again
- `MAX_LEARNING = 8` — max simultaneous learning cards

**New methods:**
- `recordCharge(factId, correct)` — implements the learning step state machine (see table above)
- `getDueLearningCards()` — returns fact IDs in learning whose `dueAtCharge <= totalCharges`
- `isInLearning(factId)` — true if card is in learning state
- `isGraduated(factId)` — true if card has graduated
- `isGraduatedAndDue(factId)` — true if graduated AND `dueAtCharge <= totalCharges`
- `canIntroduceNew()` — true if `learningCards.size < MAX_LEARNING`

**Keep unchanged:**
- `recordResult()` — performance state (correctCount, wrongCount, confusedWith)
- `seedFromGlobalFSRS()` — pre-seeding from global FSRS at run start
- `advanceEncounter()` — encounter counter
- `chargeCount` / `getAndIncrementChargeCount()` — seed variation
- `recentTemplateIds` tracking
- `totalCharges` / `lastFactId` / `getLastFactId()` / `getTotalCharges()`

### `src/services/curatedFactSelector.ts`

**Rewrite `selectFactForCharge()` to:**

1. Check for due learning cards (filter by `getDueLearningCards()`, exclude lastFactId)
   - If any: pick randomly from due learning cards. Return with reason `'struggling'`.

2. Build main queue from graduated-and-due reviews + new cards (if `canIntroduceNew()`)
   - If both exist: use Intersperser probability to pick review vs new
   - If only reviews: pick from reviews
   - If only new: pick from new

3. Fallback to ahead-learning cards (in learning but not yet due)

4. Ultimate fallback: any card except lastFactId

### Callers of removed methods

Grep for `isChargeOnCooldown` and `chargeCooldowns` — update or remove all callers.

---

## Expected Behavior (simulation targets)

### Test 1: 20 charges, all correct
- First ~8 charges: all new (no reviews exist yet)
- Charges 9-10: learning cards from step 1 start becoming due (cards from charges 1-2 return)
- Charges 11-20: mix of new, learning step 2, and early graduates
- Should see ~15 unique cards, with the first few appearing 2-3 times

### Test 2: 20 charges, every 3rd wrong
- Wrong cards go to learning step 1, reappear after 2 charges
- Wrong cards should appear more frequently than correct ones
- Correct cards advance through steps and eventually graduate

### Test 3: Verify no back-to-back repeats ever

---

## Acceptance Criteria

1. Learning step state machine matches the table above exactly
2. Due learning cards always shown before new/review
3. Intersperser proportionally mixes new and review cards
4. Max 8 cards in learning at once
5. Wrong answers always reset to learning step 1
6. Graduated cards have 10-charge cooldown
7. Never show the same card twice in a row
8. All existing callers updated (no compile errors)
9. Simulation shows proper interleaving (not all-new first)
10. `npm run typecheck` + `npm run build` clean

---

## Files Affected

| File | Action |
|------|--------|
| `src/services/inRunFactTracker.ts` | Modify — add learning step state machine |
| `src/services/curatedFactSelector.ts` | Rewrite — three-priority selection |
| `src/ui/components/CardCombatOverlay.svelte` | Verify recordCharge call still works |
| `src/services/nonCombatQuizSelector.ts` | Verify non-combat quiz path still works |

---

## Verification

- [ ] Typecheck clean
- [ ] Build clean
- [ ] Simulation: 20 charges all-correct shows interleaving (not all-new)
- [ ] Simulation: wrong answers return after 2 charges
- [ ] Simulation: cards graduate after 3 correct (step1 → step2 → graduate)
- [ ] Simulation: zero back-to-back repeats
- [ ] Simulation: max 8 in learning at once
- [ ] Grep: no references to removed methods
