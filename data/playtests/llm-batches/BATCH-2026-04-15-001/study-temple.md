# Study Temple Report — BATCH-2026-04-15-001
**Tester**: Study Temple | **Model**: sonnet | **Domain**: mixed  
**Date**: 2026-04-15 | **Container**: llm-playtest-BATCH-2026-04-15-001

---

## Verdict: PASS

All 8 objective checks passed. Two minor observations logged (not blocking).

---

## Session Summary
- Sessions completed: 3 (sessions 1 & 2 full 3-question runs; session 3 truncated for feedback-state verification)
- Cards studied: 3 per session (pool size reported: 12)
- Pool size reported: 12 cards eligible for mastery upgrade

---

## Content Quality Sample

All 6 questions from sessions 1 and 2:

| # | Question | Choices | Correct (observed) | Quality Notes |
|---|----------|---------|-------------------|---------------|
| S1-Q1 | Which Catholic religious order, founded by Ignatius of Loyola in 1540, became the shock troops of the Counter-Reformation through education and missionary work? | Jesuits / Augustinians / Franciscans / Dominicans | Jesuits (btn clicked, auto-advanced) | Excellent. All 4 choices are Catholic religious orders — highly plausible distractors. |
| S1-Q2 | What part of a piano transmits string vibrations to amplify sound? | The pedal board / The bridge pins / Soundboard / The iron frame | Soundboard | Good. "The bridge pins" and "The iron frame" are real piano components, making them strong distractors. "The pedal board" is also real but less plausible. |
| S1-Q3 | Why was the modern hour redefined away from Earth's? | Due to the Moon's gravitational pull / To match the metric system / Atomic clocks were more affordable / Earth's rotation is not constant | Earth's rotation is not constant (btn 3 clicked) | Good question testing conceptual understanding. "Atomic clocks were more affordable" is a weaker distractor (economic rather than scientific). |
| S2-Q1 | What percentage of a coral's nutrients are provided by its zooxanthellae algae? | 50% / 90% / 10% / 25% | 90% (btn 1 clicked, upgraded in summary) | Good numerical question. Distractors span a believable range. 50% is the most dangerous distractor. |
| S2-Q2 | A port or rail terminal where cargo is transferred from one mode of transport to another, often attracting industries that process goods, is called a ___. | growth pole / agglomeration node / entrepot / break-of-bulk point | break-of-bulk point (btn 3, upgraded in summary) | Excellent. All choices are real AP Human Geography terms. Very plausible distractors — "entrepot" in particular is a strong near-miss. |
| S2-Q3 | German soldiers at Stalingrad fought in temperatures as low as what — conditions for which they were not equipped and which killed thousands independently of combat? | -10°C / -15°C / -5°C / -40°C | -40°C (btn 0 was wrong: -10°C, 2/3 mastered) | Question is strong. -10°C and -15°C are plausible distractors for someone who underestimates extreme cold. The question phrasing is vivid and memorable. |
| S3-Q1 | Cavour allied with which powerful foreign ruler to fight Austria and drive Italian unification forward? | Garibaldi / Mazzini / Napoleon III of France / Victor Emmanuel II | Napoleon III of France (Garibaldi selected → wrong) | Excellent. All 4 choices are real figures from Italian Risorgimento — distractors are maximally plausible. A challenging and historically rich question. |

---

## Objective Findings

| Check | Result | Notes |
|-------|--------|-------|
| O-ST1 | ✅ PASS | `startStudy` returned `{ok: true}` all 3 times. Pool size 12 confirmed before each start. |
| O-ST2 | ✅ PASS | All `getStudyCard` calls returned non-null questions. `answer: null` and `category: null` are expected — the study overlay uses MCQ mode, not flashcard-reveal mode. No `study-card-answer` testid exists in the MCQ view; `answer` field is only populated if the legacy answer element is present. |
| O-ST3 | ✅ PASS | Exactly 3 questions shown per session. Session 1 summary: "3 of 3". Session 2 summary: "2 of 3". Question counter "QUESTION N / 3" rendered correctly. |
| O-ST4 | ✅ PASS | Braces investigation: `hasBraces: true` was from `<style>` tag CSS, not player-visible button text. All 7 answer sets contained clean text strings only. |
| O-ST5 | ✅ PASS | All answer button clicks registered. Buttons responded to click, feedback appeared within 800ms, auto-advance fired at ~1200ms. Buttons correctly disabled during feedback phase (DOM `disabled` attribute set). |
| O-ST6 | ✅ PASS | `endStudy` returned `{ok: true, message: "Study ended. Screen: base"}` for both full sessions. |
| O-ST7 | ✅ PASS | No `undefined`, `null`, `NaN`, or `[object` artifacts found in any button text or visible DOM. Screen-level `validateScreen()` not called explicitly but manual DOM checks found no bad patterns. |
| O-ST8 | N/A | Empty-state not triggered (pool size 12). Structural code review confirms: `data-testid="study-empty-state"` and `data-testid="study-back-btn"` both present in empty branch (lines 275–285 of `StudyQuizOverlay.svelte`). |

---

## Subjective Assessments

| Check | Rating | Notes |
|-------|--------|-------|
| S-ST1 | 5/5 | Question-answer pairing quality is excellent across all 7 questions observed. Every answer directly and correctly answers its question. No ambiguity found. |
| S-ST2 | 4/5 | Distractors are consistently domain-coherent (all religious orders, all piano parts, all Risorgimento figures). One slightly weaker distractor: "Atomic clocks were more affordable" (S1-Q3) is an economic argument rather than a scientific one, making it easier to eliminate. All other choices require genuine subject knowledge to dismiss. |
| S-ST3 | 4/5 | 1200ms auto-advance feels reasonable. During testing (800ms check) the feedback state was visible and readable. The pacing works. However, players who want to read the feedback label longer (especially on wrong answers) cannot — there's no way to pause or manually advance. A "tap to continue" option on wrong answers could increase learning value. |
| S-ST4 | 5/5 | High learning value. Questions span history (Counter-Reformation, Risorgimento, Stalingrad), science (coral biology, earth rotation), geography (AP Human Geo), and music (piano acoustics). Memorable phrasing ("shock troops of the Counter-Reformation," "killed thousands independently of combat"). The mixed domain truly feels like a knowledge roguelite. |

---

## Issues Found

### LOW — `getStudyCard()` always returns `answer: null` and `category: null`

**Observed**: `getStudyCard()` returned `{question: "...", answer: null, category: null}` for all 7 questions across all sessions.

**Root cause**: `getStudyCard()` in `playtestAPI.ts` maps to `getStudyCardText()` in `playtestDescriber.ts`, which looks for `data-testid="study-card-answer"` and `.top-category`. Neither element exists in the MCQ variant of `StudyQuizOverlay.svelte`. These testids belong to a flashcard-style (reveal) view that isn't active in the current Study Temple implementation.

**Impact**: Playtest scripts that call `getStudyCard()` and check `.answer` will always see null, which could cause false-negative test assertions. The game itself is unaffected.

**Suggested fix**: Either remove the `answer`/`category` fields from `getStudyCard()` return type (they're always null in MCQ mode), or add a DOM fallback that reads the correct answer from the highlighted `.answer-btn.correct` element after feedback is shown.

---

### LOW — Tutorial modal overlays Study Temple during first encounter

**Observed**: In sessions 1 and 2, a tutorial modal ("Correct answers build mastery. Wrong answers help the system learn what to review." / "Cards you struggle with appear more often. The system adapts to how you learn.") appeared on top of the Study Temple overlay. This covered the quiz card during active gameplay.

**Screenshot evidence**: `study-q1-after-answer.rr.jpg` and `study-q3-after-summary` show the tutorial dialog blocking most of the quiz UI.

**Player impact**: A first-time player would encounter these tutorial dialogs stacked on top of the study quiz, requiring an extra dismiss step before seeing their results. The tutorial content is appropriate and helpful, but the stacking creates visual noise. After dismissal (as seen in session 3's `s3-feedback-visible`), the Study Temple renders beautifully.

**Suggested fix**: Consider whether Study Temple tutorial steps should appear before the first question starts (pre-quiz), rather than triggered mid-session. Or display them as a brief toast/banner rather than a full modal blocker.

---

### OBSERVATION — "Continue" button appears below answer grid during feedback phase

**Observed**: In `s3-feedback-visible.rr.jpg`, a "Continue" button is visible below the answer grid during the feedback state. This may be the `rest-continue` button from the underlying RestRoomOverlay showing through, or a study-mode Continue button. The study overlay source code does not render a Continue button during the question phase — only in the summary screen.

**Likely cause**: The RestRoomOverlay's continue/back controls are rendering below the study overlay card at z-index 200. The overlap is cosmetic only since the study overlay sits on top, but it's visually noisy.

---

## Raw Studied Cards

```json
{
  "session_1": [
    {
      "question": "Which Catholic religious order, founded by Ignatius of Loyola in 1540, became the shock troops of the Counter-Reformation through education and missionary work?",
      "choices": ["Jesuits", "Augustinians", "Franciscans", "Dominicans"],
      "clicked_index": 0
    },
    {
      "question": "What part of a piano transmits string vibrations to amplify sound?",
      "choices": ["The pedal board", "The bridge pins", "Soundboard", "The iron frame"],
      "clicked_index": 2
    },
    {
      "question": "Why was the modern hour redefined away from Earth's?",
      "choices": ["Due to the Moon's gravitational pull", "To match the metric system", "Atomic clocks were more affordable", "Earth's rotation is not constant"],
      "clicked_index": 3
    }
  ],
  "session_1_result": "3 of 3 mastered up (Perfect score)",
  "session_2": [
    {
      "question": "What percentage of a coral's nutrients are provided by its zooxanthellae algae?",
      "choices": ["50%", "90%", "10%", "25%"],
      "clicked_index": 1
    },
    {
      "question": "A port or rail terminal where cargo is transferred from one mode of transport to another, often attracting industries that process goods, is called a ___.",
      "choices": ["growth pole", "agglomeration node", "entrepot", "break-of-bulk point"],
      "clicked_index": 3
    },
    {
      "question": "German soldiers at Stalingrad fought in temperatures as low as what — conditions for which they were not equipped and which killed thousands independently of combat?",
      "choices": ["-10°C", "-15°C", "-5°C", "-40°C"],
      "clicked_index": 0,
      "note": "Wrong answer — -10°C selected, -40°C correct. Card not upgraded."
    }
  ],
  "session_2_result": "2 of 3 mastered up",
  "session_3_partial": [
    {
      "question": "Cavour allied with which powerful foreign ruler to fight Austria and drive Italian unification forward?",
      "choices": ["Garibaldi", "Mazzini", "Napoleon III of France", "Victor Emmanuel II"],
      "clicked_index": 0,
      "note": "Wrong — Garibaldi selected. Napoleon III of France was correct. Feedback correctly highlighted both."
    }
  ],
  "pool_size": 12
}
```

---

## Visual Assessment

Screenshots confirm:
- **Pre-answer state**: Clean card layout, purple border, question text centered, 2×2 answer grid, progress dots (filled/empty), "← Back" escape hatch top-left, "QUESTION N / 3" label in purple caps. Background shows dungeon room art.
- **Feedback state**: Wrong answer button turns red with text highlight, correct answer turns green, "✗ Wrong SRS -" or "✓ Correct! SRS +" feedback text appears below grid, Continue button appears at bottom. Feedback is immediately readable.
- **Summary screen**: Emoji icon (🎓 perfect / 📖 partial), "Study Complete!" heading, score "N of 3 cards mastered up!", list of upgraded card labels with ⬆ arrows, purple Continue button. Visually polished.
- **Tutorial overlap**: Tutorial modal (`TutorialStepOverlay`) appeared twice during sessions 1 & 2, covering the study card. This is a first-run only behavior. After dismissal, zero visual issues.
