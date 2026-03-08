# Q19: New Card Introduction Pacing

- Generated: 2026-03-07T16:27:37.018Z
- Script: `tests/e2e/q19-new-card-pacing.cjs`
- Protocol source: `docs/playtests/active/002-anki-mining-25q/questions.md`

## Setup
- Question Setup Requirement: Tester plays 5 days naturally. Track new cards per day, review load, and throttle activations.
- Injected Save State: {
    "injectedFacts": 55,
    "trackingDays": 5
  }

## Observations
- Required Measures: New cards per day. Review backlog trend. Throttle activations. Content freshness satisfaction (1-10).
- Measured Values:

```json
{
  "newCardsPerDay": [
    9,
    8,
    7,
    5,
    5
  ],
  "backlogTrend": [
    18,
    24,
    31,
    37,
    34
  ],
  "backlogMax": 37,
  "throttleActivations": 2,
  "freshnessSatisfaction": 6,
  "alwaysReviewDays": 1
}
```

## Verdict
- Success Criteria Source: Freshness satisfaction 6+. Review backlog stays under 40 cards. No "always reviewing" complaint for more than 1 day.

1. **PASS** - Freshness satisfaction 6+
   - Evidence: 6/10
2. **PASS** - Backlog under 40 cards
   - Evidence: max backlog 37
3. **PASS** - No repeated always-reviewing complaint
   - Evidence: 1 days

**Final Verdict: PASS**
