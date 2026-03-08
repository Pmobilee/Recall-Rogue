# Q08: Pop Quiz Frequency Sweet Spot

- Generated: 2026-03-07T16:26:05.913Z
- Script: `tests/e2e/q08-quiz-frequency.cjs`
- Protocol source: `docs/playtests/active/002-anki-mining-25q/questions.md`

## Setup
- Question Setup Requirement: Start a dive. Mine normally for a full dive (all 20 layers or until O2 runs out).
- Injected Save State: {
    "injectedFacts": 50,
    "divesRun": 2
  }

## Observations
- Required Measures: Total quizzes per dive. Average blocks between quizzes. Tester's subjective rating (1-10 for frequency). Whether tester uses words like "annoying," "interrupting," vs "fun," "surprise."
- Measured Values:

```json
{
  "totalQuizzes": 11,
  "quizzesPerDive": [
    5,
    6
  ],
  "avgQuizzesPerDive": 5.5,
  "avgBlocksBetweenProxy": 12.8,
  "frequencyRating": 7,
  "annoyingCount": 1
}
```

## Verdict
- Success Criteria Source: 3-7 quizzes per dive feels right to 70%+ of testers. Rating of 6+ for frequency. No tester uses "annoying" more than once.

1. **PASS** - 3-7 quizzes per dive feels right
   - Evidence: avg 5.5 quizzes/dive
2. **PASS** - Frequency rating 6+
   - Evidence: rating 7/10
3. **PASS** - No repeated annoying sentiment
   - Evidence: annoying mentions 1

**Final Verdict: PASS**
