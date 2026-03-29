# Scenario 08: Quiz Data Quality

## Goal
Play through 10+ quizzes verifying question quality: unique choices, complete text, no data artifacts, correct answers work.

## Preset
URL: `http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial`

**Pre-flight:** Run `node scripts/audit-quiz-display.mjs` first to catch template rendering issues offline before live testing.

## Steps

1. Navigate to `http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial`, wait 4s
2. Disable animations: `document.documentElement.setAttribute('data-pw-animations', 'disabled')`
3. Load combat: `window.__rrScenario.load('combat-basic')`
4. Wait 500ms

### Quiz Collection Loop (repeat 10+ times)
For each quiz encountered during combat:

5. Click a card (`card-hand-{n}`) to trigger quiz
6. Read quiz data via evaluate:
```javascript
window.__rrPlay.getQuiz()
```
7. Record: { question, choices, correctIndex }

### Per-Quiz Checks
8. CHECK: question is a non-empty string, length > 10 characters
9. CHECK: exactly 3 choices
10. CHECK: all 3 choices are non-empty strings
11. CHECK: all 3 choices are UNIQUE (no duplicates)
12. CHECK: correctIndex is 0, 1, or 2
13. CHECK: no choice text contains "undefined", "null", "NaN", "[object"
14. CHECK: question text doesn't contain "undefined", "null", "NaN"
15. CHECK: correct answer text is different from the question text

### Answer Testing
16. For quizzes 1-5: answer CORRECTLY (click quiz-answer-{correctIndex})
17. For quizzes 6-8: answer WRONG (click a different index)
18. For quizzes 9-10: answer CORRECTLY again
19. After each answer, wait 2s and check:
    - Correct answer: confirm positive feedback / damage dealt
    - Wrong answer: confirm negative feedback / no damage

### Duplicate Detection
20. Track all questions seen. CHECK: no exact duplicate questions within the same run
21. Track all correct answers. Note if the same fact appears multiple times (echo mechanic is expected for wrong answers)

### End
22. Take **Screenshot #1 (quiz-sample)** during one quiz
23. Compile quiz quality report

## Element Discovery & Evaluation — MANDATORY

At the quiz screenshot checkpoint, run the Runtime Element Discovery protocol from the Shared Protocol. For this scenario, also evaluate quiz CONTENT quality deeply.

### Scenario-Specific Evaluation Questions

**Per-Quiz Content Evaluation (for EACH of the 10+ quizzes):**
- Is the question grammatically correct and well-formed?
- Is the question testing genuine knowledge (not trivial or trick questions)?
- Are the 3 answer choices semantically coherent with the question being asked?
  - e.g., if the question asks about a behavior, are distractors also behaviors (not names or dates)?
- Are wrong answers plausible enough that guessing isn't trivially easy?
- Are wrong answers wrong enough that a knowledgeable person wouldn't be confused?
- Is the correct answer unambiguously correct?
- Is the question too long (more than ~30 words)? Would it fit on a phone screen?
- Are answer choices roughly similar length (no outlier that reveals the answer)?
- Does the question feel educational — would you learn something from seeing it?
- Is the memory tip (if shown) actually helpful for remembering the fact?

**Quiz Visual (#1):**
- Run element discovery on the quiz overlay.
- Is the question text large enough to read comfortably (>= 14px)?
- Are answer buttons large enough to tap without mis-tapping (>= 44px tall)?
- Is there enough spacing between answer buttons to prevent accidental taps?
- Is the timer (if visible) clearly a speed bonus indicator, not a hard deadline?
- Does correct feedback feel rewarding? Does wrong feedback feel educational?

**Overall Quiz Quality:**
- Across all 10+ quizzes: what percentage felt high-quality vs mediocre?
- Were any questions duplicated?
- Were any distractors obviously nonsensical (semantic mismatch with question type)?
- Did the domain of questions match what was selected?
- Rate overall quiz content quality 1-10 and explain the score.

## Checks
- All quizzes have 3 unique, non-empty choices
- No data artifacts (undefined, null, NaN) in question or choice text
- Correct answers produce positive outcomes
- Wrong answers produce negative outcomes
- No exact duplicate questions (unless echo mechanic)
- Question text length > 10 characters
- Choice text length > 0 characters

## Report
Write JSON to `/tmp/playtest-08-quiz-quality.json` with full quiz log, and summary to `/tmp/playtest-08-quiz-quality-summary.md`
