# Scenario 08: Quiz Data Quality

## Goal
Play through 10+ quizzes verifying question quality: unique choices, complete text, no data artifacts, correct answers work.

## Preset
URL: `http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial`

## Steps

1. Navigate to `http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial`, wait 4s
2. Disable animations: `document.documentElement.setAttribute('data-pw-animations', 'disabled')`
3. Load combat: `window.__terraScenario.load('combat-basic')`
4. Wait 500ms

### Quiz Collection Loop (repeat 10+ times)
For each quiz encountered during combat:

5. Click a card (`card-hand-{n}`) to trigger quiz
6. Read quiz data via evaluate:
```javascript
window.__terraPlay.getQuiz()
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
