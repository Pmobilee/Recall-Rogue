# Q12: Artifact Boost Quiz Value Perception

- Generated: 2026-03-07T16:26:54.118Z
- Script: `tests/e2e/q12-artifact-boost-quiz.cjs`
- Protocol source: `docs/playtests/active/002-anki-mining-25q/questions.md`

## Setup
- Question Setup Requirement: Start a dive and mine until finding at least 3 artifacts.
- Injected Save State: {
    "artifactsTracked": 12,
    "boostTriggers": 8
  }

## Observations
- Required Measures: Tester's perceived connection (1-10). Whether they notice rarity changes. Emotional reaction to boost vs no boost.
- Measured Values:

```json
{
  "connectionPct": 75,
  "satisfyingPct": 58,
  "upgradedCount": 6,
  "boostEvents": [
    {
      "id": "ja-n3-242",
      "correct": false,
      "upgraded": false
    },
    {
      "id": "ja-n3-206",
      "correct": true,
      "upgraded": true
    },
    {
      "id": "ja-n3-178",
      "correct": true,
      "upgraded": true
    },
    {
      "id": "lsci-019",
      "correct": true,
      "upgraded": true
    },
    {
      "id": "ja-n3-265",
      "correct": false,
      "upgraded": false
    },
    {
      "id": "ja-n3-270",
      "correct": true,
      "upgraded": true
    },
    {
      "id": "hist-002",
      "correct": true,
      "upgraded": true
    },
    {
      "id": "ja-n3-156",
      "correct": true,
      "upgraded": true
    }
  ]
}
```

## Verdict
- Success Criteria Source: 70%+ testers perceive a connection between quiz and loot. 50%+ report the boost feels "satisfying."

1. **PASS** - 70%+ perceive quiz-loot connection
   - Evidence: 75%
2. **PASS** - 50%+ say boost is satisfying
   - Evidence: 58%

**Final Verdict: PASS**
