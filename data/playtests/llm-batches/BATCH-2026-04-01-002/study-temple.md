# Study Temple Playtest Report — BATCH-2026-04-01-002

**Date**: 2026-04-01
**Tester**: LLM Playtest Agent (Sonnet 4.6)
**Method**: Playwright MCP + `__rrScenario.load()` workaround (direct API still broken)
**Decks tested**: `study-deck-rome` (2 sessions), `study-deck-greece` (1 session)

---

## Objective Checklist

| ID | Objective | Result | Notes |
|----|-----------|--------|-------|
| O-ST1 | Session starts and presents cards | PASS | `__rrScenario.load('study-deck-rome')` → `{ok: true, message: "Study quiz opened with 3 questions"}` |
| O-ST2 | Card data complete (question + 4 choices) | PASS | All questions had 4 answer buttons present |
| O-ST3 | Grade accepts all rating types | N/A | No FSRS grade UI present — no again/hard/good/easy buttons. Session auto-advances on answer click |
| O-ST4 | Session ends and shows summary | PASS | Summary screen shows "Study Complete!", score, and upgraded card list |
| O-ST5 | "Again" cards reappear after +2h | PARTIAL | Cards reappear on immediate reload — no time-gate observed. `fastForward()` not available in this build, so true scheduling cannot be verified |
| O-ST6 | "Good" cards do NOT reappear immediately | FAIL | All 3 correctly-answered cards from Session 1 reappeared in Session 2 with zero time advance. Scenario always resets to 3 cards regardless of prior performance |
| O-ST7 | No data artifacts | FAIL | Duplicate question in same session (see below) |

---

## Session 1 — study-deck-rome

**Cards**: 3 | **Score**: 3/3 (100%) | **Result**: "Perfect score! 3 of 3 cards mastered up!"

| # | Question | Correct Answer | Distractor Issues |
|---|----------|---------------|-------------------|
| Q1 | In what year did Mount Vesuvius erupt, burying Pompeii and Herculaneum in ash? | 79 CE | **"three"** — bare number with no unit, completely nonsensical as a year option. "September 2, 31 BCE" is a date but wrong format (specific calendar date vs. year). |
| Q2 | Which Carthaginian general crossed the Alps with war elephants to invade Italy in 218 BCE? | Hannibal Barca | **"vandalism"** — a cultural phenomenon (Vandals), not a general. **"Scourge of God"** — Attila the Hun's epithet, different era. **"Marcus Junius Brutus and Gaius Cassius Longinus"** — two people as one answer for a single-person question. |
| Q3 | According to Roman tradition established by Varro's chronology, in what year was Rome founded by Romulus? | 753 BCE | **"23"** — bare number, no unit/era. **"September 2, 31 BCE"** — recycled verbatim from Q1's distractor pool. |

**Recycled distractor**: "September 2, 31 BCE" appears as a distractor in both Q1 AND Q3 within the same session.

---

## Session 2 — study-deck-rome (immediate reload, no time advance)

**Cards**: 3 | **Score**: 3/3 (100%) | **Result**: "Perfect score! 3 of 3 cards mastered up!"

| # | Question | Correct Answer | Notes |
|---|----------|---------------|-------|
| Q1 | Which Carthaginian general crossed the Alps with war elephants to invade Italy in 218 BCE? | Hannibal Barca | Same question as S1-Q2. Same bad distractors. |
| Q2 | In what year did Mount Vesuvius erupt, burying Pompeii and Herculaneum in ash? | 79 CE | Same question as S1-Q1. Same bad distractors. |
| Q3 | **In what year did Mount Vesuvius erupt, burying Pompeii and Herculaneum in ash?** | 79 CE | **DUPLICATE of Q2 in this same session.** Bug confirmed. |

**DUPLICATE BUG CONFIRMED**: The Vesuvius question appeared twice (Q2 and Q3) in the same 3-card session. Summary correctly listed 3 upgraded cards but showed "In what year did Mount Vesuvius erupt…" twice. Only 2 unique facts studied.

**SCHEDULING FAIL**: All 3 correctly-answered cards from Session 1 reappeared in Session 2 with zero time gap. The scenario loader does not respect FSRS scheduling state — it always selects 3 cards fresh from the deck.

---

## Bonus Session — study-deck-greece

**Cards**: 3 | **Score**: 3/3 (100%) | **Result**: "Perfect score! 3 of 3 cards mastered up!" | No duplicates.

| # | Question | Correct Answer | Distractor Issues |
|---|----------|---------------|-------------------|
| Q1 | The lyre was the central instrument of Apollonian (rational, ordered) Greek culture — sacred to which god who received it when Hermes traded it to him in exchange for cattle? | Apollo | **"Diana", "Jupiter", "Mercury"** — all Roman god names for a question explicitly about Greek mythology. A player learning Greek gods would find Roman names confusing and misleading. |
| Q2 | What was the Roman name for Ares, the Greek god of war? | Mars | **"Seas, water, storms, earthquakes, and horses"** — this is a domain description of Poseidon/Neptune, not a deity name. Completely wrong answer format for a "what was the name" question. |
| Q3 | What is the traditionally accepted founding date of the ancient Olympic Games — the year the first recorded winner of the stadion race, Koroibos of Elis, is named in the historical record? | 776 BCE | **"Ten years"** — a duration, not a year. Completely wrong answer format. |

---

## SM-2 / FSRS Scheduling Verdict

**UNVERIFIABLE** — The study mode does not expose FSRS grade buttons (again/hard/good/easy). The session flow is:

1. Question shown → player clicks correct/wrong answer → next question immediately
2. Session ends → mastery-up summary
3. No explicit recall-rating step

There is no mechanism for the player to rate recall difficulty, which is the core of SM-2/FSRS. The system appears to treat any correct answer as "good" and any wrong answer as "again" automatically. Since `fastForward()` is not available and `__rrScenario.load()` always resets to fresh 3-card sessions regardless of prior session history, true scheduling behavior (deferred review intervals) cannot be tested in this build.

**O-ST6 FAILS**: Correctly-answered cards from Session 1 reappeared in Session 2 immediately, suggesting the scenario loader bypasses scheduling state entirely.

---

## Subjective Ratings

| ID | Metric | Score (1-5) | Notes |
|----|--------|-------------|-------|
| S-ST1 | Question-answer quality | 2/5 | Questions themselves are well-formed and historically accurate. Distractors are consistently bad — bare numbers without units ("three", "23"), wrong-format answers ("Seas, water, storms…", "Ten years"), same-distractor recycling across questions, Roman names for Greek questions. |
| S-ST2 | Pacing | 3/5 | Auto-advance after answer click is clean. 3-card sessions feel short but appropriate for a game mode. No timer pressure is good. |
| S-ST3 | Grade clarity | 1/5 | No grading UI at all. The player has no way to signal "I knew this well" vs "I guessed". The educational loop is incomplete. |
| S-ST4 | Learning value | 2/5 | Questions cover genuine history facts, but distractor quality so poor that the multiple-choice format fails its purpose — bad distractors ("three", "Ten years") are immediately dismissible, turning the quiz into a process-of-elimination exercise rather than genuine recall testing. |

---

## Issues Found

### CRITICAL

| ID | Issue | Deck | Status vs BATCH-001 |
|----|-------|------|---------------------|
| BUG-ST-001 | Duplicate question within same 3-card session | rome (S2: Vesuvius appeared as Q2 and Q3) | **PERSISTS** — BATCH-001 saw Hannibal Barca duplicated; now Vesuvius. Same underlying bug, different question. |
| BUG-ST-002 | FSRS scheduling not respected by scenario loader — all cards reappear immediately on reload | rome | New confirmation — `fastForward()` unavailable makes full scheduling test impossible, but zero-delay reappearance is confirmed |

### HIGH

| ID | Issue | Deck | Details |
|----|-------|------|---------|
| BUG-ST-003 | Format-mismatch distractors | rome, greece | "Seas, water, storms, earthquakes, and horses" for a deity-name question; "Ten years" for a year question; "three" for a year question; "23" for a year question — distractors are pulled from wrong fact-type pools |
| BUG-ST-004 | Distractor recycled across questions in same session | rome | "September 2, 31 BCE" appears as distractor in both Q1 (Vesuvius) and Q3 (founding of Rome) in Session 1 |
| BUG-ST-005 | Roman god names as distractors for Greek mythology question | greece | "Diana", "Jupiter", "Mercury" for a question about Greek gods — misleading for learners |
| BUG-ST-006 | No FSRS grade UI — player cannot rate recall difficulty | all | No again/hard/good/easy buttons. Removes core spaced-repetition differentiation |

### MEDIUM

| ID | Issue | Deck | Details |
|----|-------|------|---------|
| BUG-ST-007 | `fastForward()` helper not available in this build | — | Cannot test true scheduling intervals. The playtest API listed this as available but it is not exposed on `window` |
| BUG-ST-008 | Question text is verbose | greece | "The lyre was the central instrument of Apollonian (rational, ordered) Greek culture — sacred to which god who received it when Hermes traded it to him in exchange for cattle?" — the parenthetical explanation and backstory pad a simple factual question to 40+ words |

---

## Comparison to BATCH-001

| Finding | BATCH-001 | BATCH-002 | Delta |
|---------|-----------|-----------|-------|
| startStudy/getStudyCard/gradeCard API broken | YES | YES (not fixed) | No change |
| Duplicate question in session | YES (Hannibal Barca) | YES (Vesuvius) | Bug persists, different question |
| "vandalism" distractor | YES (flagged) | YES (still present) | No fix |
| "Scourge of God" distractor | Not noted | Confirmed present | New observation |
| FSRS grade UI absent | Not explicitly tested | Confirmed absent | New finding |
| Scheduling verification | Not attempted | Attempted — O-ST6 FAILS | New finding |
| fastForward() availability | Not tested | Not available | New finding |

**Summary**: Zero fixes since BATCH-001. All previously identified issues persist. Two new categories of bugs discovered: scheduling bypass (O-ST6) and complete absence of FSRS grade UI.

---

## Recommended Fixes (Priority Order)

1. **Fix duplicate-question bug in session card selector** — deduplicate card IDs before presenting a session. A 3-card session showing the same card twice wastes a study slot and is jarring.
2. **Fix distractor format validation** — distractors must match answer-type of their question (year questions need year-format distractors, name questions need name-format distractors). Reject distractors that are durations, descriptions, or multi-person answers for single-person questions.
3. **Deduplicate distractors across questions in same session** — "September 2, 31 BCE" should not appear in two different questions in the same session.
4. **Add FSRS grade buttons** — even if auto-graded internally, showing again/hard/good/easy lets players signal recall confidence and completes the educational loop.
5. **Expose `fastForward()` in dev/test build** — required to verify scheduling behavior. Cannot test O-ST5/O-ST6 without it.
6. **Fix Greek vs Roman deity cross-contamination** — Greek mythology questions must use Greek name distractors only.
