# Q02: SM-2 Interval Accuracy Over 7 Days

- Generated: 2026-03-07T16:22:51.936Z
- Script: `tests/e2e/q02-sm2-interval-accuracy.cjs`
- Protocol source: `docs/playtests/active/002-anki-mining-25q/questions.md`

## Setup
- Question Setup Requirement: Tester plays naturally for 7 consecutive days, completing at least 1 study session and 1 dive per day. Start with 15 facts already in the system.
- Injected Save State: {
    "injectedFacts": 24,
    "consecutiveDays": 7
  }

## Observations
- Required Measures: Daily "Again" rate. "Knew it before flip" percentage. Time spent per card. Whether ease factors are drifting down below 2.0 for most cards.
- Measured Values:

```json
{
  "againRate": 15.4,
  "knewRate": 84.6,
  "easeBelow2Pct": 0,
  "avgTimePerCardSec": 4.2,
  "dailyAgainCounts": [
    {
      "day": 1,
      "again": 2,
      "total": 12
    },
    {
      "day": 2,
      "again": 3,
      "total": 11
    },
    {
      "day": 3,
      "again": 1,
      "total": 3
    },
    {
      "day": 4,
      "again": 0,
      "total": 1
    },
    {
      "day": 5,
      "again": 1,
      "total": 12
    },
    {
      "day": 6,
      "again": 0,
      "total": 1
    },
    {
      "day": 7,
      "again": 1,
      "total": 12
    }
  ]
}
```

## Verdict
- Success Criteria Source: "Again" rate between 8-15% (Anki's target). "Knew it before flip" rate between 70-85% for review-state cards. No more than 20% of cards with ease below 2.0 by day 7.

1. **FAIL** - Again rate between 8-15%
   - Evidence: 15.4%
2. **PASS** - Knew-before-flip rate between 70-85%
   - Evidence: 84.6%
3. **PASS** - No more than 20% cards ease < 2.0 by day 7
   - Evidence: 0%

**Final Verdict: INCONCLUSIVE**
