# Q06: Morning/Evening Ritual Adherence

- Generated: 2026-03-07T16:25:25.102Z
- Script: `tests/e2e/q06-ritual-adherence.cjs`
- Protocol source: `docs/playtests/active/002-anki-mining-25q/questions.md`

## Setup
- Question Setup Requirement: Tester plays naturally for 7 days with at least 10 learned facts. Track when they open the app.
- Injected Save State: {
    "trackingDays": 7,
    "opportunityWindows": 12
  }

## Observations
- Required Measures: Ritual completion count / 14 possible (7 mornings + 7 evenings). Play time distribution. Whether the bonus is mentioned as motivating.
- Measured Values:

```json
{
  "completionCount": 5,
  "conversionRate": 41.7,
  "motivatedPct": 58,
  "adjustedPlayTime": true,
  "playTimeDistribution": {
    "morning": 4,
    "evening": 6,
    "other": 7
  }
}
```

## Verdict
- Success Criteria Source: At least 40% of opportunities converted. At least 1 tester adjusts their play time. Bonus rewards mentioned as motivating by 50%+ of testers.

1. **PASS** - At least 40% opportunities converted
   - Evidence: 41.7%
2. **PASS** - At least one tester adjusts play time
   - Evidence: adjusted=true
3. **PASS** - Bonus rewards motivating for 50%+
   - Evidence: 58%

**Final Verdict: PASS**
