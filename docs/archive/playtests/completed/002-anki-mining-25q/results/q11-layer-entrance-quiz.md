# Q11: Layer Entrance Quiz Pressure

- Generated: 2026-03-07T16:26:50.033Z
- Script: `tests/e2e/q11-layer-entrance-quiz.cjs`
- Protocol source: `docs/playtests/active/002-anki-mining-25q/questions.md`

## Setup
- Question Setup Requirement: Start a dive and mine to at least 3 layer transitions.
- Injected Save State: {
    "injectedFacts": 50,
    "layerTransitionsObserved": 3
  }

## Observations
- Required Measures: Correct rate on layer quizzes vs pop quizzes. O2 impact on deeper layers. Whether any tester avoided descending.
- Measured Values:

```json
{
  "totalLayerQuestions": 9,
  "correctRate": 66.7,
  "deepestLayerImpactPct": 12,
  "devastatingPct": 28,
  "avoidDescendCount": 0
}
```

## Verdict
- Success Criteria Source: 60-80% correct rate. O2 impact felt as "meaningful but not devastating." 0 testers avoid descending due to quiz fear.

1. **PASS** - 60-80% correct rate
   - Evidence: 66.7%
2. **PASS** - Impact meaningful but not devastating
   - Evidence: devastating responses 28%
3. **PASS** - 0 testers avoid descending due to fear
   - Evidence: avoid count 0

**Final Verdict: PASS**
