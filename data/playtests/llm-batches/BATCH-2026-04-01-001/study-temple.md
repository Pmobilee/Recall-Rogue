# Study Temple Report — BATCH-2026-04-01-001
**Tester**: Study Temple | **Model**: sonnet | **Domain**: ancient_rome (deck)
**Date**: 2026-04-01

---

## Verdict: ISSUES

The study system functions and delivers educational content, but the playtest API (`startStudy`/`getStudyCard`/`gradeCard`) is **non-functional** due to a DOM mismatch. The actual `restStudy` screen renders a `StudyQuizOverlay` (multiple-choice), not the SM-2 flashcard `StudySession` that the API targets. Additionally, a duplicate question bug was found in Session 1, and several distractors are semantically incoherent.

---

## Architecture Discovery (Critical Context)

The `restStudy` screen is **not** an SM-2 spaced-repetition review session. It is a `StudyQuizOverlay` — a 3-question multiple-choice knowledge quiz used at in-run rest sites. The SM-2 scheduling system (`StudySession` with again/okay/good buttons) exists in the codebase but is rendered in a different context not reachable via the `restStudy` scenario.

**Consequence for this test**: The O-ST3, O-ST5, O-ST6 objectives (grading with again/hard/good/easy, SM-2 interval scheduling) **cannot be tested** via the `restStudy` screen. The `startStudy()`/`getStudyCard()`/`gradeCard()` playtest API methods return null/fail because they target `[data-testid="study-card-question"]` which only exists in `StudySession`, not in `StudyQuizOverlay`.

---

## Session 1 Summary
- **Scenario loaded**: `study-deck-rome` (ancient_rome deck)
- **Cards in session**: 3
- **All answered correctly**: Yes (3/3)
- **Session completed**: Yes ("Study Complete! 3 of 3 cards mastered up!")
- **Near-leech cards**: 0
- **BUG**: Question 2 and Question 3 were identical (duplicate Hannibal Barca question)

### Session 1 Cards

| # | Question | Correct Answer | Choices |
|---|----------|---------------|---------|
| 1 | Which day of the week is named after Saturn — the Roman god of time, agriculture, and the mythological Golden Age? | Saturday | Saturday, Jupiter, Ceres, Vulcan |
| 2 | Which Carthaginian general crossed the Alps with war elephants to invade Italy in 218 BCE? | Hannibal Barca | vandalism, Marcus Junius Brutus and Gaius Cassius Longinus, Scourge of God, Hannibal Barca |
| 3 | *(DUPLICATE of Q2)* Which Carthaginian general crossed the Alps with war elephants to invade Italy in 218 BCE? | Hannibal Barca | Marcus Junius Brutus and Gaius Cassius Longinus, vandalism, Scourge of God, Hannibal Barca |

---

## Time Advance

- `fastForward(2)` — Advance 2 hours
- Result: `{ok: true, message: "Fast-forwarded 2 hours"}`
- **No effect on question pool** — the scenario generates fresh questions from the deck each time, not from a due-card queue

---

## Session 2 Summary (after +2 hours)
- **Scenario loaded**: `study-deck-rome` (fresh scenario load)
- **Cards in session**: 3
- **All different from Session 1**: Yes (no overlap in questions shown)
- **All answered correctly**: Yes (3/3)
- **Session completed**: Yes

### Session 2 Cards

| # | Question | Correct Answer | Choices |
|---|----------|---------------|---------|
| 1 | In what year did Mount Vesuvius erupt, burying Pompeii and Herculaneum in ash? | 79 CE | three, September 2, 31 BCE, 64 CE, 79 CE |
| 2 | On what date was Julius Caesar assassinated? | March 15, 44 BCE | About 482 years (509 BCE to 27 BCE), March 15, 44 BCE, 216 BCE, 1453 CE |
| 3 | According to Roman tradition established by Varro's chronology, in what year was Rome founded by Romulus? | 753 BCE | 58–50 BCE, 23, 753 BCE, September 2, 31 BCE |

---

## SM-2 Scheduling Verdict

**NOT TESTABLE via `restStudy` scenario.** The `restStudy` screen uses `StudyQuizOverlay` (random question generation from deck), not SM-2 due-card scheduling. The playtest protocol's O-ST5 and O-ST6 objectives assume SM-2 flashcards with again/hard/good/easy grading — this system does not exist at the `restStudy` endpoint.

SM-2 scheduling (via `StudySession.svelte` with again/okay/good buttons) appears to exist in the codebase and is used at the rest room, but it is populated from `reviewStates` in the player save — only relevant for cards the player has previously "learned" via artifact discovery. A fresh player has no `reviewStates`, so the SM-2 session would also be empty.

**The playtest API `startStudy()` / `getStudyCard()` / `gradeCard()` is effectively dead** for a new player state. This is a documentation/API mismatch that should be resolved.

---

## Objective Findings

| ID | Check | Result | Notes |
|----|-------|--------|-------|
| O-ST1 | Session starts | PARTIAL | `startStudy(10)` returns `{ok: true}` but with 0 cards; `__rrScenario.load('study-deck-rome')` works with 3 cards |
| O-ST2 | Card data complete | PASS | All questions have full text and 4 answer choices |
| O-ST3 | Grade all types (again/hard/good/easy) | FAIL | These buttons do not exist on `restStudy` screen; system uses multiple-choice answer buttons |
| O-ST4 | Session ends | PASS | Session ends with "Study Complete!" screen and Continue button |
| O-ST5 | SM-2 again cards reappear after +2h | N/A | `restStudy` generates fresh questions each session, not from due-card queue |
| O-ST6 | SM-2 good cards don't reappear after 2h | N/A | Same reason — not schedule-driven |
| O-ST7 | No data artifacts | PARTIAL | No undefined/null/NaN, but duplicate question appeared (Q2=Q3 in Session 1) |

---

## Subjective Assessments

| ID | Check | Score (1-5) | Notes |
|----|-------|-------------|-------|
| S-ST1 | Q-A pairing quality | 4/5 | Questions are well-formed and educational. Session 1 Q2 distractor "vandalism" and "Scourge of God" are poor fits for a "which general" question — these are concepts/epithets, not people. Session 2 distractor "three" for a year question is obviously wrong and breaks immersion. |
| S-ST2 | Session pacing | 4/5 | 3 questions is brisk for a rest-site break — appropriate pacing for in-run context. The 1200ms auto-advance after answering feels right. |
| S-ST3 | Grade clarity | 3/5 | Multiple-choice answers are clear, but there are no labels like "again/hard/good/easy" to signal long-term scheduling. Players get no feedback on when they'll see this card again. |
| S-ST4 | Learning value | 4/5 | Content quality is high for the ancient_rome deck — Saturn/Saturday etymology, Hannibal's Alpine crossing, Vesuvius 79 CE, Ides of March, founding of Rome are all genuinely educational facts with appropriate difficulty. |

---

## Issues Found

### BUG-001 (High): Duplicate question in Session 1
- **Q2 and Q3 in Session 1 were identical** — "Which Carthaginian general crossed the Alps with war elephants to invade Italy in 218 BCE?"
- The scenario generates 3 questions from the deck; the deduplication logic is either absent or failed
- Choices were shuffled differently between the two appearances, confirming it was generated twice
- **Visible in completion screen**: CARDS UPGRADED list showed "Which Carthaginian general crossed th…" twice

### BUG-002 (Medium): Playtest API `startStudy()`/`getStudyCard()`/`gradeCard()` non-functional
- `startStudy(10)` navigates to `restStudy` but returns 0 cards for a fresh player (no review states)
- `getStudyCard()` always returns `null` on `restStudy` — looks for `[data-testid="study-card-question"]` which is a `StudySession` element, not present in `StudyQuizOverlay`
- `gradeCard('again'|'hard'|'good'|'easy')` looks for `.rating-btn--{button}` class elements that don't exist
- Workaround: use `__rrScenario.load('study-deck-rome')` and interact via `.answer-btn` DOM elements directly

### ISSUE-003 (Low): Poor distractor quality in some cards
- Session 1 Q2: "vandalism" and "Scourge of God" as distractors for "which Carthaginian general" — these aren't people's names and are obviously wrong at a glance, reducing quiz challenge
- Session 2 Q1: "three" as a distractor for "in what year" — a number word instead of a year, trivially eliminatable
- Session 2 Q3: "23" as a distractor for a year question — suspiciously short compared to other year answers

### ISSUE-004 (Low): No scheduling feedback to player
- After answering correctly, player sees "CARDS UPGRADED ⬆" but no indication of when they'll review this material again
- For a spaced-repetition game, the absence of interval display ("Next review in 4 days") is a missed UX opportunity

---

## All Studied Cards (Raw)

```json
[
  {
    "session": 1,
    "index": 1,
    "question": "Which day of the week is named after Saturn — the Roman god of time, agriculture, and the mythological Golden Age?",
    "correctAnswer": "Saturday",
    "allChoices": ["Saturday", "Jupiter", "Ceres", "Vulcan"],
    "answeredCorrectly": true
  },
  {
    "session": 1,
    "index": 2,
    "question": "Which Carthaginian general crossed the Alps with war elephants to invade Italy in 218 BCE?",
    "correctAnswer": "Hannibal Barca",
    "allChoices": ["vandalism", "Marcus Junius Brutus and Gaius Cassius Longinus", "Scourge of God", "Hannibal Barca"],
    "answeredCorrectly": true
  },
  {
    "session": 1,
    "index": 3,
    "question": "Which Carthaginian general crossed the Alps with war elephants to invade Italy in 218 BCE?",
    "correctAnswer": "Hannibal Barca",
    "allChoices": ["Marcus Junius Brutus and Gaius Cassius Longinus", "vandalism", "Scourge of God", "Hannibal Barca"],
    "answeredCorrectly": true,
    "note": "DUPLICATE of card 2 — same question, choices reordered"
  },
  {
    "session": 2,
    "index": 1,
    "question": "In what year did Mount Vesuvius erupt, burying Pompeii and Herculaneum in ash?",
    "correctAnswer": "79 CE",
    "allChoices": ["three", "September 2, 31 BCE", "64 CE", "79 CE"],
    "answeredCorrectly": true
  },
  {
    "session": 2,
    "index": 2,
    "question": "On what date was Julius Caesar assassinated?",
    "correctAnswer": "March 15, 44 BCE",
    "allChoices": ["About 482 years (509 BCE to 27 BCE)", "March 15, 44 BCE", "216 BCE", "1453 CE"],
    "answeredCorrectly": true
  },
  {
    "session": 2,
    "index": 3,
    "question": "According to Roman tradition established by Varro's chronology, in what year was Rome founded by Romulus?",
    "correctAnswer": "753 BCE",
    "allChoices": ["58–50 BCE", "23", "753 BCE", "September 2, 31 BCE"],
    "answeredCorrectly": true
  }
]
```
