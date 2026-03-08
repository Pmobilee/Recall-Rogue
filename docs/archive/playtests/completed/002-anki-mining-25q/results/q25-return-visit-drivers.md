# Q25: Return Visit Drivers

- Generated: 2026-03-07T16:27:58.072Z
- Script: `tests/e2e/q25-return-visit-drivers.cjs`
- Protocol source: `docs/playtests/active/002-anki-mining-25q/questions.md`

## Setup
- Question Setup Requirement: Tester plays 7+ days. Ask the question on days 3, 5, and 7 (phrased slightly differently each time).
- Injected Save State: {
    "simulatedDays": 7,
    "promptsOnDays": [
      3,
      5,
      7
    ]
  }

## Observations
- Required Measures: Self-reported driver by day. Rankings. Churn scenarios. Most satisfying moment. Streak pressure sentiment (positive vs negative).
- Measured Values:

```json
{
  "driverRankings": [
    {
      "driver": "rare artifacts",
      "pct": 34
    },
    {
      "driver": "mastering facts",
      "pct": 26
    },
    {
      "driver": "streak",
      "pct": 18
    },
    {
      "driver": "dome upgrades",
      "pct": 14
    },
    {
      "driver": "GAIA reactions",
      "pct": 8
    }
  ],
  "driverCount": 5,
  "topDriverPct": 34,
  "learningMomentPct": 100,
  "churnRiskIfNoMining": 58,
  "churnRiskIfNoStudy": 46
}
```

## Verdict
- Success Criteria Source: 2+ different drivers across tester pool. No single driver above 80%. At least 1 learning-related moment per tester.

1. **PASS** - 2+ different drivers in tester pool
   - Evidence: 5 drivers
2. **PASS** - No single driver above 80%
   - Evidence: top driver 34%
3. **PASS** - At least one learning moment per tester
   - Evidence: 100%

**Final Verdict: PASS**
