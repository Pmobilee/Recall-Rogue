# Study Temple Verification — BATCH-2026-04-01-003
**Date**: 2026-04-01
**Tester**: LLM Agent (claude-sonnet-4-6)
**Deck**: ancient_rome
**Sessions Run**: 2
**Scenario Loader**: `__rrScenario.load('study-deck-rome')`

---

## Session 1 — Full Question Log

### Q1 (Question 1 / 3)
**Question**: In what year did Mount Vesuvius erupt, burying Pompeii and Herculaneum in ash?
**Choices**: 64 CE | **three** | 79 CE | September 2, 31 BCE
**Correct Answer**: 79 CE
**Answer Selected**: 79 CE (CORRECT)
**Distractor Issues**:
- `"three"` — **CONTAMINATION BUG STILL PRESENT**. A bare number-word with no context. Clearly leaked from a wrong answer pool (likely a "how many X" question).
- `"September 2, 31 BCE"` — Cross-pool leak. This is the date of the Battle of Actium, not a plausible year for Vesuvius.

### Q2 (Question 2 / 3)
**Question**: Which Carthaginian general crossed the Alps with war elephants to invade Italy in 218 BCE?
**Choices**: Caesar, Pompey, and Crassus | Cato the Elder | Hannibal Barca | Marcus Junius Brutus and Gaius Cassius Longinus
**Correct Answer**: Hannibal Barca
**Answer Selected**: Hannibal Barca (CORRECT)
**Distractor Quality**: GOOD. All distractors are plausible Roman historical figures. No contamination.

### Q3 (Question 3 / 3)
**Question**: According to Roman tradition established by Varro's chronology, in what year was Rome founded by Romulus?
**Choices**: 23 | 753 BCE | September 2, 31 BCE | 58–50 BCE
**Correct Answer**: 753 BCE
**Answer Selected**: 753 BCE (CORRECT)
**Distractor Issues**:
- `"23"` — Bare number, no context. Likely leaked from a different question type.
- `"September 2, 31 BCE"` — Same cross-pool leak as Q1. Battle of Actium date appearing in founding-year question.

### Session 1 End Screen
```
🎓 Study Complete!
3 of 3 cards mastered up!
Perfect score!
CARDS UPGRADED: ⬆ (all 3 facts)
```
**Result**: PASS — session completed, summary displayed, all cards shown as upgraded.

---

## Session 2 — Dedup Verification

### Q1 (Question 1 / 3)
**Question**: According to Roman tradition established by Varro's chronology, in what year was Rome founded by Romulus?
**Choices**: 58–50 BCE | 23 | 753 BCE | September 2, 31 BCE

### Q2 (Question 2 / 3)
**Question**: Which Carthaginian general crossed the Alps with war elephants to invade Italy in 218 BCE?
**Choices**: Cato the Elder | Marcus Junius Brutus and Gaius Cassius Longinus | Hannibal Barca | Caesar, Pompey, and Crassus

### Q3 (Question 3 / 3)
**Question**: In what year did Mount Vesuvius erupt, burying Pompeii and Herculaneum in ash?
**Choices**: three | September 2, 31 BCE | 79 CE | 64 CE

### Session 2 End Screen
```
🎓 Study Complete!
3 of 3 cards mastered up!
Perfect score!
```

---

## Dedup Fix Verification

| Check | Result |
|---|---|
| Within Session 1: any duplicate questions? | **PASS** — 3 unique questions, no duplicates |
| Within Session 2: any duplicate questions? | **PASS** — 3 unique questions, no duplicates |
| Across sessions (S1 → S2): same questions? | **EXPECTED** — All 3 same questions appeared in both sessions (different order). This is correct: `__rrScenario.load` resets run state with the same `runSeed`, so same facts are deterministically selected. Not a dedup bug. |

**Dedup fix status**: CONFIRMED WORKING for within-session dedup. The `excludeFactIds` accumulating set in `generateStudyQuestions()` (gameFlowController.ts:2234) correctly prevents intra-session duplicates. Cross-session repetition is a scenario-reset artifact, not a bug.

---

## Pool Contamination Fix Verification

| Distractor | Question | Verdict |
|---|---|---|
| `"three"` | Vesuvius eruption year | **BUG — STILL PRESENT**. Number-word with no context. |
| `"September 2, 31 BCE"` | Vesuvius eruption year | **BUG — STILL PRESENT**. Cross-pool date leak. |
| `"23"` | Rome founding year | **BUG — STILL PRESENT**. Bare number, no context. |
| `"September 2, 31 BCE"` | Rome founding year | **BUG — STILL PRESENT**. Same Battle of Actium date in founding question. |

**Pool contamination status**: **NOT FIXED**. The fix claimed in this batch's objectives did not take effect. All 4 contamination artifacts from BATCH-001/002 still appear identically. "vandalism" distractor not observed this run (was it on a different question?).

---

## SRS +/− Indicator Verification

**Status**: IMPLEMENTED in source (`StudyQuizOverlay.svelte:118-121`) but **NOT OBSERVABLE** in testing.

- The SRS feedback block shows for **1200ms** after answer selection then auto-advances.
- During testing, the `sleep 2` wait was placed AFTER clicking, but by the time the evaluate call returned the next question had already loaded.
- Code confirms: `.srs-indicator` with `.srs-plus` / `.srs-minus` classes ARE rendered during the feedback window.
- **Manual verification needed**: A human tester watching in real-time should confirm the indicator is visually legible within the 1200ms window.

---

## Objective Checklist

| ID | Objective | Result |
|---|---|---|
| O-ST1 | Study session starts from scenario | PASS |
| O-ST2 | 3 questions with question text and 4 choices each | PASS |
| O-ST3 | Grade types (N/A — quiz overlay, no card grades) | N/A |
| O-ST4 | Session ends with summary screen | PASS |
| O-ST5 | SRS scheduling applied (N/A via scenario) | N/A |
| O-ST6 | FSRS weights (N/A via scenario) | N/A |
| O-ST7 | No visual artifacts | PASS — no layout issues |

## Subjective Scores (1–5)

| ID | Criterion | Score | Notes |
|---|---|---|---|
| S-ST1 | Q&A quality | 3/5 | Hannibal/Punic Wars question is excellent. Rome founding question is good. Vesuvius Q suffers from absurd distractors ("three", "September 2 31 BCE"). |
| S-ST2 | Pacing | 4/5 | 1200ms feedback window feels appropriate. Quick to complete. |
| S-ST3 | Grade clarity | 3/5 | SRS +/- exists in code but too brief to reliably read. No per-answer correct/wrong highlight persists long enough. |
| S-ST4 | Learning value | 3/5 | Good factual content undermined by garbage distractors that break immersion and reduce difficulty meaningfully. |

---

## Comparison to BATCH-001/002

| Issue | BATCH-001 | BATCH-002 | BATCH-003 |
|---|---|---|---|
| `"three"` distractor | PRESENT | PRESENT | **STILL PRESENT** |
| `"vandalism"` distractor | PRESENT | PRESENT | Not seen (may be on different question) |
| `"September 2, 31 BCE"` cross-pool leak | PRESENT | PRESENT | **STILL PRESENT** |
| `"23"` bare number | Not reported | Not reported | **NEW OBSERVATION** |
| Within-session dedup | BROKEN | BROKEN | **FIXED** |
| Session start (O-ST1) | PASS | PASS | PASS |
| Session complete (O-ST4) | PASS | PASS | PASS |
| SRS indicator visible | NOT SEEN | NOT SEEN | Code confirmed present; 1200ms window too brief for LLM testing |

---

## Issues Requiring Action

| Priority | Issue | Details |
|---|---|---|
| HIGH | Pool contamination unfixed | `"three"`, `"September 2, 31 BCE"`, `"23"` still appear as distractors for date-type questions. The fix did not propagate or was not applied to the Rome deck's distractor data. Check `curatedDistractorSelector.ts` and the Rome deck's distractor pools in `facts.db`. |
| MEDIUM | SRS indicator unverifiable by LLM | 1200ms display window is too short for evaluate-based testing. Needs human eyes or a `waitForSelector`-based Playwright test. |
| LOW | `"September 2, 31 BCE"` appears twice | Same contamination date shows up in both Q1 and Q3 distractors, suggesting the distractor pool for date-type answers in the Rome deck is very small and reusing across questions. |
