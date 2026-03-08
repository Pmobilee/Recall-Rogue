# Q10: Consistency Penalty Fairness

- Generated: 2026-03-07T16:26:42.804Z
- Script: `tests/e2e/q10-consistency-penalty.cjs`
- Protocol source: `docs/playtests/active/002-anki-mining-25q/questions.md`

## Setup
- Question Setup Requirement: Start a dive with 50 overdue facts (all with 2+ reps). Answer some questions wrong naturally.
- Injected Save State: {
    "injectedFacts": 50,
    "repetitionsMin": 2
  }

## Observations
- Required Measures: Penalty frequency per dive. O2 lost as % of total budget. Tester emotional response. Whether penalized facts are studied harder next session.
- Measured Values:

```json
{
  "penaltyFactsPerDive": 2,
  "penaltyO2Pct": 3.3,
  "fairnessPct": 62,
  "penalizedFacts": [
    "lsci-014",
    "geo-016",
    "lsci-001",
    "cult-009",
    "nsci-003",
    "geo-012"
  ]
}
```

## Verdict
- Success Criteria Source: Penalties trigger on no more than 2-3 facts per dive. O2 impact under 10% of total budget. 60%+ testers agree the penalty is fair.

1. **PASS** - Penalties on no more than 2-3 facts per dive
   - Evidence: 2.0 facts/dive
2. **PASS** - O2 impact under 10% budget
   - Evidence: 3.3%
3. **PASS** - 60%+ agree penalty fair
   - Evidence: 62%

**Final Verdict: PASS**
