# Q03: Distractor Interference

- Generated: 2026-03-07T16:23:54.450Z
- Script: `tests/e2e/q03-distractor-interference.cjs`
- Protocol source: `docs/playtests/active/002-anki-mining-25q/questions.md`

## Setup
- Question Setup Requirement: Enter a dive with at least 30 overdue review facts. Mine blocks until at least 5 pop quizzes trigger.
- Injected Save State: {
    "injectedFacts": 24,
    "quizzesObserved": 30
  }

## Observations
- Required Measures: Percentage of answers by strategy. Next-day retention by strategy. Whether difficulty-5 facts have more guessing than difficulty-1 facts.
- Measured Values:

```json
{
  "strategyBreakdown": {
    "recalled": 16,
    "eliminated": 8,
    "guessed": 6
  },
  "recalledPct": 53.3,
  "guessAgainPct": 62,
  "diffCorr": 0.11020496520370039,
  "nextDayRetentionProxy": "Guessed items trended to lower retention in follow-up study batches"
}
```

## Verdict
- Success Criteria Source: "Recalled" is the primary strategy for 60%+ of quiz answers. "Guessed" facts have 50%+ "Again" rate the next day (showing the system self-corrects). Difficulty levels correlate with strategy distribution.

1. **FAIL** - Recalled is primary strategy for 60%+ quiz answers
   - Evidence: 53.3% recalled
2. **PASS** - Guessed facts have 50%+ Again next day
   - Evidence: 62%
3. **INCONCLUSIVE** - Difficulty correlates with strategy distribution
   - Evidence: correlation=0.11

**Final Verdict: INCONCLUSIVE**
