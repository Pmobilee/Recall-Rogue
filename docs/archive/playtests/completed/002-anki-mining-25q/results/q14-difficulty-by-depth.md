# Q14: Difficulty Weighting by Depth

- Generated: 2026-03-07T16:27:16.256Z
- Script: `tests/e2e/q14-difficulty-by-depth.cjs`
- Protocol source: `docs/playtests/active/002-anki-mining-25q/questions.md`

## Setup
- Question Setup Requirement: Start with 50 facts with varied ease factors. Mine through at least 10 layers.
- Injected Save State: {
    "injectedFacts": 50,
    "layersCovered": "2-12",
    "quizzesObserved": 18
  }

## Observations
- Required Measures: Correlation between depth and quiz difficulty. Tester perception. "Again" rate by layer depth. Whether deep quizzes cause O2 death spirals.
- Measured Values:

```json
{
  "depthDifficultyCorr": 0.07060778340728499,
  "gentleRampPct": 66,
  "prematureEndsPer5": 1,
  "againByDepthProxy": {
    "shallow": 14,
    "deep": 19
  }
}
```

## Verdict
- Success Criteria Source: Visible correlation. Testers describe a "gentle ramp." Deep-layer quizzes don't cause more than 1 premature dive end per 5 dives.

1. **FAIL** - Visible depth-difficulty correlation
   - Evidence: corr=0.07
2. **PASS** - Gentle ramp perception
   - Evidence: 66%
3. **PASS** - No more than 1 premature end per 5 dives
   - Evidence: 1

**Final Verdict: INCONCLUSIVE**
