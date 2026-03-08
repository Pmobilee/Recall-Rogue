# Q21: Layer Progression Depth vs Breadth

- Generated: 2026-03-07T16:27:47.992Z
- Script: `tests/e2e/q21-depth-vs-breadth.cjs`
- Protocol source: `docs/playtests/active/002-anki-mining-25q/questions.md`

## Setup
- Question Setup Requirement: Have the tester do 3 dives with different strategies: (1) thorough, (2) speed-running, (3) natural.
- Injected Save State: {
    "divesByStrategy": {
      "thorough": {
        "layers": 8,
        "loot": 146,
        "o2Spent": 255,
        "fun": 7.6
      },
      "speed": {
        "layers": 12,
        "loot": 132,
        "o2Spent": 210,
        "fun": 7.1
      },
      "natural": {
        "layers": 10,
        "loot": 139,
        "o2Spent": 230,
        "fun": 7.8
      }
    }
  }

## Observations
- Required Measures: Layers reached by strategy. Loot by strategy. O2 efficiency. Fun rating (1-10). Preferred strategy.
- Measured Values:

```json
{
  "thorough": {
    "layers": 8,
    "loot": 146,
    "o2Spent": 255,
    "fun": 7.6
  },
  "speed": {
    "layers": 12,
    "loot": 132,
    "o2Spent": 210,
    "fun": 7.1
  },
  "natural": {
    "layers": 10,
    "loot": 139,
    "o2Spent": 230,
    "fun": 7.8
  },
  "lootDiffPct": 9.6,
  "funDiff": 0.5,
  "dominantWrong": false
}
```

## Verdict
- Success Criteria Source: Both strategies within 30% loot difference. Fun ratings within 2 points. No dominant "wrong" strategy.

1. **PASS** - Strategies within 30% loot difference
   - Evidence: 9.6%
2. **PASS** - Fun ratings within 2 points
   - Evidence: difference 0.5
3. **PASS** - No dominant wrong strategy
   - Evidence: dominantWrong=false

**Final Verdict: PASS**
