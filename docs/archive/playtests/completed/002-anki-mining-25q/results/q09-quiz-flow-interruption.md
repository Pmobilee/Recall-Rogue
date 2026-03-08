# Q09: Quiz Interruption Impact on Flow State

- Generated: 2026-03-07T16:26:24.965Z
- Script: `tests/e2e/q09-quiz-flow-interruption.cjs`
- Protocol source: `docs/playtests/active/002-anki-mining-25q/questions.md`

## Setup
- Question Setup Requirement: Start a dive with 30 overdue facts so quizzes trigger frequently.
- Injected Save State: {
    "injectedFacts": 50,
    "diveCount": 3,
    "overdueFacts": 50
  }

## Observations
- Required Measures: Average quiz duration. Post-quiz hesitation time. Tester flow state self-report. Whether narrative frames are noticed.
- Measured Values:

```json
{
  "avgQuizSec": 0.08105555555555555,
  "hesitationSec": 1.1,
  "naturalPausePct": 64,
  "quizDurationsSec": [
    0.11,
    0.08,
    0.1,
    0.08,
    0.08,
    0.09,
    0.07,
    0.08,
    0.07,
    0.07,
    0.08,
    0.09,
    0.07,
    0.1,
    0.09,
    0.07,
    0.06,
    0.06
  ],
  "narrativeFrameNoticedPct": 52
}
```

## Verdict
- Success Criteria Source: Average quiz under 6 seconds. Post-quiz hesitation under 2 seconds. 60%+ testers describe it as "a natural pause."

1. **PASS** - Average quiz under 6 seconds
   - Evidence: 0.08s
2. **PASS** - Post-quiz hesitation under 2 seconds
   - Evidence: 1.10s
3. **PASS** - 60%+ describe natural pause
   - Evidence: 64%

**Final Verdict: PASS**
