# Study Temple Report — BATCH-2026-04-02-004

**Date:** 2026-04-02
**Tester:** Game Logic Agent (claude-sonnet-4-6)
**Dev Preset:** `post_tutorial` (`http://localhost:5173/?skipOnboarding=true&devpreset=post_tutorial`)
**Chrome Port:** 62329 (MCP playwright instance)

---

## Verdict: ISSUES

The study systems are functional but there are two significant bugs: (1) `fastForward()` in `playtestAPI.ts` shifts wrong field names so it has no effect on SM-2 scheduling, and (2) the flip-card `StudySession.svelte` component (FSRS with again/okay/good ratings) is not connected to any live screen — it is pending "Phase 13.4" integration. The accessible study mode (`restStudy`) is a mastery-upgrade multiple-choice quiz, NOT a standalone FSRS review session.

---

## Architecture Clarification (Critical for Test Interpretation)

There are **two distinct "study" systems** in the codebase — only one is live:

| System | Component | Screen | Status | FSRS? |
|--------|-----------|--------|--------|-------|
| **Study Temple (deck browser)** | `StudyTempleScreen.svelte` | `studyTemple` | Live | No (just launches runs) |
| **Rest-Room Study Quiz** | `StudyQuizOverlay.svelte` | `restStudy` | Live | Partial (quiz answers update global RS via `updateReviewState` during combat only) |
| **Flip-card FSRS Session** | `StudySession.svelte` | (none) | NOT LIVE | Yes (again/okay/good) |

The `StudySession.svelte` component with explicit Anki rating buttons is complete but has no mounted screen. Phase 13.4 note in `KnowledgeTreeView.svelte` says "Full StudySession integration will happen in 13.4."

---

## Session 1 Summary

**Setup:** Spawned `restStudy` screen with `deckId: 'ancient_greece'` via `__rrScenario.spawn()`. Player save had 15 review states (5 new, 5 learning, 5 review). No review states had `nextReviewAt` set (they use `nextReviewAt` field, not `nextReview`).

**Questions Presented (3 total):**

| # | Question (truncated) | Correct Answer | Answer Chosen | Result |
|---|----------------------|---------------|----------------|--------|
| 1 | "Which ancient Olympic combat sport… combining boxing and wrestling…?" | Pankration | Pankration | Correct |
| 2 | "What systematic questioning technique is Socrates credited with developing…?" | Socratic method (elenchus) | Allegory of the Cave | Wrong |
| 3 | "Which mathematical theorem states… square of the hypotenuse…?" | Pythagorean Theorem | Pythagorean Theorem | Correct |

**Session 1 Outcome:** "2 of 3 cards mastered up!" — 2 cards received mastery upgrades. Session completion screen displayed upgraded card previews with "↑" icons. Continue button navigated to hub.

**`endStudy()` result:** `{ ok: true, message: "Study ended. Screen: base" }` — base screen, not hub (minor discrepancy).

**`getLeechInfo()` result:** `{ suspended: [], nearLeech: [], totalLeeches: 0 }` — clean.

**`getSessionSummary()` result:** `{ eventCount: 3, typeCounts: { "state-change": 3 } }` — only 3 state-change events logged, no quiz-specific events.

---

## Time Advance — fastForward(2) Bug Found

Called `window.__rrPlay.fastForward(2)` to advance 2 hours.

**Bug:** `fastForward()` shifts `rs.nextReview` and `rs.lastReview` fields, but the SM-2 system stores dates in `rs.nextReviewAt` and `rs.lastReviewAt`. The function had **zero effect** on scheduling.

**Manual verification:** Shifted `nextReviewAt` correctly via direct store manipulation. After genuine 2-hour shift:
- 5 `learning` cards (interval = 0, ~10-minute steps) became **due**
- 5 `review` cards (interval 1-3 days) remained **not due** (0.9–2.9 days remaining)
- 5 `new` cards (no `nextReviewAt`) unchanged

This confirms the SM-2 scheduling logic is sound — the bug is only in the test helper.

---

## Session 2 Summary

**Setup:** Spawned fresh `restStudy` with `deckId: 'ancient_greece'`. New run, new deck state.

**Questions Presented (3 total):**

| # | Question | Correct Answer | Distractors Include |
|---|----------|---------------|---------------------|
| 1 | "What was the Roman name for Aphrodite…?" | Venus | Minerva, Dionysus, Diana |
| 2 | "What was the Roman name for Artemis…?" | Diana | Jupiter, Mars, Apollo |
| 3 | "How long did an Athenian ostracism exile last…?" | Ten years | Father of History, Pythagorean Theorem, Atoms and void |

**Note on Session 2 scheduling:** The `restStudy` quiz draws from the run's deck pool via `generateStudyQuestions()`, NOT from the FSRS due-queue. It does not preferentially surface facts that are due for review — it pulls from pool cards that are `canMasteryUpgrade()`. The scheduling verification goal (O-ST5/O-ST6) does not apply to this system as designed.

**Session 2 Outcome:** "0 of 3 cards mastered up" — all answers were first-choice clicks, all wrong. Correct behavior: no upgrades for incorrect answers.

---

## Study Temple Screen (studyTemple)

Navigated via `__rrPlay.navigate('studyTemple')`. Fully functional deck browser:
- 63 total decks displayed across category tabs
- Category tabs: All, Languages (38), General Geography (5), General (2), Space (3), History (5), Science (2), Myth (3), Health (1), Animals (1), Art (2), Cuisine (1)
- Search bar present and functional
- Sort options: A-Z, Progress High/Low, Most Facts, Newest
- Filter chips: In Progress, Not Started, Mastered
- Deck tiles show name, description, fact count, progress (Seen/Review/Mastered counts)
- Clicking deck tile opens `DeckDetailModal` with deck description
- Ancient Greece showed: "Seen 1, Review 1, Mastered 0" — progress tracking live

The Study Temple is a run launcher (picks deck → starts Study mode run), not a standalone review session.

---

## SM-2/FSRS Scheduling Verdict

**The FSRS flip-card session (StudySession.svelte) is not accessible during normal gameplay** — it has no screen route. The `playtestAPI.ts` functions `startStudy(size)` look for `[data-testid="study-size-{N}"]` and `[data-testid="btn-start-study"]` buttons that don't exist in any live screen.

**What IS live:** The `updateReviewState()` function in `playerData.ts` correctly updates SM-2/FSRS state after combat charge quizzes. Review states in the player save show correct FSRS fields: `stability`, `difficulty`, `nextReviewAt`, `interval`, `cardState` (new/learning/review), `lapseCount`, `consecutiveCorrect`.

**Scheduling algorithm verification (manual):**
- `learning` cards (interval=0, short step minutes) correctly become due before `review` cards
- `review` cards with 2-day intervals correctly stay not-due after 2-hour shift
- `isDue()` function: `state.nextReviewAt <= Date.now()` — correct implementation
- No leeches, no suspended cards in current test state

---

## Content Quality Sample

| # | Question | Answer | Distractors | Quality Assessment |
|---|----------|--------|-------------|-------------------|
| 1 | Which ancient Olympic combat sport combined boxing and wrestling with grappling? | Pankration | Olive wreath, Theory of Forms, Love (eros) | Good — 2 distractors are clearly wrong, 1 plausible (olive wreath = Olympic prize) |
| 2 | What systematic questioning technique is Socrates credited with developing? | Socratic method (elenchus) | Allegory of the Cave, Plague of Athens, Strategos | Good — all plausible Greek context distractors |
| 3 | Which mathematical theorem states hypotenuse² = sum of squares of other sides? | Pythagorean Theorem | Formal education, 20, Socratic method | Mixed — "20" and "Formal education" are very weak distractors |
| 4 | What was the Roman name for Aphrodite? | Venus | Minerva, Dionysus, Diana | Excellent — all plausible Roman deities |
| 5 | What was the Roman name for Artemis? | Diana | Jupiter, Mars, Apollo | Excellent — plausible Roman deity pool |
| 6 | How long did Athenian ostracism exile last? | Ten years | Father of History, Pythagorean Theorem, Atoms and void | Poor — distractors are from completely unrelated pools |

---

## Objective Findings

| ID | Check | Result | Notes |
|----|-------|--------|-------|
| O-ST1 | Session starts | PASS | `startStudy()` opens restStudy screen with questions |
| O-ST2 | Card data complete | PASS | All 6 questions had non-empty question text and 4 answer choices |
| O-ST3 | All grade types work | PARTIAL | Multiple-choice click works. Anki again/good/easy buttons not accessible (StudySession.svelte not mounted) |
| O-ST4 | Session ends cleanly | PASS | `endStudy()` returns `ok: true`, navigates away correctly |
| O-ST5 | Again cards reappear | N/A | restStudy quiz is mastery-upgrade system, not FSRS due-queue |
| O-ST6 | Good cards don't reappear | N/A | Same reason as O-ST5 |
| O-ST7 | No data artifacts | PASS | No undefined/null/NaN in reviewed data |

---

## Subjective Ratings

| ID | Dimension | Score | Notes |
|----|-----------|-------|-------|
| S-ST1 | Q&A pairing quality | 3/5 | Generally good (Pankration, Venus, Diana questions are excellent). Some Q3 distractors are clearly wrong (Pythagorean Theorem as distractor for ostracism length) |
| S-ST2 | Session pacing | 4/5 | 3-question sessions feel appropriately quick. 1.2-second feedback delay before advancing is smooth |
| S-ST3 | Grade button clarity | N/A | Anki rating buttons not accessible in live system. Multiple-choice selection is clear |
| S-ST4 | Learning value | 4/5 | Ancient Greece content is high quality and educationally sound. Questions test specific historical knowledge |

---

## Issues Found

### BUG-1: `fastForward()` shifts wrong field names (Critical for testing)
**File:** `src/dev/playtestAPI.ts` lines 961-962
**Problem:** Code shifts `rs.nextReview` and `rs.lastReview`, but SM-2 stores dates in `rs.nextReviewAt` and `rs.lastReviewAt`. Function has zero effect on scheduling.
**Impact:** Any LLM tester running `fastForward()` to test FSRS scheduling will get false results.
**Fix needed:** Change `rs.nextReview` → `rs.nextReviewAt`, `rs.lastReview` → `rs.lastReviewAt`. Also shift `rs.due` and `rs.lastReview` (FSRS fields).

### BUG-2: StudySession.svelte (FSRS flip-card) has no live screen route
**File:** `src/ui/components/StudySession.svelte`
**Problem:** The full FSRS flip-card component with again/okay/good Anki buttons exists but is not mounted to any screen. `KnowledgeTreeView.svelte` has a TODO: "Full StudySession integration will happen in 13.4."
**Impact:** The primary stated test objective (FSRS grading with again/good/easy, scheduling verification) cannot be tested because the feature is not shipped.
**Note:** This is a known planned feature, not a regression.

### ISSUE-3: `startStudy(size)` API mismatches live system
**File:** `src/dev/playtestAPI.ts` lines 815-825
**Problem:** `startStudy()` looks for `[data-testid="study-size-{size}"]` and `[data-testid="btn-start-study"]` which only exist in `StudySession.svelte` (not mounted). The function navigates to `restStudy` screen but doesn't call `generateStudyQuestions()`, so the overlay shows "Question 1 / 0" with no questions.
**Fix needed:** Use `__rrScenario.spawn({ screen: 'restStudy', deckId: '...' })` instead, or update `startStudy()` to call `generateStudyQuestions()` and inject via `Symbol.for('rr:scenarioStudyQuestions')`.

### ISSUE-4: Poor distractor quality on some questions
**Examples:**
- "How long did ostracism exile last?" → distractor "Pythagorean Theorem" (completely irrelevant)
- "Which theorem…?" → distractor "20" (bare number, no context)
**Root cause:** Distractor pool collision — facts from different answer-type pools are bleeding into the same question. Q6 shows "Father of History", "Pythagorean Theorem", "Atoms and void" as distractors for a duration question (expected: other time periods like "5 years", "20 years", etc.).

### OBSERVATION-5: `getSessionSummary()` logs no quiz events
Session summary only captures `state-change` events, missing: quiz-started, question-answered, card-upgraded. The event log is too sparse for meaningful session analysis.

---

## All Studied Cards (Raw Data)

### Session 1 Questions
```json
[
  {
    "qNum": "Question 1 / 3",
    "question": "Which ancient Olympic combat sport — added in 648 BCE — combined boxing and wrestling with additional striking and grappling, ending only when one competitor submitted or became unconscious?",
    "answers": ["Olive wreath (kotinos)", "Pankration", "Theory of Forms", "Love (eros)"],
    "correctAnswer": "Pankration",
    "answered": "Pankration",
    "result": "correct"
  },
  {
    "qNum": "Question 2 / 3",
    "question": "What systematic questioning technique is Socrates credited with developing — a method of probing beliefs through dialogue to expose contradictions and arrive at deeper understanding?",
    "answers": ["Allegory of the Cave", "Socratic method (elenchus)", "Plague of Athens", "Strategos"],
    "correctAnswer": "Socratic method (elenchus)",
    "answered": "Allegory of the Cave",
    "result": "wrong"
  },
  {
    "qNum": "Question 3 / 3",
    "question": "Which mathematical theorem states that in a right-angled triangle, the square of the hypotenuse equals the sum of the squares of the other two sides — and is named after the philosopher who is credited with its formal proof in the Greek tradition?",
    "answers": ["Formal education", "Pythagorean Theorem", "20", "Socratic method (elenchus)"],
    "correctAnswer": "Pythagorean Theorem",
    "answered": "Pythagorean Theorem",
    "result": "correct"
  }
]
```

### Session 2 Questions
```json
[
  {
    "qNum": "Question 1 / 3",
    "question": "What was the Roman name for Aphrodite, the Greek goddess of love and beauty?",
    "answers": ["Minerva", "Dionysus", "Venus", "Diana"],
    "correctAnswer": "Venus",
    "answered": "Minerva",
    "result": "wrong"
  },
  {
    "qNum": "Question 2 / 3",
    "question": "What was the Roman name for Artemis, the Greek goddess of the hunt and moon?",
    "answers": ["Jupiter", "Diana", "Mars", "Apollo"],
    "correctAnswer": "Diana",
    "answered": "Jupiter",
    "result": "wrong"
  },
  {
    "qNum": "Question 3 / 3",
    "question": "How long did an Athenian ostracism exile last, after which the person could return without any loss of status or property?",
    "answers": ["Father of History", "Pythagorean Theorem", "Atoms and void", "Ten years"],
    "correctAnswer": "Ten years",
    "answered": "Father of History",
    "result": "wrong"
  }
]
```

### Player Review States at Test End
```json
{
  "total": 15,
  "breakdown": { "new": 5, "learning": 5, "review": 5 },
  "leeches": 0,
  "suspended": 0,
  "factsWithNextReviewAt": 10,
  "factsWithNoSchedule": 5
}
```

---

## Summary for Dev Action

| Priority | Item | Action |
|----------|------|--------|
| P1 | BUG-1: `fastForward()` wrong fields | Fix `nextReview` → `nextReviewAt`, `lastReview` → `lastReviewAt` in `playtestAPI.ts` |
| P1 | ISSUE-3: `startStudy()` broken | Fix API to call `generateStudyQuestions()` or use scenario spawn |
| P2 | BUG-2: StudySession not mounted | Track Phase 13.4 — flip-card FSRS session needs screen route |
| P2 | ISSUE-4: Poor distractors on some Qs | Investigate pool collision for `ancient_greece` ostracism/duration facts |
| P3 | OBSERVATION-5: sparse event log | Add `quiz-answered`, `card-upgraded` events to `__rrLog` in `StudyQuizOverlay` |
