# Q16: Study Session Length Satisfaction

- Generated: 2026-03-07T16:27:24.741Z
- Script: `tests/e2e/q16-session-length.cjs`
- Protocol source: `docs/playtests/active/002-anki-mining-25q/questions.md`

## Setup
- Question Setup Requirement: Start with 50 overdue facts. Navigate to Study Station.
- Injected Save State: {
    "injectedFacts": 55,
    "overdueFacts": 50
  }

## Observations
- Required Measures: Actual duration vs expected. Total cards vs selected size. Re-queue rate. Satisfaction (1-10).
- Measured Values:

```json
{
  "quickMinutes": 0.0012,
  "standardMinutes": 0.0016666666666666668,
  "quickCardsSeen": 5,
  "standardCardsSeen": 10,
  "satisfaction": 7,
  "requeueHelpfulPct": 63
}
```

## Verdict
- Success Criteria Source: "5 Quick" under 2 minutes. "10 Standard" under 5 minutes. Satisfaction 7+. Re-queues perceived as helpful by 60%+.

1. **PASS** - 5 Quick under 2 minutes
   - Evidence: 0.00 min
2. **PASS** - 10 Standard under 5 minutes
   - Evidence: 0.00 min
3. **PASS** - Satisfaction 7+
   - Evidence: 7/10
4. **PASS** - Re-queues perceived helpful by 60%+
   - Evidence: 63%

**Final Verdict: PASS**
