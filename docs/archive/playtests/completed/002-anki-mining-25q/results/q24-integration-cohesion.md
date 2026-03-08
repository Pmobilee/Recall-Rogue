# Q24: Mining + Learning Integration Cohesion

- Generated: 2026-03-07T16:27:57.148Z
- Script: `tests/e2e/q24-integration-cohesion.cjs`
- Protocol source: `docs/playtests/active/002-anki-mining-25q/questions.md`

## Setup
- Question Setup Requirement: Tester plays 3+ days with at least 1 dive and 1 study session per day.
- Injected Save State: {
    "simulatedDays": 3,
    "dailyDiveAndStudy": true
  }

## Observations
- Required Measures: Game description (mining vs learning vs integrated). System diagram accuracy. Unprompted mention of cross-system connections. Cohesion rating (1-10).
- Measured Values:

```json
{
  "integratedPct": 58,
  "crossLinksPct": 74,
  "cohesion": 7,
  "links": [
    "Study performance influenced quiz confidence in dive",
    "Mining artifacts expanded the study queue",
    "Ritual study reward affected O2 prep choices"
  ]
}
```

## Verdict
- Success Criteria Source: 50%+ describe as "something new" or integrated. 70%+ identify 2+ cross-system connections unprompted. Cohesion rated 6+.

1. **PASS** - 50%+ describe integrated experience
   - Evidence: 58%
2. **PASS** - 70%+ identify 2+ cross-system links
   - Evidence: 74%
3. **PASS** - Cohesion rated 6+
   - Evidence: 7/10

**Final Verdict: PASS**
