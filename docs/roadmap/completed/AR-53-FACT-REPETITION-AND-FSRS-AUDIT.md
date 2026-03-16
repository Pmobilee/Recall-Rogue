# AR-53: Fix Fact Repetition + FSRS Progress Audit

**Status:** Complete (repetition fixes done, FSRS audit pending browser check)
**Created:** 2026-03-16
**Estimated complexity:** Medium

---

## Problem 1: Same Facts Repeat Too Quickly

User reports seeing the same facts after each encounter despite cooldown system existing.

### Current System (from code analysis)

The cooldown system IS in place:
- `FACT_COOLDOWN_MIN = 3`, `FACT_COOLDOWN_MAX = 5` encounters
- After answering a fact, it's blocked for 3-5 encounters via `addFactsToCooldown()`
- `tickFactCooldowns()` decrements at start of each encounter

**But there's a key issue:** The `factPool` is fixed at run start (120 facts) and NEVER grows. New cards added via rewards get card types (attack/shield/utility) but draw from the SAME 120 fact pool. So across a 10+ encounter run:
- Pool: 120 facts
- Per encounter: ~5-10 facts quizzed (hand of 5, some answered)
- Cooldown: 3-5 encounters
- By encounter 6+, early facts come off cooldown and cycle back

With only ~300 facts per knowledge domain and 120 in the pool, this means ~40% of the domain is in play. After 3-4 floors, you've seen most of them.

### Root Causes

1. **Pool size too small for domain size**: With 300+ facts per domain, a 120-fact pool uses only 40%. Increasing pool size would help.
2. **Cooldown too short**: 3 encounters = seeing the same fact every ~15 minutes in a fast run. Should be higher.
3. **No floor-based minimum**: The cooldown is encounter-based, not floor-based. A floor with 3 encounters could cycle the same fact back by the next floor.
4. **factPool is static**: No new facts enter the pool mid-run. Reward cards get new card TYPES but reuse the same fact pool.

### Proposed Fix

1. [ ] **Increase default pool size**: `DEFAULT_POOL_SIZE` from 120 → 200 (or scale with domain size)
2. [ ] **Increase cooldown minimum**: `FACT_COOLDOWN_MIN` from 3 → 5, `FACT_COOLDOWN_MAX` from 5 → 8
3. [ ] **Add floor-based cooldown tracking**: Track which facts were seen on each floor. Prevent ANY fact from appearing on two consecutive floors.
4. [ ] **Consider pool refresh on descend**: When descending to a new floor, optionally add 10-20 new facts from the domain to the pool (replacing exhausted ones)

---

## Problem 2: FSRS Progress Not Visible / Not Working?

User has done many runs but never completed one, and wants to know if FSRS is tracking progress.

### How FSRS Currently Works

1. **Every quiz answer calls `updateReviewState()`** — correct or incorrect
2. Review states persist to **localStorage** (`recall-rogue-save` key)
3. **No login required** — all progress is local
4. The FSRS scheduler (ts-fsrs) updates: stability, difficulty, due date, state (new→learning→review)
5. **But:** `selectQuestion()` only picks facts in `'review'` state that are DUE. New/learning cards stay in the StudySession flow.

### Potential Issues

1. **Incomplete runs**: If the user never finishes a run, do the FSRS updates from mid-run encounters persist? Need to check — `updateReviewState()` is called after each answer, and `persistPlayer()` saves immediately. So YES, partial runs should save progress.
2. **State transitions**: A fact starts as `'new'`, moves to `'learning'` after first answer, then to `'review'` after graduating. The quiz selection only picks `'review'` state facts. If facts never graduate from `'learning'`, they won't be selected for quizzes.
3. **Visibility**: There's no screen showing the user their FSRS progress (which facts they've learned, their retention rate, upcoming reviews). The Knowledge Library shows domain completion but not individual fact progress.

### Audit TODO

1. [ ] **Check localStorage**: Navigate to the app, extract `recall-rogue-save`, count how many `reviewStates` exist and in what states (new/learning/review/relearning)
2. [ ] **Verify FSRS is being called**: Add temporary logging to confirm `updateReviewState()` fires on each quiz answer
3. [ ] **Check state transitions**: Verify facts progress from new→learning→review correctly
4. [ ] **Report to user**: How many facts have been reviewed, what's their average retrievability

---

## Sub-steps

### Fact Repetition Fix
1. [ ] Increase `DEFAULT_POOL_SIZE` to 200 in `balance.ts`
2. [ ] Increase `FACT_COOLDOWN_MIN` to 5, `FACT_COOLDOWN_MAX` to 8
3. [ ] Add floor-level fact tracking: `deck.floorFactHistory: Set<string>[]` — one set per floor
4. [ ] In `drawHand()`, additionally filter out facts seen on the PREVIOUS floor (not just cooldown)
5. [ ] Test: verify in a playthrough that no fact repeats on consecutive floors

### FSRS Audit
6. [ ] Check user's localStorage for reviewStates count and distribution
7. [ ] Verify updateReviewState is called on each answer (add console.log if needed)
8. [ ] Report findings to user

---

## Acceptance Criteria

- [ ] No fact appears on two consecutive floors
- [ ] Fact cooldown is at least 5 encounters (was 3)
- [ ] Pool size increased to reduce repetition
- [ ] FSRS state verified as working for anonymous users
- [ ] User's progress report generated

## Files Affected

- `src/data/balance.ts` — pool size, cooldown constants
- `src/services/deckManager.ts` — floor-based cooldown, pool refresh
- `src/services/encounterBridge.ts` — floor transition hooks
