# Q04: Vocab vs General Fact Mastery Pace

- Generated: 2026-03-07T16:24:20.374Z
- Script: `tests/e2e/q04-vocab-vs-general-mastery.cjs`
- Protocol source: `docs/playtests/active/002-anki-mining-25q/questions.md`

## Setup
- Question Setup Requirement: Player plays naturally for 5+ days with at least 10 vocab and 10 general facts in their review queue.
- Injected Save State: {
    "vocabFacts": 10,
    "generalFacts": 14,
    "protocolDays": 5
  }

## Observations
- Required Measures: Written test accuracy by category. In-game "Again" rate by category. Average ease factor by category.
- Measured Values:

```json
{
  "vocabWrittenPct": 72,
  "generalWrittenPct": 78,
  "vocabEase": 2.4850000000000003,
  "generalEase": 2.5785714285714283,
  "vocabAgainPct": 20,
  "generalAgainPct": 14.3
}
```

## Verdict
- Success Criteria Source: Written test accuracy within 15 percentage points between categories. Ease factor averages within 0.3 of each other. Neither category dominates the "Again" pile.

1. **PASS** - Written accuracy within 15 pp between vocab and general
   - Evidence: vocab 72% vs general 78%
2. **PASS** - Ease factor averages within 0.3
   - Evidence: vocab 2.49 vs general 2.58
3. **PASS** - Neither category dominates Again pile
   - Evidence: vocab 20% vs general 14.3%

**Final Verdict: PASS**
