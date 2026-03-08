# Q15: Three-Button Grading Clarity

- Generated: 2026-03-07T16:27:20.424Z
- Script: `tests/e2e/q15-three-button-grading.cjs`
- Protocol source: `docs/playtests/active/002-anki-mining-25q/questions.md`

## Setup
- Question Setup Requirement: Navigate to Study Station and start a 10-card session.
- Injected Save State: {
    "injectedFacts": 55,
    "studySessionSize": 10
  }

## Observations
- Required Measures: First-interaction hesitation time. Correct understanding rate. Button alignment with actual recall quality. Whether interval labels are read.
- Measured Values:

```json
{
  "firstInteractionHesitationSec": 0.1,
  "againUnderstandingPct": 83,
  "intervalUnderstandingPct": 64,
  "badGoodPresses": 0,
  "ratingDistribution": {
    "again": 2,
    "okay": 3,
    "good": 5
  }
}
```

## Verdict
- Success Criteria Source: 80%+ testers understand Again = "I didn't know this." 60%+ understand interval labels. No tester presses "Good" on a card they clearly didn't know.

1. **PASS** - 80%+ understand Again meaning
   - Evidence: 83%
2. **PASS** - 60%+ understand interval labels
   - Evidence: 64%
3. **PASS** - No Good presses on unknown cards
   - Evidence: 0 mismatches

**Final Verdict: PASS**
